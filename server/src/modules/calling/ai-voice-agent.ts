import prisma from '../../config/database';
import { unregisterActiveCall } from './session-store';
import { createModuleLogger } from '../../utils/logger';
import { emitToOrg } from '../../realtime';
import { computeSlaDueAt } from '../sla/service';
import { emitTicketEvent } from '../tickets/events';
import { createChatCompletion } from '../ai/chat-completion.service';
import { recordAiUsage, getOrgAiSettings, isCallingAiEnabled } from '../ai/org-ai.service';
import { charUsage } from '../ai/ai-usage-actions';
import { SAFE_CHAT_TEMPERATURE } from '../ai/ai-constants';
import { performHandoff, streamVoiceBotReply } from '../ai/chatbot.service';
import { shouldEndVoiceCallOnHandoff, validateOutboundReply } from '../ai/guardrails';
import { MetaCallingService } from './meta-calling.service';
import { SarvamStreamTranscriber, isSarvamSttConfigured } from './sarvam.stt';
import {
  synthesizeSpeechSarvam,
  isSarvamTtsConfigured,
  normalizeSarvamLanguageCode,
  type SynthesizedAudio,
} from './sarvam.tts';
import { WhatsAppWebRtcBridge } from './webrtc-bridge';
import { pcmRms } from './audio-utils';
import { publishCallEventMessage, publishCallSummaryMessage } from './call-event-message';
import type { ActiveCallContext, TranscriptEntry } from './types';
import type { ToolCallResult } from '../ai/sarvam-chat.service';
import { extractInlineToolCalls } from '../ai/voice-tool-parse';
import { liveVoiceTurnsFromTranscript } from '../ai/voice-context';
import { isVoiceBackchannel, wantsCallbackOnCall, wantsEndCall, wantsHumanOnCall } from './voice-intent';
import { config } from '../../config';
import {
  isLikelyTtsEcho,
  joinSpokenTurns,
  prepareSpokenText,
  shouldAllowBargeInDuringTts,
  shouldMuteCallStt,
  shouldProcessCallerUtterance,
  shouldQueueVoiceInterrupt,
  shouldTriggerBargeInFromRms,
  splitForTts,
  extractEarlySpeakableChunk,
  remainderAfterEarlySpoken,
  isCompleteSpeakableChunk,
  BARGE_IN_RMS_THRESHOLD,
} from './spoken-text';
import { isBusinessInfoQuestion, HONEST_NO_DETAILS } from '../ai/reply-repeat';
import {
  formatCallbackInternalNote,
  formatCallSummaryInternalNote,
} from './internal-note-copy';

const log = createModuleLogger('ai-voice-agent');

interface VoiceTurnTiming {
  sttFinalAt?: number;
  processingStartAt?: number;
  llmFirstTokenAt?: number;
  ttsFirstStartAt?: number;
  llmDoneAt?: number;
  ttsDoneAt?: number;
}

/** Spoken when LLM/STT hiccups — not a dead-end error. */
const VOICE_RETRY_PROMPT =
  'Ek second — main phir se sun raha hoon. Apna sawaal dobara boliye, ya team se baat chahiye ho to bol dijiye.';

function voiceEmptyReplyFallback(callerText: string): string {
  return isBusinessInfoQuestion(callerText) ? HONEST_NO_DETAILS : VOICE_RETRY_PROMPT;
}

const VOICE_TEAM_HANDOFF_SPOKEN =
  'Theek hai — main team ko bata deta hoon. Woh aapko WhatsApp par message karenge. Dhanyavaad.';

export class AiVoiceCallSession {
  private bridge: WhatsAppWebRtcBridge | null = null;
  private transcriber: SarvamStreamTranscriber | null = null;
  private transcript: TranscriptEntry[] = [];
  private processing = false;
  private speaking = false;
  private ended = false;
  private abortSpeak = false;
  private queuedSpeech: string | null = null;
  private lastSpokenText = '';
  private speakingStartedAt = 0;
  private speakingEndedAt = 0;
  private bargeInLoudFrameStreak = 0;
  private wrappingUp = false;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly ctx: ActiveCallContext;
  private speakChain: Promise<void> = Promise.resolve();
  private readonly echoTailMs = config.calling.voiceEchoTailMs;
  private readonly echoRejectMs = config.calling.voiceEchoTailMs + 900;
  // Latency tracking
  private sttLatenciesMs: number[] = [];
  private ttsLatenciesMs: number[] = [];
  private lastSpeechTimestamp: number | null = null;
  // Call recording buffer
  private recordingBuffer: Buffer[] = [];
  private recordingSampleRate = 48000;
  /** Locale at call start — used when mid-call STT language breaks Bulbul. */
  private readonly defaultTtsLanguage: string;
  /** True once playPcm delivers audio for the current caller turn. */
  private audioDeliveredThisTurn = false;

  constructor(ctx: ActiveCallContext) {
    this.ctx = ctx;
    this.defaultTtsLanguage = normalizeSarvamLanguageCode(ctx.ttsLanguage);
    this.ctx.ttsLanguage = this.defaultTtsLanguage;
  }

  private recordVoiceUnits(action: 'stt' | 'tts', inputChars: number, outputChars: number): void {
    void recordAiUsage({
      organizationId: this.ctx.organizationId,
      botId: this.ctx.aiBotId ?? undefined,
      conversationId: this.ctx.conversationId,
      whatsappNumberId: this.ctx.whatsappNumberId,
      action,
      usage: charUsage(inputChars, outputChars),
    });
  }

  async start(sdpOffer: string): Promise<void> {
    const aiSettings = await getOrgAiSettings(this.ctx.organizationId);
    if (!isCallingAiEnabled(aiSettings)) {
      throw new Error('Calling AI is disabled for this organization');
    }
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
          this.ctx.ttsLanguage = normalizeSarvamLanguageCode(languageDetected);
        }
        void this.recordVoiceUnits('stt', text.length, 0);
        if (this.ended || this.wrappingUp) return;

        const trimmed = text.trim();

        if (this.speaking) {
          if (!shouldAllowBargeInDuringTts(this.speaking, this.speakingStartedAt, Date.now())) {
            log.debug('Ignored STT final during early TTS', {
              callId: this.ctx.callId,
              text: trimmed.slice(0, 80),
            });
            return;
          }
          if (!shouldProcessCallerUtterance(trimmed) || isVoiceBackchannel(trimmed)) return;
          if (isLikelyTtsEcho(trimmed, this.lastSpokenText)) {
            log.debug('Ignored likely TTS echo during playback', {
              callId: this.ctx.callId,
              text: trimmed,
            });
            return;
          }
          this.stopBotSpeechForBargeIn('stt_final');
          if (this.processing) {
            this.queueInterrupt(text);
          } else {
            void this.handleUserSpeech(text, Date.now());
          }
          return;
        }

        if (shouldMuteCallStt(this.speaking, this.speakingEndedAt, Date.now(), this.echoTailMs)) {
          log.debug('Dropped STT final during echo tail', {
            callId: this.ctx.callId,
            text: trimmed.slice(0, 120),
          });
          return;
        }
        if (shouldQueueVoiceInterrupt(this.processing, this.speaking)) {
          this.queueInterrupt(text);
          return;
        }
        void this.handleUserSpeech(text, Date.now());
      },
      onSpeechStart: () => {
        this.lastSpeechTimestamp = Date.now();
        if (shouldAllowBargeInDuringTts(this.speaking, this.speakingStartedAt, Date.now())) {
          this.stopBotSpeechForBargeIn('vad');
        }
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
      if (this.ended || !this.transcriber) return;
      // Only buffer PCM when recording is explicitly consent-enabled.
      // Skip while we are playing TTS so the recording is the caller, not echo.
      if (this.ctx.recordingEnabled && !this.speaking) {
        const buf = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
        this.recordingBuffer.push(buf);
        this.recordingSampleRate = sampleRate;
      }

      if (this.speaking) {
        const rms = pcmRms(samples);
        if (rms >= BARGE_IN_RMS_THRESHOLD) {
          this.bargeInLoudFrameStreak += 1;
        } else {
          this.bargeInLoudFrameStreak = 0;
        }
        if (
          shouldTriggerBargeInFromRms(
            this.speaking,
            this.speakingStartedAt,
            rms,
            this.bargeInLoudFrameStreak,
            Date.now()
          )
        ) {
          this.stopBotSpeechForBargeIn('rms');
        }
      } else {
        this.bargeInLoudFrameStreak = 0;
      }

      if (shouldMuteCallStt(this.speaking, this.speakingEndedAt, Date.now(), this.echoTailMs)) return;
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

    const opening = joinSpokenTurns(
      this.ctx.consentMessage,
      this.ctx.greeting || 'Hi, thanks for calling. How can I help?'
    );
    if (opening) {
      try {
        await this.speak(opening, 'system');
      } catch (err) {
        log.warn('Opening greeting TTS failed — call stays connected', {
          callId: this.ctx.callId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    this.armMaxDurationTimer();
    log.info('AI voice call session started', { callId: this.ctx.callId });
  }

  private stopBotSpeechForBargeIn(reason: 'stt_final' | 'vad' | 'rms'): void {
    if (!this.speaking) return;
    log.info('Caller barge-in during TTS', { callId: this.ctx.callId, reason });
    this.abortSpeak = true;
    this.bridge?.stopPlayback();
    this.speaking = false;
    this.speakingStartedAt = 0;
    this.speakingEndedAt = Date.now();
    this.bargeInLoudFrameStreak = 0;
  }

  private logTurnTiming(timing: VoiceTurnTiming): void {
    if (!config.calling.voiceTimingLog) return;
    const ms = (from?: number, to?: number) =>
      from != null && to != null ? to - from : undefined;
    log.info('Voice turn timing', {
      callId: this.ctx.callId,
      preLlmMs: ms(timing.processingStartAt, timing.llmFirstTokenAt),
      llmStreamMs: ms(timing.llmFirstTokenAt, timing.llmDoneAt),
      llmToFirstTtsMs: ms(timing.llmFirstTokenAt, timing.ttsFirstStartAt),
      totalToFirstTtsMs: ms(timing.sttFinalAt, timing.ttsFirstStartAt),
      totalTurnMs: ms(timing.sttFinalAt, timing.ttsDoneAt),
    });
  }

  private enqueueSpeak(
    text: string,
    role: TranscriptEntry['role'],
    opts?: { recordTranscript?: boolean; wait?: boolean; onStart?: () => void }
  ): Promise<void> {
    const job = this.speakChain.then(async () => {
      opts?.onStart?.();
      await this.speak(text, role, { recordTranscript: opts?.recordTranscript });
    });
    this.speakChain = job.catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      log.error('Voice speak chain failed', {
        callId: this.ctx.callId,
        error: message,
        preview: text.slice(0, 80),
      });
      if (config.calling.voiceTimingLog) {
        log.info('Voice TTS chain failure', {
          callId: this.ctx.callId,
          language: this.ctx.ttsLanguage,
          error: message,
        });
      }
    });
    return opts?.wait === false ? Promise.resolve() : job;
  }

  private async handleUserSpeech(text: string, sttFinalAt?: number): Promise<void> {
    if (this.ended || this.wrappingUp || this.processing || this.speaking) return;
    const trimmed = text.trim();
    if (!shouldProcessCallerUtterance(trimmed)) {
      log.debug('Ignoring short STT fragment on call', { callId: this.ctx.callId, text: trimmed });
      return;
    }
    if (isVoiceBackchannel(trimmed)) {
      log.debug('Ignoring backchannel on call', { callId: this.ctx.callId, text: trimmed });
      return;
    }

    if (
      this.speakingEndedAt > 0 &&
      Date.now() - this.speakingEndedAt < this.echoRejectMs &&
      isLikelyTtsEcho(trimmed, this.lastSpokenText)
    ) {
      log.debug('Ignoring TTS echo on call', { callId: this.ctx.callId, text: trimmed });
      return;
    }

    log.info('Processing caller speech', { callId: this.ctx.callId, text: trimmed });

    const timing: VoiceTurnTiming = {
      sttFinalAt: sttFinalAt ?? Date.now(),
      processingStartAt: Date.now(),
    };

    this.processing = true;
    this.abortSpeak = false;
    this.audioDeliveredThisTurn = false;
    void this.appendTranscript('user', trimmed);

    try {
      if (wantsHumanOnCall(trimmed)) {
        await this.handleToolCall({
          id: 'kw',
          name: 'request_human',
          arguments: { reason: 'Customer asked for a human on the call' },
        });
        return;
      }
      if (wantsCallbackOnCall(trimmed)) {
        await this.handleToolCall({
          id: 'kw',
          name: 'schedule_callback',
          arguments: { when: trimmed },
        });
        return;
      }
      if (wantsEndCall(trimmed)) {
        await this.handleToolCall({
          id: 'kw',
          name: 'end_call',
          arguments: { reason: 'Customer asked to hang up' },
        });
        return;
      }

      let rawAccum = '';
      let spokenText = '';
      let earlySpoken = '';
      let directHandled = false;
      const streamTts = config.calling.voiceStreamTts;
      const earlyMinChars = config.calling.voiceEarlyTtsMinChars;

      for await (const event of streamVoiceBotReply({
        organizationId: this.ctx.organizationId,
        conversationId: this.ctx.conversationId,
        inboundMessage: trimmed,
        channel: 'voice',
        botId: this.ctx.aiBotId ?? undefined,
        liveVoiceTurns: liveVoiceTurnsFromTranscript(this.transcript, trimmed),
      })) {
        if (this.abortSpeak || this.ended) break;

        if (event.type === 'direct' && event.result) {
          directHandled = true;
          const result = event.result;
          if (this.abortSpeak || this.ended) break;
          if (result.skipped && !result.reply) {
            if (wantsHumanOnCall(trimmed)) {
              await this.handleToolCall({
                id: 'kw',
                name: 'request_human',
                arguments: { reason: 'Customer asked for team during AI skip' },
              });
              break;
            }
            await this.enqueueSpeak(
              result.skipReason === 'ai_not_configured'
                ? 'Sorry, our AI assistant is not configured yet. Please message us on WhatsApp.'
                : voiceEmptyReplyFallback(trimmed),
              'assistant'
            );
            break;
          }
          if (result.reply) {
            const cleaned = extractInlineToolCalls(result.reply);
            if (cleaned.cleanText && !this.abortSpeak) {
              spokenText = cleaned.cleanText;
              await this.enqueueSpeak(cleaned.cleanText, 'assistant', {
                recordTranscript: false,
                onStart: () => {
                  if (!timing.ttsFirstStartAt) timing.ttsFirstStartAt = Date.now();
                },
              });
            }
            if (this.abortSpeak || this.ended) break;
            for (const tool of cleaned.tools) {
              await this.handleToolCall({ id: 'inline', name: tool.name, arguments: tool.arguments });
            }
          }
          if (result.toolCalls?.length && !this.abortSpeak && !this.ended) {
            for (const tool of result.toolCalls) await this.handleToolCall(tool);
          }
          if (
            result.handoff &&
            shouldEndVoiceCallOnHandoff(result.handoffReason) &&
            !this.abortSpeak
          ) {
            await this.performHandoffAndTransfer(
              result.handoffReason || 'VOICE_HANDOFF',
              result.handoffReason || 'VOICE_HANDOFF'
            );
          }
          break;
        }

        if (event.type === 'delta' && event.content) {
          if (!timing.llmFirstTokenAt) timing.llmFirstTokenAt = Date.now();
          rawAccum += event.content;

          if (streamTts && !earlySpoken && !this.abortSpeak && !this.ended) {
            const early = extractEarlySpeakableChunk(rawAccum, earlyMinChars);
            if (early && isCompleteSpeakableChunk(early.chunk)) {
              earlySpoken = early.chunk;
              spokenText = earlySpoken;
              void this.enqueueSpeak(early.chunk, 'assistant', {
                recordTranscript: false,
                wait: false,
                onStart: () => {
                  if (!timing.ttsFirstStartAt) timing.ttsFirstStartAt = Date.now();
                },
              });
            }
          }
        }

        if (event.type === 'done') {
          timing.llmDoneAt = Date.now();
          if (this.abortSpeak || this.ended) break;
          const doneSpoken = (event.content ?? '').trim();
          const parsed = extractInlineToolCalls((doneSpoken || rawAccum || '').trim());
          const tools = [
            ...(event.tools || []),
            ...parsed.tools.map((t, i) => ({
              id: `inline-${i}`,
              name: t.name,
              arguments: t.arguments,
            })),
          ];

          if (parsed.cleanText) {
            if (!validateOutboundReply(parsed.cleanText).safe) {
              await this.enqueueSpeak(
                "I'll have our team follow up with you on WhatsApp shortly.",
                'assistant'
              );
              await this.performHandoffAndTransfer('BLOCKED_CONTENT', 'BLOCKED_CONTENT');
              return;
            }

            if (earlySpoken) {
              if (!isCompleteSpeakableChunk(earlySpoken)) {
                earlySpoken = '';
                spokenText = parsed.cleanText;
                await this.enqueueSpeak(parsed.cleanText, 'assistant', {
                  recordTranscript: false,
                  onStart: () => {
                    if (!timing.ttsFirstStartAt) timing.ttsFirstStartAt = Date.now();
                  },
                });
              } else {
                const remainder = remainderAfterEarlySpoken(parsed.cleanText, earlySpoken);
                spokenText = parsed.cleanText;
                if (remainder && isCompleteSpeakableChunk(remainder) && !this.abortSpeak) {
                  await this.enqueueSpeak(remainder, 'assistant', {
                    recordTranscript: false,
                    onStart: () => {
                      if (!timing.ttsFirstStartAt) timing.ttsFirstStartAt = Date.now();
                    },
                  });
                } else if (!timing.ttsFirstStartAt) {
                  timing.ttsFirstStartAt = Date.now();
                }
              }
            } else {
              spokenText = parsed.cleanText;
              await this.enqueueSpeak(parsed.cleanText, 'assistant', {
                recordTranscript: false,
                onStart: () => {
                  if (!timing.ttsFirstStartAt) timing.ttsFirstStartAt = Date.now();
                },
              });
            }
            log.info('Speaking AI reply on call', {
              callId: this.ctx.callId,
              chars: parsed.cleanText.length,
              streamedEarly: Boolean(earlySpoken),
            });
          } else if (tools.length === 0) {
            if (wantsHumanOnCall(trimmed)) {
              await this.handleToolCall({
                id: 'kw',
                name: 'request_human',
                arguments: { reason: 'Customer asked for team — empty model reply' },
              });
              return;
            }
            await this.enqueueSpeak(voiceEmptyReplyFallback(trimmed), 'assistant');
          }

          if (this.abortSpeak || this.ended) break;
          for (const tool of tools) await this.handleToolCall(tool);

          if (
            event.result?.handoff &&
            tools.length === 0 &&
            shouldEndVoiceCallOnHandoff(event.result.handoffReason) &&
            !this.abortSpeak
          ) {
            await this.performHandoffAndTransfer(
              event.result.handoffReason || 'LOW_CONFIDENCE',
              event.result.handoffReason || 'LOW_CONFIDENCE'
            );
          }
        }
      }

      await this.speakChain;
      timing.ttsDoneAt = Date.now();

      if (
        spokenText &&
        !this.audioDeliveredThisTurn &&
        !this.abortSpeak &&
        !this.ended
      ) {
        log.warn('Voice TTS produced no audio — replaying full reply', {
          callId: this.ctx.callId,
          chars: spokenText.length,
          language: this.ctx.ttsLanguage,
        });
        try {
          await this.speak(spokenText, 'assistant', { recordTranscript: false });
        } catch (err) {
          log.error('Voice TTS full-reply fallback failed', {
            callId: this.ctx.callId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (spokenText && !this.abortSpeak && !this.ended) {
        await this.recordAssistantTranscriptOnce(spokenText);
      }

      this.logTurnTiming(timing);

      if (!directHandled && !spokenText && !this.ended && !this.abortSpeak) {
        if (wantsHumanOnCall(trimmed)) {
          await this.handleToolCall({
            id: 'kw',
            name: 'request_human',
            arguments: { reason: 'Customer asked for team — no spoken reply' },
          });
        } else {
          await this.enqueueSpeak(voiceEmptyReplyFallback(trimmed), 'assistant');
        }
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
      const next = this.abortSpeak ? this.queuedSpeech : null;
      this.queuedSpeech = null;
      this.abortSpeak = false;
      if (next && !this.ended) {
        void this.handleUserSpeech(next, Date.now());
      }
    }
  }

  /**
   * Dispatch Sarvam function-call results: request_human, schedule_callback, end_call.
   */
  private async handleToolCall(tool: ToolCallResult): Promise<void> {
    log.info('Voice tool call', { callId: this.ctx.callId, tool: tool.name });

    switch (tool.name) {
      case 'request_human': {
        const lastUser =
          [...this.transcript].reverse().find((t) => t.role === 'user')?.text || '';
        if (!wantsHumanOnCall(lastUser)) {
          log.info('Ignoring request_human — caller did not ask for a person', {
            callId: this.ctx.callId,
            lastUser,
          });
          return;
        }
        const reason = (tool.arguments.reason as string) || 'Customer requested human';
        await this.speak(VOICE_TEAM_HANDOFF_SPOKEN, 'assistant');
        await this.performHandoffAndTransfer('TOOL_REQUEST_HUMAN', reason);
        break;
      }

      case 'end_call': {
        await this.speak(
          "Thanks for calling. I'll hang up now. Message us on WhatsApp if you need anything else.",
          'assistant'
        );
        await this.end('ai_hangup');
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
              slaDueAt: computeSlaDueAt(),
            },
          });
          emitTicketEvent(this.ctx.organizationId, 'ticket:new', ticket);

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
                content: formatCallbackInternalNote({
                  when,
                  reason,
                  ticketId: ticket.id,
                }),
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
          `Got it. Someone from the team will call you ${when}. They'll also message you here on WhatsApp.`,
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

  private async synthesizeWithFallback(
    text: string,
    opts: { speaker?: string; language?: string }
  ): Promise<SynthesizedAudio> {
    const primaryLang = normalizeSarvamLanguageCode(opts.language);
    try {
      return await synthesizeSpeechSarvam(text, { ...opts, language: primaryLang });
    } catch (firstErr) {
      const fallbackLang = this.defaultTtsLanguage;
      if (primaryLang === fallbackLang) throw firstErr;
      const message = firstErr instanceof Error ? firstErr.message : String(firstErr);
      log.warn('TTS failed — retrying with call default language', {
        callId: this.ctx.callId,
        attempted: primaryLang,
        fallback: fallbackLang,
        error: message,
      });
      if (config.calling.voiceTimingLog) {
        log.info('Voice TTS language fallback', {
          callId: this.ctx.callId,
          attempted: primaryLang,
          fallback: fallbackLang,
          error: message,
        });
      }
      return synthesizeSpeechSarvam(text, { ...opts, language: fallbackLang });
    }
  }

  private async recordAssistantTranscriptOnce(text: string): Promise<void> {
    const spoken = prepareSpokenText(text);
    if (!spoken) return;
    const last = this.transcript[this.transcript.length - 1];
    if (last?.role === 'assistant' && last.text === spoken) return;
    await this.appendTranscript('assistant', spoken);
  }

  private async speak(
    text: string,
    role: TranscriptEntry['role'],
    opts?: { recordTranscript?: boolean }
  ): Promise<void> {
    if (!this.bridge || this.ended) return;
    const spoken = prepareSpokenText(text);
    if (!spoken) return;
    this.speaking = true;
    this.speakingStartedAt = Date.now();
    this.lastSpokenText = spoken;
    const shouldRecord = opts?.recordTranscript !== false;
    let transcriptRecorded = false;
    try {
      const chunks = splitForTts(spoken);
      const ttsOpts = {
        speaker: this.ctx.ttsVoice,
        language: this.ctx.ttsLanguage,
      };
      let pending = chunks[0] ? this.synthesizeWithFallback(chunks[0], ttsOpts) : null;

      for (let i = 0; i < chunks.length; i++) {
        if (this.ended || this.abortSpeak || !this.bridge || !pending) {
          this.bridge?.stopPlayback();
          break;
        }
        const ttsStart = Date.now();
        const audio = await pending;
        this.ttsLatenciesMs.push(Date.now() - ttsStart);
        void this.recordVoiceUnits('tts', 0, chunks[i].length);
        if (this.ended || this.abortSpeak || !this.bridge) {
          this.bridge?.stopPlayback();
          break;
        }
        pending =
          i + 1 < chunks.length
            ? this.synthesizeWithFallback(chunks[i + 1], ttsOpts)
            : null;
        if (!transcriptRecorded && shouldRecord) {
          await this.appendTranscript(role, spoken);
          transcriptRecorded = true;
        }
        await this.bridge.playPcm(audio.samples, audio.sampleRate);
        this.audioDeliveredThisTurn = true;
      }

      if (shouldRecord && !transcriptRecorded) {
        await this.appendTranscript(role, spoken);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('Voice TTS speak failed', {
        callId: this.ctx.callId,
        error: message,
        language: this.ctx.ttsLanguage,
        preview: spoken.slice(0, 120),
      });
      if (config.calling.voiceTimingLog) {
        log.info('Voice TTS speak failure', {
          callId: this.ctx.callId,
          language: this.ctx.ttsLanguage,
          chars: spoken.length,
          error: message,
        });
      }
      if (shouldRecord && !transcriptRecorded) {
        await this.appendTranscript(role, spoken);
      }
      throw err;
    } finally {
      this.speaking = false;
      this.speakingStartedAt = 0;
      this.speakingEndedAt = Date.now();
    }
  }

  private queueInterrupt(text: string): void {
    if (this.wrappingUp || this.ended) return;
    if (!this.processing && !this.speaking) return;
    const trimmed = text.trim();
    if (!shouldProcessCallerUtterance(trimmed, 8) || isVoiceBackchannel(trimmed)) return;
    if (isLikelyTtsEcho(trimmed, this.lastSpokenText)) {
      log.debug('Ignoring TTS echo on call', { callId: this.ctx.callId, text: trimmed });
      return;
    }
    if (this.speaking) {
      this.stopBotSpeechForBargeIn('stt_final');
    }
    this.queuedSpeech = trimmed;
    this.abortSpeak = true;
    this.bridge?.stopPlayback();
    log.info('Caller interrupted AI', {
      callId: this.ctx.callId,
      text: trimmed,
      speaking: this.speaking,
      processing: this.processing,
    });
  }

  private armMaxDurationTimer(): void {
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    const maxMs = Math.max(120_000, (this.ctx.maxCallDurationSec ?? 480) * 1000);
    this.maxDurationTimer = setTimeout(() => {
      void this.hangUpForDuration();
    }, maxMs);
  }

  private async hangUpForDuration(): Promise<void> {
    if (this.ended || this.wrappingUp) return;
    this.wrappingUp = true;
    this.abortSpeak = true;
    this.queuedSpeech = null;
    this.bridge?.stopPlayback();
    const waitFrom = Date.now();
    while (this.speaking && Date.now() - waitFrom < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (this.ended) return;
    this.abortSpeak = false;
    log.info('AI call hit max duration', {
      callId: this.ctx.callId,
      maxCallDurationSec: this.ctx.maxCallDurationSec ?? 480,
    });
    try {
      await this.speak(
        "I need to wrap this call here. Our team can continue on WhatsApp. Thanks for calling.",
        'assistant'
      );
    } catch {
      // still hang up
    }
    await this.end('max_duration');
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

    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    // Post-call summary: generate once; publish in Inbox after the call-event pill.
    let postCallSummary: string | null = null;
    if (this.transcript.length > 0) {
      try {
        const summary = await this.generateSummary();
        if (summary) {
          postCallSummary = summary;
          const call = await prisma.call.findUnique({ where: { id: this.ctx.callId } });
          const metadata = ((call?.metadata as Record<string, unknown>) || {});
          await prisma.call.update({
            where: { id: this.ctx.callId },
            data: { metadata: { ...metadata, summary } },
          });

          // Agent-only internal note (never a WhatsApp bubble).
          if (this.ctx.conversationId) {
            await this.persistCallSummaryInternalNote(summary, reason);
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

    if (postCallSummary && this.ctx.conversationId) {
      try {
        const ended = await prisma.call.findUnique({
          where: { id: this.ctx.callId },
          select: { endedAt: true },
        });
        const summaryAt = ended?.endedAt
          ? new Date(ended.endedAt.getTime() + 1)
          : new Date();
        await publishCallSummaryMessage({
          callId: this.ctx.callId,
          organizationId: this.ctx.organizationId,
          conversationId: this.ctx.conversationId,
          summary: postCallSummary,
          createdAt: summaryAt,
        });
      } catch (err) {
        log.warn('Failed to publish call summary in Inbox', {
          callId: this.ctx.callId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

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
        whatsappNumberId: this.ctx.whatsappNumberId,
        usageAction: 'call_summary',
        messages: [
          {
            role: 'system',
            content:
              'Summarize this phone call transcript in 2-3 short sentences for the support agent. State what the customer wanted and what was promised. Do not address the customer or offer to connect them with anyone.',
          },
          { role: 'user', content: transcriptText },
        ],
        maxTokens: 150,
        temperature: SAFE_CHAT_TEMPERATURE,
      });

      return completion.content?.trim() || null;
    } catch {
      return null;
    }
  }

  private async persistCallSummaryInternalNote(summary: string, reason: string): Promise<void> {
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
        content: formatCallSummaryInternalNote(summary, reason),
      },
    });
  }
}
