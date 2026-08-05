import WebSocket from 'ws';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('sarvam-stt');

const SARVAM_STT_BASE = 'wss://api.sarvam.ai/speech-to-text/ws';

export function isSarvamSttConfigured(): boolean {
  return Boolean(config.calling.sarvamApiKey);
}

interface SarvamTranscriptMessage {
  type?: string;
  partial?: string;
  transcript?: string;
  message?: string;
  is_final?: boolean;
  speakers?: Array<{ speaker_label: string; text: string; confidence: number }>;
}

export interface SarvamTranscriptHandler {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: Error) => void;
}

export class SarvamStreamTranscriber {
  private ws: WebSocket | null = null;
  private closed = false;
  private readonly handlers: SarvamTranscriptHandler;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(handlers: SarvamTranscriptHandler) {
    this.handlers = handlers;
  }

  async connect(): Promise<void> {
    const apiKey = config.calling.sarvamApiKey;
    if (!apiKey) throw new Error('Sarvam API key not configured');

    const model = config.calling.sarvamSttModel || 'saaras:v3-realtime';
    const mode = config.calling.sarvamSttMode || 'codemix';
    const language = config.calling.sarvamSttLanguage || 'unknown';

    const url = new URL(SARVAM_STT_BASE);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('model', model);
    url.searchParams.set('mode', mode);
    // Sarvam uses `language_code` param
    if (language && language !== 'unknown') {
      url.searchParams.set('language_code', language);
    }

    this.ws = new WebSocket(url.toString());
    this.closed = false;

    return new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'));

      this.ws.onopen = () => {
        log.info('Sarvam STT WebSocket connected', { model, mode, language });

        // Keep alive to avoid idle close (~60s)
        this.pingInterval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.ping();
          }
        }, 30_000);

        resolve();
      };

      this.ws.onmessage = (event) => {
        if (this.closed) return;
        try {
          const msg = JSON.parse(event.data as string) as SarvamTranscriptMessage;
          this.handleMessage(msg);
        } catch (err) {
          log.warn('Sarvam STT unparseable message', { error: String(err) });
        }
      };

      this.ws.onerror = (err) => {
        const e = new Error(`Sarvam STT WebSocket error: ${(err as unknown as { message?: string }).message || 'unknown'}`);
        log.error('Sarvam STT error', { error: e.message });
        this.handlers.onError?.(e);
      };

      this.ws.onclose = (ev) => {
        log.info('Sarvam STT WebSocket closed', { code: ev.code, reason: ev.reason });
        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }
      };
    });
  }

  private handleMessage(msg: SarvamTranscriptMessage): void {
    if (msg.type === 'error' || msg.message) {
      this.handlers.onError?.(new Error(msg.message || 'Sarvam STT error'));
      return;
    }

    // saaras:v3-realtime sends partial results
    if (msg.partial) {
      this.handlers.onPartial?.(msg.partial);
    }

    // final transcript
    if (msg.is_final && msg.transcript) {
      this.handlers.onFinal(msg.transcript);
    } else if (msg.transcript && typeof msg.is_final === 'undefined') {
      // saaras:v3 (non-realtime) sends transcript directly
      this.handlers.onFinal(msg.transcript);
    }

    if (msg.speakers) {
      const text = msg.speakers.map((s) => s.text).join(' ');
      if (text) this.handlers.onFinal(text);
    }
  }

  sendPcm(samples: Int16Array, sampleRate: number): void {
    if (this.closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Sarvam expects pcm_s16le or wav. Send raw PCM buffer.
    const buffer = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
    this.ws.send(buffer);
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
        this.ws.close(1000, 'client close');
      }
    } catch {
      // ignore
    }
    this.ws = null;
  }
}
