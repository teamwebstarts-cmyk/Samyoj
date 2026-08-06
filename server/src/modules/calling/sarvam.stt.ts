import WebSocket from 'ws';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';
import { resamplePcm } from './audio-utils';

const log = createModuleLogger('sarvam-stt');

/** Official realtime STT (partials + VAD) — not the legacy /speech-to-text/ws path. */
const SARVAM_STT_REALTIME = 'wss://api.sarvam.ai/speech-to-text-realtime/ws';

export function isSarvamSttConfigured(): boolean {
  return Boolean(config.sarvam.apiKey);
}

interface SarvamRealtimeMessage {
  event?: string;
  type?: string;
  text?: string;
  transcript?: string;
  partial?: string;
  language?: string;
  code?: string | number;
  message?: string;
  is_fatal?: boolean;
}

export interface SarvamTranscriptHandler {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: Error) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

export interface SarvamSttConnectOptions {
  language?: string;
  mode?: string;
  prompt?: string;
  sampleRate?: number;
  streamType?: 'fast' | 'balanced' | 'simulated';
}

/**
 * Sarvam Saaras v3 realtime streaming STT for WhatsApp voice calls.
 * @see https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-api
 */
export class SarvamStreamTranscriber {
  private ws: WebSocket | null = null;
  private closed = false;
  private readonly handlers: SarvamTranscriptHandler;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private connectOptions: SarvamSttConnectOptions = {};
  /** Sample rate the STT stream expects — inbound audio is resampled to this. */
  private sampleRate = 16000;

  constructor(handlers: SarvamTranscriptHandler) {
    this.handlers = handlers;
  }

  async connect(options?: SarvamSttConnectOptions): Promise<void> {
    const apiKey = config.sarvam.apiKey;
    if (!apiKey) throw new Error('Sarvam API key not configured');

    this.connectOptions = options || {};
    const language =
      this.connectOptions.language ||
      config.sarvam.sttLanguage ||
      'auto';
    const mode = this.connectOptions.mode || config.sarvam.sttMode || 'codemix';
    const sampleRate = this.connectOptions.sampleRate || config.sarvam.sampleRate || 16000;
    this.sampleRate = sampleRate === 8000 ? 8000 : 16000;
    const streamType = this.connectOptions.streamType || 'fast';
    const prompt = this.connectOptions.prompt?.trim();

    const url = new URL(SARVAM_STT_REALTIME);
    url.searchParams.set('model', 'saaras:v3-realtime');
    url.searchParams.set('language_code', language === 'unknown' ? 'auto' : language);
    url.searchParams.set('mode', mode);
    url.searchParams.set('stream_type', streamType);
    url.searchParams.set('encoding', 'linear16');
    url.searchParams.set('sample_rate', String(sampleRate === 8000 ? 8000 : 16000));
    url.searchParams.set('endpointing', 'vad');
    // Telephony-optimised VAD per Sarvam docs: threshold ~0.5 rejects noise,
    // longer silence (800ms) avoids mid-sentence premature finals, and a longer
    // min-speech (300ms) ignores short breath/click bursts that otherwise loop.
    url.searchParams.set('threshold', '0.5');
    url.searchParams.set('silence_duration_ms', '800');
    url.searchParams.set('min_speech_duration_ms', '300');
    if (prompt) url.searchParams.set('prompt', prompt.slice(0, 500));

    this.ws = new WebSocket(url.toString(), {
      headers: {
        'api-subscription-key': apiKey,
      },
    });
    this.closed = false;

    return new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'));

      const failTimer = setTimeout(() => {
        reject(new Error('Sarvam STT connect timed out'));
      }, 12_000);

      this.ws.onopen = () => {
        clearTimeout(failTimer);
        log.info('Sarvam STT realtime connected', { language, mode, streamType, sampleRate });
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ event: 'ping' }));
          }
        }, 25_000);
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (this.closed) return;
        try {
          const msg = JSON.parse(String(event.data)) as SarvamRealtimeMessage;
          this.handleMessage(msg);
        } catch (err) {
          log.warn('Sarvam STT unparseable message', { error: String(err) });
        }
      };

      this.ws.onerror = (err) => {
        clearTimeout(failTimer);
        const e = new Error(
          `Sarvam STT WebSocket error: ${(err as unknown as { message?: string }).message || 'unknown'}`
        );
        log.error('Sarvam STT error', { error: e.message });
        this.handlers.onError?.(e);
        reject(e);
      };

      this.ws.onclose = (ev) => {
        clearTimeout(failTimer);
        log.info('Sarvam STT WebSocket closed', { code: ev.code, reason: ev.reason });
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
      };
    });
  }

  private handleMessage(msg: SarvamRealtimeMessage): void {
    const event = msg.event || msg.type;

    if (event === 'error' || msg.is_fatal) {
      this.handlers.onError?.(new Error(msg.message || `Sarvam STT error ${msg.code || ''}`));
      return;
    }

    if (event === 'vad.speech_start') {
      this.handlers.onSpeechStart?.();
      return;
    }
    if (event === 'vad.speech_end') {
      this.handlers.onSpeechEnd?.();
      return;
    }

    if (event === 'transcript.partial' && msg.text) {
      this.handlers.onPartial?.(msg.text);
      return;
    }

    if (event === 'transcript.final' && msg.text) {
      this.handlers.onFinal(msg.text);
      return;
    }

    // Legacy fallback shapes (should not appear on realtime endpoint)
    if (msg.partial) this.handlers.onPartial?.(msg.partial);
    if (msg.transcript) this.handlers.onFinal(msg.transcript);
  }

  sendPcm(samples: Int16Array, sampleRate: number): void {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Sarvam STT stream expects audio at this.sampleRate. WebRTC inbound is 48kHz,
    // so resample to the configured STT rate to avoid garbled/chipmunk transcription.
    let pcm = samples;
    if (sampleRate !== this.sampleRate) {
      pcm = resamplePcm(samples, sampleRate, this.sampleRate);
    }

    const buffer = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    this.ws.send(
      JSON.stringify({
        event: 'audio_input',
        audio: buffer.toString('base64'),
      })
    );
  }

  /** Optional mid-call terminology hint (applied at next utterance). */
  updatePrompt(prompt: string): void {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        event: 'config.update',
        prompt: prompt.slice(0, 500),
      })
    );
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'end' }));
        this.ws.close(1000, 'client close');
      }
    } catch {
      // ignore
    }
    this.ws = null;
  }
}
