import prisma from '../../config/database';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';
import { emitToOrg } from '../../realtime';
import { generateBotReply, performHandoff } from '../ai/chatbot.service';
import { MetaCallingService } from './meta-calling.service';
import { DeepgramStreamTranscriber } from './deepgram.stt';
import { synthesizeSpeech } from './google-tts.service';
import { WhatsAppWebRtcBridge } from './webrtc-bridge';
import type { ActiveCallContext, TranscriptEntry } from './types';

const log = createModuleLogger('ai-voice-agent');

export class AiVoiceCallSession {
  private bridge: WhatsAppWebRtcBridge | null = null;
  private transcriber: DeepgramStreamTranscriber | null = null;
  private transcript: TranscriptEntry[] = [];
  private processing = false;
  private speaking = false;
  private ended = false;
  private readonly ctx: ActiveCallContext;

  constructor(ctx: ActiveCallContext) {
    this.ctx = ctx;
  }

  async start(sdpOffer: string): Promise<void> {
    this.bridge = new WhatsAppWebRtcBridge();

    this.transcriber = new DeepgramStreamTranscriber({
      onFinal: (text) => {
        void this.handleUserSpeech(text);
      },
      onError: (err) => {
        log.error('Transcriber error during call', { callId: this.ctx.callId, error: err.message });
      },
    });

    await this.transcriber.connect();

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

    await this.speak(config.calling.aiGreeting, 'system');
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

      const reply = result.reply?.trim();
      if (reply) {
        log.info('Speaking AI reply on call', { callId: this.ctx.callId, chars: reply.length });
        await this.speak(reply, 'assistant');
      }

      if (result.handoff) {
        await performHandoff(this.ctx.organizationId, this.ctx.conversationId, result.handoffReason || 'VOICE_HANDOFF');
        await this.speak(
          'I am connecting you with our team. They will follow up with you shortly. Thank you for calling.',
          'assistant'
        );
        await this.end('handoff');
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

  private async speak(text: string, role: TranscriptEntry['role']): Promise<void> {
    if (!this.bridge || this.ended) return;
    this.speaking = true;
    await this.appendTranscript(role, text);

    try {
      const audio = await synthesizeSpeech(text);
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

    await prisma.call.update({
      where: { id: this.ctx.callId },
      data: {
        status: reason === 'handoff' ? 'COMPLETED' : 'TERMINATED',
        endedAt: new Date(),
      },
    });

    log.info('AI voice call session ended', { callId: this.ctx.callId, reason });
  }
}
