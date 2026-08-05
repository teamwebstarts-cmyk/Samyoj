import WebSocket from 'ws';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('sarvam-tts');

const SARVAM_TTS_BASE = 'wss://api.sarvam.ai/text-to-speech/ws';

export interface SynthesizedAudio {
  samples: Int16Array;
  sampleRate: number;
}

interface TtsConfigResponse {
  type?: string;
  message?: string;
}

export function isSarvamTtsConfigured(): boolean {
  return Boolean(config.calling.sarvamApiKey);
}

/**
 * Synthesize speech using Sarvam Bulbul v3 WebSocket streaming TTS.
 */
export async function synthesizeSpeechSarvam(
  text: string,
  options?: { speaker?: string; language?: string; pace?: number }
): Promise<SynthesizedAudio> {
  const apiKey = config.calling.sarvamApiKey;
  if (!apiKey) throw new Error('Sarvam API key not configured');

  const speaker = options?.speaker || config.calling.sarvamTtsSpeaker || 'shubh';
  const language = options?.language || 'hi-IN';
  const pace = options?.pace ?? 1.1;
  const targetRate = 48000;

  const ws = new WebSocket(`${SARVAM_TTS_BASE}?api_key=${apiKey}`);

  const audioChunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      // Send config
      ws.send(
        JSON.stringify({
          type: 'config',
          model: config.calling.sarvamTtsModel || 'bulbul:v3',
          speaker,
          language_code: language,
          pace,
          codec: 'pcm_s16le',
          bitrate: '16k',
        })
      );

      // Send text in chunked messages
      const maxChunkLen = 500;
      let offset = 0;
      while (offset < text.length) {
        const chunk = text.slice(offset, offset + maxChunkLen);
        ws.send(JSON.stringify({ type: 'text', text: chunk }));
        offset += maxChunkLen;
      }

      // Signal end
      ws.send(JSON.stringify({ type: 'flush' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type?: string; audio?: string; error?: string };

        if (msg.type === 'error' || msg.error) {
          reject(new Error(msg.error || 'Sarvam TTS error'));
          return;
        }

        if (msg.audio) {
          const chunk = Buffer.from(msg.audio, 'base64');
          audioChunks.push(chunk);
        }
      } catch {
        // binary message — raw PCM
        const buf = Buffer.isBuffer(event.data) ? event.data : Buffer.from(event.data as ArrayBuffer);
        audioChunks.push(buf);
      }
    };

    ws.onclose = () => {
      if (audioChunks.length === 0) {
        reject(new Error('Sarvam TTS returned no audio'));
        return;
      }
      resolve();
    };

    ws.onerror = (err) => {
      reject(new Error(`Sarvam TTS WebSocket error: ${(err as unknown as { message?: string }).message || 'unknown'}`));
    };

    // Timeout after 20s
    setTimeout(() => {
      reject(new Error('Sarvam TTS timed out'));
    }, 20_000);
  });

  const totalBytes = audioChunks.reduce((sum, c) => sum + c.length, 0);
  const combined = Buffer.concat(audioChunks, totalBytes);

  // pcm_s16le → Int16Array
  const samples = new Int16Array(combined.buffer, combined.byteOffset, combined.byteLength / 2);

  // Resample from 16kHz to 48kHz if needed
  const sourceRate = config.calling.sarvamSampleRate || 16000;
  if (sourceRate !== targetRate) {
    const ratio = sourceRate / targetRate;
    const outLen = Math.floor(samples.length / ratio);
    const resampled = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      resampled[i] = samples[Math.floor(i * ratio)] ?? 0;
    }
    return { samples: resampled, sampleRate: targetRate };
  }

  return { samples, sampleRate: targetRate };
}
