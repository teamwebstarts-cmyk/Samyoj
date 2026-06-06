import WebSocket from 'ws';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';
import { resamplePcm } from './google-tts.service';

const log = createModuleLogger('deepgram-stt');

const TARGET_SAMPLE_RATE = config.calling.deepgramSampleRate || 48000;

export function isDeepgramConfigured(): boolean {
  return Boolean(config.calling.deepgramApiKey);
}

export interface DeepgramTranscriptHandler {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (error: Error) => void;
}

export class DeepgramStreamTranscriber {
  private ws: WebSocket | null = null;
  private closed = false;
  private finalBuffer = '';
  private lastInterim = '';
  private bytesSent = 0;
  private readonly handlers: DeepgramTranscriptHandler;

  constructor(handlers: DeepgramTranscriptHandler) {
    this.handlers = handlers;
  }

  async connect(): Promise<void> {
    if (!config.calling.deepgramApiKey) {
      throw new Error('DEEPGRAM_API_KEY is not configured');
    }

    const params = new URLSearchParams({
      model: 'nova-2',
      language: config.calling.deepgramLanguage || 'hi',
      encoding: 'linear16',
      sample_rate: String(TARGET_SAMPLE_RATE),
      channels: '1',
      punctuate: 'true',
      interim_results: 'true',
      endpointing: '300',
      utterance_end_ms: '1000',
      vad_events: 'true',
      smart_format: 'true',
    });

    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
        headers: { Authorization: `Token ${config.calling.deepgramApiKey}` },
      });

      this.ws.on('open', () => {
        log.debug('Deepgram stream connected', {
          language: config.calling.deepgramLanguage,
          sampleRate: TARGET_SAMPLE_RATE,
        });
        resolve();
      });

      this.ws.on('error', (err) => {
        log.error('Deepgram stream error', { error: err.message });
        this.handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
        reject(err);
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', () => {
        this.closed = true;
        log.debug('Deepgram stream closed', { bytesSent: this.bytesSent });
      });
    });
  }

  private handleMessage(raw: string): void {
    try {
      const payload = JSON.parse(raw) as {
        type?: string;
        channel?: { alternatives?: Array<{ transcript?: string }> };
        is_final?: boolean;
        speech_final?: boolean;
      };

      if (payload.type === 'UtteranceEnd') {
        this.flushFinalBuffer('utterance_end');
        return;
      }

      if (payload.type !== 'Results') return;

      const transcript = payload.channel?.alternatives?.[0]?.transcript?.trim() ?? '';

      if (transcript) {
        if (payload.is_final) {
          this.finalBuffer = this.finalBuffer ? `${this.finalBuffer} ${transcript}`.trim() : transcript;
          log.debug('Deepgram final chunk', { transcript, speechFinal: payload.speech_final });
        } else {
          this.lastInterim = transcript;
          this.handlers.onPartial?.(transcript);
        }
      }

      if (payload.speech_final) {
        if (!this.finalBuffer && this.lastInterim) {
          this.finalBuffer = this.lastInterim;
        }
        this.lastInterim = '';
        this.flushFinalBuffer('speech_final');
      }
    } catch (err) {
      log.warn('Failed to parse Deepgram message', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private flushFinalBuffer(reason: string): void {
    const text = this.finalBuffer.trim();
    this.finalBuffer = '';
    if (text.length < 2) return;
    log.info('Caller speech transcribed', { text, reason });
    this.handlers.onFinal(text);
  }

  sendPcm(samples: Int16Array, sampleRate: number): void {
    if (!this.ws || this.closed || this.ws.readyState !== WebSocket.OPEN) return;
    if (samples.length === 0) return;

    const pcm =
      sampleRate === TARGET_SAMPLE_RATE ? samples : resamplePcm(samples, sampleRate, TARGET_SAMPLE_RATE);

    const chunk = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    this.ws.send(chunk);
    this.bytesSent += chunk.length;

    if (this.bytesSent > 0 && this.bytesSent % (TARGET_SAMPLE_RATE * 2 * 5) < chunk.length) {
      log.debug('Streaming caller audio to Deepgram', { bytesSent: this.bytesSent });
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      this.ws.close();
    }
    this.ws = null;
  }
}
