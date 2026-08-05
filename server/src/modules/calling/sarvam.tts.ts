import WebSocket from 'ws';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('sarvam-tts');

const SARVAM_TTS_BASE = 'wss://api.sarvam.ai/text-to-speech/ws';
const SARVAM_TTS_REST = `https://api.sarvam.ai/text-to-speech`;

export interface SynthesizedAudio {
  samples: Int16Array;
  sampleRate: number;
}

export function isSarvamTtsConfigured(): boolean {
  return Boolean(config.calling.sarvamApiKey);
}

/**
 * Synthesize speech using Sarvam Bulbul WebSocket streaming TTS.
 * Auth uses header `api-subscription-key` (never query string).
 * @see https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/streaming-api/web-socket
 */
export async function synthesizeSpeechSarvam(
  text: string,
  options?: { speaker?: string; language?: string; pace?: number }
): Promise<SynthesizedAudio> {
  const apiKey = config.calling.sarvamApiKey;
  if (!apiKey) throw new Error('Sarvam API key not configured');

  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty text for TTS');

  const speaker = options?.speaker || config.calling.sarvamTtsSpeaker || 'shubh';
  const language = options?.language || config.calling.sarvamSttLanguage || 'hi-IN';
  const pace = Math.min(2, Math.max(0.5, options?.pace ?? 1.1));
  const model = config.calling.sarvamTtsModel || 'bulbul:v3';
  const sourceSampleRate = 24000;
  const targetRate = 48000;

  const ws = new WebSocket(`${SARVAM_TTS_BASE}?model=${encodeURIComponent(model)}`, {
    headers: {
      'api-subscription-key': apiKey,
    },
  });

  const audioChunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };

    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      done(new Error('Sarvam TTS timed out'));
    }, 25_000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'config',
          data: {
            speaker,
            target_language_code: language === 'unknown' || language === 'auto' ? 'hi-IN' : language,
            pace,
            speech_sample_rate: sourceSampleRate,
            enable_preprocessing: true,
            output_audio_codec: 'linear16',
          },
        })
      );

      const maxChunkLen = 400;
      let offset = 0;
      while (offset < trimmed.length) {
        const chunk = trimmed.slice(offset, offset + maxChunkLen);
        ws.send(JSON.stringify({ type: 'text', data: { text: chunk } }));
        offset += maxChunkLen;
      }
      ws.send(JSON.stringify({ type: 'flush' }));
    };

    ws.onmessage = (event) => {
      try {
        const raw = String(event.data);
        const msg = JSON.parse(raw) as {
          type?: string;
          data?: { audio?: string };
          audio?: string;
          error?: string;
          message?: string;
        };

        if (msg.type === 'error' || msg.error) {
          done(new Error(msg.error || msg.message || 'Sarvam TTS error'));
          return;
        }

        const b64 = msg.data?.audio || msg.audio;
        if (b64) {
          audioChunks.push(Buffer.from(b64, 'base64'));
        }
      } catch {
        const buf = Buffer.isBuffer(event.data)
          ? event.data
          : Buffer.from(event.data as ArrayBuffer);
        audioChunks.push(buf);
      }
    };

    ws.onclose = () => {
      if (audioChunks.length === 0) {
        done(new Error('Sarvam TTS returned no audio'));
        return;
      }
      done();
    };

    ws.onerror = (err) => {
      done(
        new Error(
          `Sarvam TTS WebSocket error: ${(err as unknown as { message?: string }).message || 'unknown'}`
        )
      );
    };
  });

  try {
    ws.close();
  } catch {
    /* ignore */
  }

  const totalBytes = audioChunks.reduce((sum, c) => sum + c.length, 0);
  const combined = Buffer.concat(audioChunks, totalBytes);
  const samples = new Int16Array(
    combined.buffer,
    combined.byteOffset,
    Math.floor(combined.byteLength / 2)
  );

  // Meta WhatsApp bridge expects 48 kHz PCM (Bulbul WS outputs ~24 kHz linear16)
  const ratio = sourceSampleRate / targetRate;
  const outLen = Math.max(1, Math.floor(samples.length / ratio));
  const resampled = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    resampled[i] = samples[Math.floor(i * ratio)] ?? 0;
  }
  return { samples: resampled, sampleRate: targetRate };
}

/**
 * REST preview for Customize UI — returns base64 WAV/audio from Bulbul.
 * Prefer this for short greeting playback (no call bridge).
 */
export async function previewSpeechSarvam(
  text: string,
  options?: { speaker?: string; language?: string }
): Promise<{ audioBase64: string; contentType: string; speaker: string; language: string }> {
  const apiKey = config.calling.sarvamApiKey;
  if (!apiKey) throw new Error('Sarvam API key not configured');

  const speaker = options?.speaker || config.calling.sarvamTtsSpeaker || 'shubh';
  const language =
    !options?.language || options.language === 'unknown' || options.language === 'auto'
      ? 'hi-IN'
      : options.language;
  const model = config.calling.sarvamTtsModel || 'bulbul:v3';

  const res = await fetch(SARVAM_TTS_REST, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.slice(0, 500),
      target_language_code: language,
      model,
      speaker,
    }),
  });

  const data = (await res.json()) as {
    audios?: string[];
    request_id?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    log.warn('Sarvam TTS preview failed', { status: res.status, error: data.error });
    throw new Error(data.error?.message || `Sarvam TTS preview failed (${res.status})`);
  }

  const audioBase64 = (data.audios || []).join('');
  if (!audioBase64) throw new Error('Sarvam TTS preview returned empty audio');

  return {
    audioBase64,
    contentType: 'audio/wav',
    speaker,
    language,
  };
}
