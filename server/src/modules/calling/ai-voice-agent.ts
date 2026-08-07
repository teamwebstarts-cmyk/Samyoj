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

/** Split text into sentence-sized chunks for per-utterance TTS synthesis. */
function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= 500) return [trimmed];

  // Split on sentence boundaries: period, question mark, exclamation, semicolon,
  // or Hindi/Marathi-style sentence endings (। and ॥).
  const raw = trimmed.split(/(?<=[.!?;।॥])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const part of raw) {
    if (current && (current.length + part.length > 450)) {
      chunks.push(current.trimEnd());
      current = part;
    } else {
      current = current ? `${current} ${part}` : part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [trimmed];
}

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
  // Latency tracking
  private sttLatenciesMs: number[] = [];
  private ttsLatenciesMs: number[] = [];
  private lastSpeechTimestamp: number | null = null;
  // Call recording buffer
  private recordingBuffer: Buffer[] = [];
  private recordingSampleRate = 48000;

  constructor(ctx: ActiveCallContext) {
    this.ctx = ctx;
  }

  async start(sdpOffer: string): Promise<void> {
    if (!isSarvamSttConfigured() || !isSarvamTtsConfigured()) {
      throw new Error('Sarvam voice is not configured. Set SARVAM_API_KEY in server/.env.');
    }

    this.bridge = new WhatsAppWebRtcBridge();

    this.bridge.setDisconnectHandler((reason) => {
      if (!this.ended) {
        log.warn('WebRTC connection lost, ending call session', { callId: this.ctx.callId, reason });
        void this.end(reason);
      }
    });

    this.transcriber = new SarvamStreamTranscriber({
      onFinal: (text) => {
        // Track STT latency: time from when speech started to when final transcript arrived
        if (this.lastSpeechTimestamp) {
          const latency = Date.now() - this.lastSpeechTimestamp;
          this.sttLatenciesMs.push(latency);
          this.lastSpeechTimestamp = null;
        }
        void this.handleUserSpeech(text);
      },
      onSpeechStart: () => {
        this.lastSpeechTimestamp = Date.now();
      },
        // Do NOT reset this.speaking here. Resetting it while the bot is still
        // playing TTS lets the bot's own audio echo back into STT, causing the
        // repeated-transcript loop (e.g. "perfect perfect perfect..."). The
        // bridge guard (this.speaking) keeps echo out during playback.
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
      // Buffer inbound audio for call recording
      const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
      this.recordingBuffer.push(buf);
      this.recordingSampleRate = sampleRate;
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

        // Check if any agents are actually online before promising to connect.
        try {
          const { getEligibleAgents } = await import('../team/assignment');
          const agents = await getEligibleAgents(this.ctx.organizationId);
          const onlineAgents = agents.filter((a) => a.availability === 'ONLINE');

          if (onlineAgents.length > 0) {
            // Agents available — connect them
            await this.speak(
              'Please hold — let me connect you with our team.',
              'assistant'
            );
            await this.performHandoffAndTransfer('TOOL_REQUEST_HUMAN', reason);
          } else {
            // No agents online — offer callback gracefully
            await this.speak(
              "Our team isn't available on call right now. Would you like us to call you back? Just tell me a time that works.",
              'assistant'
            );
            // Let customer respond — the next speech turn will either:
            // - Trigger schedule_callback if the brain recognizes a time request
            // - Or the caller stays silent → we follow up via WhatsApp
            this.scheduleSilenceTimeout();
          }
        } catch {
          // Fallback if agent check fails — still try to connect
          await this.speak(
            'Please hold — let me connect you with our team.',
            'assistant'
          );
          await this.performHandoffAndTransfer('TOOL_REQUEST_HUMAN', reason);
        }
        break;
      }

      case 'schedule_callback': {
        const when = (tool.arguments.when as string) || 'as soon as possible';
        await this.speak(
          `I've noted your request. Someone from our team will call you ${when}. They'll also message you here on WhatsApp.`,
          'assistant'
        );
        await this.performHandoffAndTransfer('SCHEDULE_CALLBACK', `Schedule callback: ${when}`);
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

  /** If the caller stays silent after being offered a callback, wrap up gracefully. */
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleSilenceTimeout(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      if (!this.ended) {
        void this.speak(
          "I'll have someone message you on WhatsApp shortly. Thanks for calling!",
          'assistant'
        ).then(() => {
          void this.end('no_agents_callback_offered');
        });
      }
    }, 8000);
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

    // Split long replies into sentences so each is a separate Sarvam TTS call.
    // Bulbul v3 handles up to 2500 chars but shorter per-request keeps latency low.
    const sentences = splitIntoSentences(text);
    for (const sentence of sentences) {
      if (this.ended || !this.bridge) break;
      const ttsStart = Date.now();
      const audio = await synthesizeSpeechSarvam(sentence, {
        speaker: this.ctx.ttsVoice,
        language: this.ctx.ttsLanguage,
      });
      this.ttsLatenciesMs.push(Date.now() - ttsStart);
      await this.bridge.playPcm(audio.samples, audio.sampleRate);
    }

    this.speaking = false;
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

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

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

    // Persist call recording if we captured any audio
    if (this.recordingBuffer.length > 0) {
      try {
        const rawPcm = Buffer.concat(this.recordingBuffer);
        const { default: fs } = await import('fs/promises');
        const { default: path } = await import('path');
        const uploadsDir = path.resolve(process.cwd(), 'uploads', 'calls');
        await fs.mkdir(uploadsDir, { recursive: true });
        await fs.writeFile(path.join(uploadsDir, `${this.ctx.callId}.pcm`), rawPcm);
        log.info('Call recording saved', {
          callId: this.ctx.callId,
          sizeBytes: rawPcm.length,
          durationSec: Math.round(rawPcm.length / (this.recordingSampleRate * 2)),
        });
      } catch (err) {
        log.warn('Failed to save call recording', {
          callId: this.ctx.callId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await unregisterActiveCall(this.ctx.metaCallId, this.ctx.organizationId);

    const priorCall = await prisma.call.findUnique({ where: { id: this.ctx.callId } });
    const priorMetadata = ((priorCall?.metadata as Record<string, unknown> | null) || {}) as Record<
      string,
      unknown
    >;
    const durationSeconds =
      this.recordingBuffer.length > 0
        ? Math.round(
            Buffer.concat(this.recordingBuffer).length / (this.recordingSampleRate * 2)
          )
        : priorCall?.durationSeconds ?? undefined;

    await prisma.call.update({
      where: { id: this.ctx.callId },
      data: {
        status: reason === 'handoff' ? 'COMPLETED' : 'TERMINATED',
        endedAt: new Date(),
        ...(durationSeconds != null ? { durationSeconds } : {}),
        // Store voice quality metrics in call metadata
        metadata: {
          ...priorMetadata,
          voiceMetrics: {
            avgSttLatencyMs: this.sttLatenciesMs.length
              ? Math.round(this.sttLatenciesMs.reduce((a, b) => a + b, 0) / this.sttLatenciesMs.length)
              : 0,
            maxSttLatencyMs: this.sttLatenciesMs.length ? Math.max(...this.sttLatenciesMs) : 0,
            avgTtsLatencyMs: this.ttsLatenciesMs.length
              ? Math.round(this.ttsLatenciesMs.reduce((a, b) => a + b, 0) / this.ttsLatenciesMs.length)
              : 0,
            maxTtsLatencyMs: this.ttsLatenciesMs.length ? Math.max(...this.ttsLatenciesMs) : 0,
            utteranceCount: this.ttsLatenciesMs.length,
          },
        },
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
