import type { AiBot } from '@prisma/client';
import prisma from '../../config/database';
import { generateBotReply } from '../ai/chatbot.service';
import { isAiConfiguredForOrg } from '../ai/org-ai.service';
import { isSarvamSttConfigured, SarvamStreamTranscriber } from '../calling/sarvam.stt';
import { isSarvamTtsConfigured, previewSpeechSarvam } from '../calling/sarvam.tts';
import { createModuleLogger } from '../../utils/logger';
import {
  buildPreviewAiBot,
  sanitizeAiBotTestHistory,
  type AiBotTestTurn,
} from './test-preview';

const log = createModuleLogger('calling-preview');

export type CallingPreviewPhase = 'listening' | 'thinking' | 'speaking';

export interface CallingPreviewStartConfig {
  organizationId: string;
  botId?: string;
  name: string;
  instructions: string;
  voiceGreeting?: string | null;
  voiceSpeaker?: string | null;
  voiceLanguage?: string | null;
  previewKnowledge?: Array<{ title: string; content: string }>;
  whatsappNumberId?: string;
}

export interface CallingPreviewEvents {
  onPartial: (text: string) => void;
  onUserFinal: (text: string) => void;
  onAssistant: (payload: { text: string; audioBase64: string; contentType: string }) => void;
  onState: (phase: CallingPreviewPhase) => void;
  onError: (message: string) => void;
}

const MAX_SESSION_MS = 8 * 60_000;

export class CallingPreviewSession {
  private transcriber: SarvamStreamTranscriber | null = null;
  private readonly history: AiBotTestTurn[] = [];
  private processing = false;
  private closed = false;
  private bot: AiBot | null = null;
  private readonly timeout: ReturnType<typeof setTimeout>;

  constructor(
    private readonly config: CallingPreviewStartConfig,
    private readonly events: CallingPreviewEvents
  ) {
    this.timeout = setTimeout(() => {
      this.events.onError('Live preview timed out. Start again to keep testing.');
      void this.close();
    }, MAX_SESSION_MS);
    this.timeout.unref?.();
  }

  static async assertReady(organizationId: string): Promise<void> {
    if (!isSarvamSttConfigured() || !isSarvamTtsConfigured()) {
      throw new Error('Sarvam voice is not configured on this server yet.');
    }
    if (!(await isAiConfiguredForOrg(organizationId))) {
      throw new Error('AI is not set up on this server yet.');
    }
  }

  async start(): Promise<void> {
    await CallingPreviewSession.assertReady(this.config.organizationId);
    this.bot = await this.resolveBot();
    this.transcriber = new SarvamStreamTranscriber({
      onPartial: (text) => {
        if (!this.closed && !this.processing) this.events.onPartial(text);
      },
      onFinal: (text) => {
        if (!this.closed) void this.handleCallerText(text);
      },
      onError: (err) => {
        log.warn('Calling preview STT error', { error: err.message });
        this.events.onError('Could not hear you clearly. Try again.');
      },
      onSpeechStart: () => {
        if (!this.closed && !this.processing) this.events.onState('listening');
      },
    });

    await this.transcriber.connect({
      language: this.config.voiceLanguage || undefined,
      streamType: 'fast',
    });

    const greeting = this.config.voiceGreeting?.trim();
    if (greeting) {
      await this.speakAssistant(greeting, { addToHistory: false });
    }

    this.events.onState('listening');
  }

  sendPcm(samples: Int16Array, sampleRate: number): void {
    if (this.closed || this.processing) return;
    this.transcriber?.sendPcm(samples, sampleRate);
  }

  notifyPlaybackEnded(): void {
    if (this.closed) return;
    this.events.onState('listening');
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timeout);
    this.transcriber?.close();
    this.transcriber = null;
  }

  private async resolveBot(): Promise<AiBot> {
    if (this.config.botId) {
      const bot = await prisma.aiBot.findFirst({
        where: {
          id: this.config.botId,
          organizationId: this.config.organizationId,
          channel: 'CALL',
        },
      });
      if (!bot) throw new Error('Calling bot not found.');
      return { ...bot, instructions: this.config.instructions.trim() || bot.instructions };
    }

    return buildPreviewAiBot(this.config.organizationId, 'CALL', {
      name: this.config.name,
      instructions: this.config.instructions,
      offerHandoff: true,
      businessHoursOnly: false,
    });
  }

  private async handleCallerText(raw: string): Promise<void> {
    const text = raw.trim();
    if (!text || this.processing || this.closed || !this.bot) return;

    this.processing = true;
    this.events.onUserFinal(text);
    this.events.onState('thinking');

    try {
      const result = await generateBotReply({
        organizationId: this.config.organizationId,
        conversationId: `calling-preview-${this.config.botId || 'draft'}`,
        inboundMessage: text,
        testMode: true,
        channel: 'voice',
        instructionsOverride: this.config.instructions.trim() || undefined,
        previewKnowledge: this.config.previewKnowledge,
        liveVoiceTurns: sanitizeAiBotTestHistory(this.history),
        whatsappNumberId: this.config.whatsappNumberId,
        previewBot: this.config.botId ? undefined : this.bot,
        botId: this.config.botId,
      });

      const reply =
        result.reply?.trim() ||
        (result.skipped && result.skipReason === 'calling_ai_disabled'
          ? 'Turn on AI calling on the Calls page first.'
          : 'Sorry, I could not answer that. Try rephrasing.');

      await this.speakAssistant(reply, { addToHistory: true, userText: text });
    } catch (err) {
      log.error('Calling preview brain failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.events.onError('Could not get a reply. Check Sarvam is configured and try again.');
      this.events.onState('listening');
    } finally {
      this.processing = false;
    }
  }

  private async speakAssistant(
    text: string,
    opts: { addToHistory: boolean; userText?: string }
  ): Promise<void> {
    const preview = await previewSpeechSarvam(text, {
      speaker: this.config.voiceSpeaker || undefined,
      language: this.config.voiceLanguage || undefined,
    });
    if (opts.addToHistory && opts.userText) {
      this.history.push({ role: 'user', content: opts.userText });
      if (this.history.length > 12) this.history.splice(0, this.history.length - 12);
    }
    if (opts.addToHistory) {
      this.history.push({ role: 'assistant', content: text });
      if (this.history.length > 12) this.history.splice(0, this.history.length - 12);
    }
    this.events.onState('speaking');
    this.events.onAssistant({
      text,
      audioBase64: preview.audioBase64,
      contentType: preview.contentType,
    });
  }
}
