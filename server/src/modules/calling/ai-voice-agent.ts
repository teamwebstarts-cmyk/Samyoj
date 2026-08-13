import prisma from '../../config/database';
import { unregisterActiveCall } from './session-store';
import { createModuleLogger } from '../../utils/logger';
import { emitToOrg } from '../../realtime';
import { createChatCompletion } from '../ai/chat-completion.service';
import { performHandoff, streamVoiceBotReply } from '../ai/chatbot.service';
import { shouldEndVoiceCallOnHandoff, validateOutboundReply } from '../ai/guardrails';
import { MetaCallingService } from './meta-calling.service';
import { SarvamStreamTranscriber, isSarvamSttConfigured } from './sarvam.stt';
import { synthesizeSpeechSarvam, isSarvamTtsConfigured } from './sarvam.tts';
import { WhatsAppWebRtcBridge } from './webrtc-bridge';
import { publishCallEventMessage } from './call-event-message';
import type { ActiveCallContext, TranscriptEntry } from './types';
import type { ToolCallResult } from '../ai/sarvam-chat.service';
import { extractInlineToolCalls, hasOpenToolCallMarkup } from '../ai/voice-tool-parse';

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
      onFinal: (text, languageDetected) => {
        // Track STT latency: time from when speech started to when final transcript arrived
        if (this.lastSpeechTimestamp) {
          const latency = Date.now() - this.lastSpeechTimestamp;
          this.sttLatenciesMs.push(latency);
          this.lastSpeechTimestamp = null;
        }
        // Auto-detect and switch TTS language based on detected STT language
        if (languageDetected && languageDetected !== 'unknown' && languageDetected !== 'auto') {
          this.ctx.ttsLanguage = languageDetected;
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
      // Only buffer PCM when recording is explicitly consent-enabled.
      if (this.ctx.recordingEnabled) {
        const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
        this.recordingBuffer.push(buf);
        this.recordingSampleRate = sampleRate;
      }
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
      // Fast-path tools without waiting on LLM when intent is obvious.
      const lower = trimmed.toLowerCase();
      if (
        /\b(human|agent|person|manager|representative|team member|talk to (a |someone|an )?human|speak to (a |someone|an )?human)\b/i.test(
          lower
        )
      ) {
        await this.handleToolCall({
          id: 'kw',
          name: 'request_human',
          arguments: { reason: 'Customer asked for a human on the call' },
        });
        return;
      }
      if (
        /\b(call( me)? back|callback|call later|schedule(\s+(a\s+)?)?(call|callback)?|वापस\s*कॉल|कॉल\s*बैक)\b/i.test(
          lower
        ) ||
        /schedule|callback_time|call.*head|head.*call|manager.*call|call.*manager/i.test(lower)
      ) {
        await this.handleToolCall({
          id: 'kw',
          name: 'schedule_callback',
          arguments: { when: trimmed },
        });
        return;
      }

      // Stream LLM → speak each new sentence once (never re-speak earlier chunks).
      let rawAccum = '';
      let spokenParts: string[] = [];
      let directHandled = false;

      const unspokenRemainder = (cleanFull: string): string => {
        let rest = cleanFull.trim();
        for (const part of spokenParts) {
          const p = part.trim();
          if (!p) continue;
          if (rest.startsWith(p)) {
            rest = rest.slice(p.length).trimStart();
            continue;
          }
          // Allow a single space/join mismatch between streamed chunks.
          const joined = `${p} `;
          if (rest.startsWith(joined)) {
            rest = rest.slice(joined.length).trimStart();
          }
        }
        return rest.trim();
      };

      const speakNewSentences = async (cleanFull: string, flushAll: boolean) => {
        let rest = unspokenRemainder(cleanFull);
        if (!rest) return;

        if (!flushAll) {
          const parts = rest.split(/(?<=[.!?।॥])\s+/);
          if (parts.length > 1) {
            const ready = parts.slice(0, -1).join(' ').trim();
            rest = parts[parts.length - 1] || '';
            if (ready && !/<tool_call>/i.test(ready)) {
              if (!validateOutboundReply(ready).safe) {
                await this.speak(
                  "I'll have our team follow up with you on WhatsApp shortly.",
                  'assistant'
                );
                await this.performHandoffAndTransfer('BLOCKED_CONTENT', 'BLOCKED_CONTENT');
                throw new Error('blocked_outbound');
              }
              spokenParts.push(ready);
              await this.speak(ready, 'assistant', { recordTranscript: false });
            }
          } else if (rest.length > 100 && /\s/.test(rest) && !/<tool_call>/i.test(rest)) {
            const cut = rest.lastIndexOf(' ');
            if (cut > 30) {
              const ready = rest.slice(0, cut).trim();
              if (ready) {
                if (!validateOutboundReply(ready).safe) {
                  await this.speak(
                    "I'll have our team follow up with you on WhatsApp shortly.",
                    'assistant'
                  );
                  await this.performHandoffAndTransfer('BLOCKED_CONTENT', 'BLOCKED_CONTENT');
                  throw new Error('blocked_outbound');
                }
                spokenParts.push(ready);
                await this.speak(ready, 'assistant', { recordTranscript: false });
              }
            }
          }
          return;
        }

        // Final flush — only the never-spoken tail.
        if (!validateOutboundReply(rest).safe) {
          if (spokenParts.length === 0) {
            await this.speak(
              "I'll have our team follow up with you on WhatsApp shortly.",
              'assistant'
            );
          }
          await this.performHandoffAndTransfer('BLOCKED_CONTENT', 'BLOCKED_CONTENT');
          throw new Error('blocked_outbound');
        }
        spokenParts.push(rest);
        await this.speak(rest, 'assistant', { recordTranscript: false });
      };

      for await (const event of streamVoiceBotReply({
        organizationId: this.ctx.organizationId,
        conversationId: this.ctx.conversationId,
        inboundMessage: trimmed,
        channel: 'voice',
        botId: this.ctx.aiBotId ?? undefined,
      })) {
        if (event.type === 'direct' && event.result) {
          directHandled = true;
          const result = event.result;
          if (result.skipReason === 'blocked_after_stream' && spokenParts.length > 0) {
            if (result.handoff && shouldEndVoiceCallOnHandoff(result.handoffReason)) {
              await this.performHandoffAndTransfer(
                result.handoffReason || 'BLOCKED_CONTENT',
                result.handoffReason || 'BLOCKED_CONTENT'
              );
            }
            break;
          }
          if (result.skipped && !result.reply) {
            await this.speak(
              result.skipReason === 'ai_not_configured'
                ? 'Sorry, our AI assistant is not configured yet. Please message us on WhatsApp.'
                : 'Sorry, I am having trouble right now. Please try again in a moment.',
              'assistant'
            );
            break;
          }
          if (result.reply) {
            const cleaned = extractInlineToolCalls(result.reply);
            if (cleaned.cleanText) await this.speak(cleaned.cleanText, 'assistant');
            for (const tool of cleaned.tools) {
              await this.handleToolCall({ id: 'inline', name: tool.name, arguments: tool.arguments });
            }
          }
          if (result.toolCalls?.length) {
            for (const tool of result.toolCalls) await this.handleToolCall(tool);
          }
          if (result.handoff && shouldEndVoiceCallOnHandoff(result.handoffReason)) {
            await this.performHandoffAndTransfer(
              result.handoffReason || 'VOICE_HANDOFF',
              result.handoffReason || 'VOICE_HANDOFF'
            );
          }
          break;
        }

        if (event.type === 'delta' && event.content) {
          rawAccum += event.content;
          if (hasOpenToolCallMarkup(rawAccum)) continue;
          const stripped = extractInlineToolCalls(rawAccum);
          try {
            await speakNewSentences(stripped.cleanText, false);
          } catch (err) {
            if (err instanceof Error && err.message === 'blocked_outbound') return;
            throw err;
          }
        }

        if (event.type === 'done') {
          const parsed = extractInlineToolCalls((event.content || rawAccum || '').trim());
          const tools = [
            ...(event.tools || []),
            ...parsed.tools.map((t, i) => ({
              id: `inline-${i}`,
              name: t.name,
              arguments: t.arguments,
            })),
          ];
          try {
            await speakNewSentences(parsed.cleanText, true);
          } catch (err) {
            if (err instanceof Error && err.message === 'blocked_outbound') return;
            throw err;
          }

          const full = spokenParts.join(' ').trim();
          if (full) {
            await this.appendTranscript('assistant', full);
            log.info('Speaking AI reply on call (streamed)', {
              callId: this.ctx.callId,
              chars: full.length,
            });
          } else if (!spokenParts.length && tools.length === 0) {
            await this.speak(
              'Sorry, I am having trouble right now. Please try again in a moment.',
              'assistant'
            );
          }

          for (const tool of tools) await this.handleToolCall(tool);

          if (
            event.result?.handoff &&
            tools.length === 0 &&
            shouldEndVoiceCallOnHandoff(event.result.handoffReason)
          ) {
            if (spokenParts.length === 0 && event.result.reply) {
              const cleaned = extractInlineToolCalls(event.result.reply).cleanText;
              if (cleaned) await this.speak(cleaned, 'assistant');
            }
            await this.performHandoffAndTransfer(
              event.result.handoffReason || 'LOW_CONFIDENCE',
              event.result.handoffReason || 'LOW_CONFIDENCE'
            );
          }
        }
      }

      if (!directHandled && spokenParts.length === 0 && !this.ended) {
        await this.speak('Sorry, I am having trouble right now. Please try again in a moment.', 'assistant');
      }
    } catch (err) {
      log.error('Voice reply failed', {
        callId: this.ctx.callId,
        error: err instanceof Error ? err.message : String(err),
      });
      try {
        await this.speak(
          "Sorry, I'm having trouble right now. Please try messaging us on WhatsApp.",
          'assistant'
        );
      } catch {
        // Speak may also fail if media is broken — still end below.
      }
      await this.end('voice_error');
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
            // Message-only handoff — do not promise a live connect until media transfer works.
            await this.speak(
              "I'll connect you with our team on WhatsApp chat now. Thanks for calling — someone will reply shortly.",
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
          // Fallback if agent check fails — still hand off via Inbox (no live hold promise).
          await this.speak(
            "I'll have our team follow up with you on WhatsApp shortly.",
            'assistant'
          );
          await this.performHandoffAndTransfer('TOOL_REQUEST_HUMAN', reason);
        }
        break;
      }

      case 'schedule_callback': {
        const when =
          (tool.arguments.when as string) ||
          (tool.arguments.callback_time as string) ||
          'as soon as possible';
        const reason =
          typeof tool.arguments.reason === 'string'
            ? tool.arguments.reason
            : typeof tool.arguments.notes === 'string'
              ? tool.arguments.notes
              : undefined;

        try {
          const ticket = await prisma.ticket.create({
            data: {
              organizationId: this.ctx.organizationId,
              conversationId: this.ctx.conversationId,
              contactId: this.ctx.contactId,
              whatsappNumberId: this.ctx.whatsappNumberId,
              title: `Callback requested: ${when}`,
              category: 'callback',
              priority: 'HIGH',
              status: 'OPEN',
            },
          });

          const noteAuthor = await prisma.organizationUser.findFirst({
            where: {
              organizationId: this.ctx.organizationId,
              role: { in: ['OWNER', 'ADMIN'] },
            },
            orderBy: { role: 'asc' },
            select: { userId: true },
          });
          if (noteAuthor) {
            await prisma.internalNote.create({
              data: {
                conversationId: this.ctx.conversationId,
                userId: noteAuthor.userId,
                content: [
                  'Callback requested via AI voice agent.',
                  `When: ${when}`,
                  reason ? `Reason: ${reason}` : null,
                  `Ticket: ${ticket.id}`,
                  `Call: ${this.ctx.callId}`,
                ]
                  .filter(Boolean)
                  .join('\n'),
              },
            });
          }

          emitToOrg(this.ctx.organizationId, 'call:callback_requested', {
            callId: this.ctx.callId,
            conversationId: this.ctx.conversationId,
            contactId: this.ctx.contactId,
            ticketId: ticket.id,
            when,
            reason: reason || undefined,
          });

          log.info('Scheduled callback task created', {
            callId: this.ctx.callId,
            ticketId: ticket.id,
            when,
          });
        } catch (err) {
          log.error('Failed to persist schedule_callback task', {
            callId: this.ctx.callId,
            error: err instanceof Error ? err.message : String(err),
          });
          emitToOrg(this.ctx.organizationId, 'call:callback_requested', {
            callId: this.ctx.callId,
            conversationId: this.ctx.conversationId,
            contactId: this.ctx.contactId,
            when,
            reason: reason || undefined,
          });
        }

        await this.speak(
          `I've noted your request. Someone from our team will call you ${when}. They'll also message you here on WhatsApp.`,
          'assistant'
        );
        await this.performHandoffAndTransfer(
          'SCHEDULE_CALLBACK',
          `Schedule callback: ${when}${reason ? ` — ${reason}` : ''}`
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
   * Perform handoff (assign agent) then end call (message-only path).
   * Live voice transfer is disabled until media works — never call handleLiveTransfer.
   */
  private async performHandoffAndTransfer(
    reason: string,
    _detail: string,
    _opts?: { preferTeam?: string }
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

    await this.end('handoff');
  }

  private async speak(
    text: string,
    role: TranscriptEntry['role'],
    opts?: { recordTranscript?: boolean }
  ): Promise<void> {
    if (!this.bridge || this.ended) return;
    this.speaking = true;
    try {
      if (opts?.recordTranscript !== false) {
        await this.appendTranscript(role, text);
      }

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

          // Agent-only: internal note (never show as an inbound customer chat bubble).
          if (this.ctx.conversationId) {
            await this.persistCallSummaryNote(summary, reason);
          }
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

    // Persist call recording only when consent-gated recording was enabled.
    if (this.ctx.recordingEnabled && this.recordingBuffer.length > 0) {
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
   * Generate a brief summary from the transcript for the agent inbox (internal note).
   */
  private async generateSummary(): Promise<string | null> {
    try {
      const transcriptText = this.transcript
        .map((t) => `${t.role === 'assistant' ? 'AI' : 'Customer'}: ${t.text}`)
        .join('\n')
        .slice(-3000);
      if (!transcriptText.trim()) return null;

      const completion = await createChatCompletion({
        organizationId: this.ctx.organizationId,
        conversationId: this.ctx.conversationId,
        botId: this.ctx.aiBotId ?? undefined,
        messages: [
          {
            role: 'system',
            content:
              'Summarize this phone call transcript in 2-3 short sentences for the support agent. State what the customer wanted and what was promised. Do not address the customer or offer to connect them with anyone.',
          },
          { role: 'user', content: transcriptText },
        ],
        maxTokens: 150,
        temperature: 0.3,
      });

      return completion.content?.trim() || null;
    } catch {
      return null;
    }
  }

  private async persistCallSummaryNote(summary: string, reason: string): Promise<void> {
    if (!this.ctx.conversationId) return;

    const noteAuthor = await prisma.organizationUser.findFirst({
      where: {
        organizationId: this.ctx.organizationId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      orderBy: { role: 'asc' },
      select: { userId: true },
    });
    if (!noteAuthor) return;

    await prisma.internalNote.create({
      data: {
        conversationId: this.ctx.conversationId,
        userId: noteAuthor.userId,
        content: `📞 Call summary (${reason}):\n${summary}\n\nCall ID: ${this.ctx.callId}`,
      },
    });
  }
}
