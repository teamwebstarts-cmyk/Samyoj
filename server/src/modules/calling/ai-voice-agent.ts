import prisma from '../../config/database';
import { unregisterActiveCall } from './session-store';
import { createModuleLogger } from '../../utils/logger';
import { emitToOrg } from '../../realtime';
import { generateBotReply, performHandoff } from '../ai/chatbot.service';
import { MetaCallingService } from './meta-calling.service';
import { SarvamStreamTranscriber, isSarvamSttConfigured } from './sarvam.stt';
import { synthesizeSpeechSarvam, isSarvamTtsConfigured } from './sarvam.tts';
import { WhatsAppWebRtcBridge } from './webrtc-bridge';
import { handleLiveTransfer } from './call.processor';
import { publishCallEventMessage } from './call-event-message';
import type { ActiveCallContext, TranscriptEntry } from './types';
import type { ToolCallResult } from '../ai/sarvam-chat.service';

const log = createModuleLogger('ai-voice-agent');

/** Voice tool definitions sent to Sarvam for function calling. */
const VOICE_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'request_human',
      description:
        'Call this when the caller explicitly asks to speak with a human, agent, person, manager, or team. Also call when you cannot help with their request.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the caller needs a human' },
          urgency: { type: 'string', enum: ['normal', 'urgent'], description: 'How urgent the request is' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'schedule_callback',
      description:
        'Call this when the caller asks for a callback, wants to be called later, or asks to schedule a call.',
      parameters: {
        type: 'object',
        properties: {
          when: { type: 'string', description: 'When the caller wants to be called back (e.g. "tomorrow morning", "in 2 hours")' },
        },
        required: ['when'],
      },
    },
  },
];

export class AiVoiceCallSession {
  private bridge: WhatsAppWebRtcBridge | null = null;
  private transcriber: SarvamStreamTranscriber | null = null;
  private transcript: TranscriptEntry[] = [];
  private processing = false;
  private speaking = false;
  private ended = false;
  private readonly ctx: ActiveCallContext;

  constructor(ctx: ActiveCallContext) {
    this.ctx = ctx;
  }

  async start(sdpOffer: string): Promise<void> {
    if (!isSarvamSttConfigured() || !isSarvamTtsConfigured()) {
      throw new Error('Sarvam voice is not configured. Set SARVAM_API_KEY in server/.env.');
    }

    this.bridge = new WhatsAppWebRtcBridge();

    this.transcriber = new SarvamStreamTranscriber({
      onFinal: (text) => {
        void this.handleUserSpeech(text);
      },
      onSpeechStart: () => {
        // Signal barge-in intent; full interrupt = close TTS socket on next speak turn
        if (this.speaking) this.speaking = false;
      },
      onError: (err) => {
        log.error('Sarvam transcriber error during call', { callId: this.ctx.callId, error: err.message });
      },
    });
    await this.transcriber.connect({
      language: this.ctx.sttLanguage || undefined,
      mode: this.ctx.sttMode || undefined,
      prompt: this.ctx.sttPrompt || undefined,
    });

    this.bridge.setAudioHandler((samples, sampleRate) => {
      if (this.ended || this.speaking || !this.transcriber) return;
      this.transcriber.sendPcm(samples, sampleRate);
    });

    const sdpAnswer = await this.bridge.createAnswerFromOffer(sdpOffer);

    await MetaCallingService.preAccept(
      this.ctx.phoneNumberId,
      this.ctx.accessToken,
      this.ctx.metaCallId,
      sdpAnswer
    );

    await MetaCallingService.accept(
      this.ctx.phoneNumberId,
      this.ctx.accessToken,
      this.ctx.metaCallId,
      sdpAnswer
    );

    await prisma.call.update({
      where: { id: this.ctx.callId },
      data: {
        status: 'CONNECTED',
        answeredAt: new Date(),
        startedAt: new Date(),
        handler: 'AI',
      },
    });

    if (this.ctx.consentMessage) {
      await this.speak(this.ctx.consentMessage, 'system');
    }
    await this.speak(this.ctx.greeting || 'Hello! How can I help you today?', 'system');
    log.info('AI voice call session started', { callId: this.ctx.callId });
  }

  private async handleUserSpeech(text: string): Promise<void> {
    if (this.ended || this.processing || this.speaking) return;
    const trimmed = text.trim();
    if (trimmed.length < 2) return;

    log.info('Processing caller speech', { callId: this.ctx.callId, text: trimmed });

    this.processing = true;
    await this.appendTranscript('user', trimmed);

    try {
      const result = await generateBotReply({
        organizationId: this.ctx.organizationId,
        conversationId: this.ctx.conversationId,
        inboundMessage: trimmed,
        channel: 'voice',
        botId: this.ctx.aiBotId ?? undefined,
        tools: VOICE_TOOLS,
      });

      if (result.skipped && !result.reply) {
        log.warn('Voice bot reply skipped', {
          callId: this.ctx.callId,
          skipReason: result.skipReason,
        });
        await this.speak(
          result.skipReason === 'ai_not_configured'
            ? 'Sorry, our AI assistant is not configured yet. Please message us on WhatsApp.'
            : 'Sorry, I am having trouble right now. Please try again in a moment.',
          'assistant'
        );
        return;
      }

      if (result.skipped && result.reply) {
        await this.speak(result.reply, 'assistant');
        return;
      }

      // Function calling: Sarvam returned a tool call
      if (result.toolCalls?.length) {
        await this.handleToolCall(result.toolCalls[0]);
        return;
      }

      const reply = result.reply?.trim();
      if (reply) {
        log.info('Speaking AI reply on call', { callId: this.ctx.callId, chars: reply.length });
        await this.speak(reply, 'assistant');
      }

      if (result.handoff) {
        await this.performHandoffAndTransfer(
          'VOICE_HANDOFF',
          result.handoffReason || 'VOICE_HANDOFF'
        );
      }
    } catch (err) {
      log.error('Voice reply failed', {
        callId: this.ctx.callId,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.processing = false;
    }
  }

  /**
   * Dispatch Sarvam function-call results: request_human, schedule_callback.
   */
  private async handleToolCall(tool: ToolCallResult): Promise<void> {
    log.info('Voice tool call', { callId: this.ctx.callId, tool: tool.name });

    switch (tool.name) {
      case 'request_human': {
        const reason = (tool.arguments.reason as string) || 'Customer requested human';

        await this.speak(
          'Please hold — let me connect you with our team.',
          'assistant'
        );

        await this.performHandoffAndTransfer('TOOL_REQUEST_HUMAN', reason);
        break;
      }

      case 'schedule_callback': {
        const when = (tool.arguments.when as string) || 'as soon as possible';
        await this.performHandoffAndTransfer('SCHEDULE_CALLBACK', `Schedule callback: ${when}`);
        await this.speak(
          `I've noted your request. Someone from our team will call you ${when}. They'll also message you here on WhatsApp.`,
          'assistant'
        );
        await this.end('scheduled_callback');
        break;
      }

      default:
        log.warn('Unknown voice tool call', { callId: this.ctx.callId, tool: tool.name });
        await this.speak(
          'I understand. Let me get someone to help you.',
          'assistant'
        );
        await this.performHandoffAndTransfer('FALLBACK', 'Unknown tool');
        break;
    }
  }

  /**
   * Perform handoff (assign agent) then optionally trigger cold live transfer.
   */
  private async performHandoffAndTransfer(
    reason: string,
    detail: string,
    opts?: { preferTeam?: string }
  ): Promise<void> {
    const handoff = await performHandoff(
      this.ctx.organizationId,
      this.ctx.conversationId,
      reason
    );

    if (handoff?.assignedAgent?.id) {
      await prisma.call.update({
        where: { id: this.ctx.callId },
        data: { assignedAgentId: handoff.assignedAgent.id },
      });
    }

    // Check if live transfer is enabled in settings
    try {
      const { getOrgCallingSettings } = await import('./settings.service');
      const settings = await getOrgCallingSettings(this.ctx.organizationId);
      const liveTransferEnabled = settings.liveTransferEnabled === true;
      const transferLive = settings.transferMode === 'live';

      if (liveTransferEnabled && transferLive && this.bridge && !this.ended) {
        // Try cold live transfer — keep bridge alive, ring agents on same Meta call
        await handleLiveTransfer({
          orgId: this.ctx.organizationId,
          callRecord: { id: this.ctx.callId, metaCallId: this.ctx.metaCallId },
          conversation: { id: this.ctx.conversationId },
          contact: { id: this.ctx.contactId },
          phoneNumberId: this.ctx.phoneNumberId,
          whatsappNumberId: this.ctx.whatsappNumberId,
          accessToken: this.ctx.accessToken,
          fromPhone: this.ctx.fromPhone,
          toPhone: this.ctx.toPhone,
          direction: this.ctx.direction,
          reason: detail,
          transcriptSummary: this.transcript.slice(-5).map((t) => `${t.role}: ${t.text}`).join('\n'),
          botId: this.ctx.aiBotId ?? '',
          ttsVoice: this.ctx.ttsVoice,
          ttsLanguage: this.ctx.ttsLanguage,
          preferTeam: opts?.preferTeam,
        });
        return; // handleLiveTransfer will resume or end the call
      }
    } catch {
      // Live transfer not available — fall through to end with message
    }

    // Fallback: end call with handoff message
    await this.end('handoff');
  }

  private async speak(text: string, role: TranscriptEntry['role']): Promise<void> {
    if (!this.bridge || this.ended) return;
    this.speaking = true;
    await this.appendTranscript(role, text);

    try {
      const audio = await synthesizeSpeechSarvam(text, {
        speaker: this.ctx.ttsVoice,
        language: this.ctx.ttsLanguage,
      });
      await this.bridge.playPcm(audio.samples, audio.sampleRate);
    } finally {
      this.speaking = false;
    }
  }

  private async appendTranscript(role: TranscriptEntry['role'], text: string): Promise<void> {
    this.transcript.push({ role, text, at: new Date().toISOString() });
    try {
      await prisma.call.update({
        where: { id: this.ctx.callId },
        data: { transcript: this.transcript as object },
      });
      emitToOrg(this.ctx.organizationId, 'call:transcript', {
        callId: this.ctx.callId,
        transcript: this.transcript,
      });
    } catch (err) {
      log.error('Failed to save call transcript', {
        callId: this.ctx.callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  dispose(): void {
    this.ended = true;
    this.transcriber?.close();
    this.bridge?.close();
    this.transcriber = null;
    this.bridge = null;
  }

  async end(reason = 'normal'): Promise<void> {
    if (this.ended) return;
    this.ended = true;

    // Post-call summary: store AI summary in metadata
    if (this.transcript.length > 0) {
      try {
        const summary = await this.generateSummary();
        if (summary) {
          const call = await prisma.call.findUnique({ where: { id: this.ctx.callId } });
          const metadata = ((call?.metadata as Record<string, unknown>) || {});
          await prisma.call.update({
            where: { id: this.ctx.callId },
            data: { metadata: { ...metadata, summary } },
          });
        }
      } catch (err) {
        log.warn('Post-call summary generation failed', {
          callId: this.ctx.callId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    try {
      await MetaCallingService.terminate(
        this.ctx.phoneNumberId,
        this.ctx.accessToken,
        this.ctx.metaCallId
      );
    } catch (err) {
      log.warn('Terminate call failed (may already be ended)', {
        callId: this.ctx.callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.transcriber?.close();
    this.bridge?.close();
    this.transcriber = null;
    this.bridge = null;

    await unregisterActiveCall(this.ctx.metaCallId, this.ctx.organizationId);

    await prisma.call.update({
      where: { id: this.ctx.callId },
      data: {
        status: reason === 'handoff' ? 'COMPLETED' : 'TERMINATED',
        endedAt: new Date(),
      },
    });

    void publishCallEventMessage(this.ctx.callId);

    log.info('AI voice call session ended', { callId: this.ctx.callId, reason });
  }

  /**
   * Generate a brief summary from the transcript using the AI bot.
   */
  private async generateSummary(): Promise<string | null> {
    try {
      const transcriptText = this.transcript
        .map((t) => `${t.role}: ${t.text}`)
        .join('\n')
        .slice(-3000);

      const summaryResult = await generateBotReply({
        organizationId: this.ctx.organizationId,
        conversationId: this.ctx.conversationId,
        inboundMessage: `Summarize this call transcript in 2-3 short sentences:\n\n${transcriptText}`,
        channel: 'voice',
        botId: this.ctx.aiBotId ?? undefined,
      });

      return summaryResult.reply?.trim() || null;
    } catch {
      return null;
    }
  }
}
