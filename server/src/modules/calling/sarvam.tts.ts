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
  return Boolean(config.sarvam.apiKey);
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
  const apiKey = config.sarvam.apiKey;
  if (!apiKey) throw new Error('Sarvam API key not configured');

  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty text for TTS');

  const speaker = options?.speaker || config.sarvam.ttsSpeaker || 'shubh';
  const language = options?.language || config.sarvam.sttLanguage || 'hi-IN';
  const pace = Math.min(2, Math.max(0.5, options?.pace ?? 1.1));
  const model = config.sarvam.ttsModel || 'bulbul:v3';
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
    }, 45_000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'config',
          data: {
            speaker,
            language_code: language === 'unknown' || language === 'auto' ? 'hi-IN' : language,
            pace,
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

  // Bulbul returns mp3 audio by default — decode to raw 48kHz Int16 PCM
  // for the Meta WhatsApp WebRTC bridge via ffmpeg.
  const pcm = await decodeMp3ToPcm(combined, targetRate);
  const samples = pcmBytesToInt16Pcm(pcm);

  return { samples, sampleRate: targetRate };
}

/** Decode mp3 bytes → raw 16‑bit signed PCM s16le at `sampleRate` using ffmpeg. */
async function decodeMp3ToPcm(mp3: Buffer, sampleRate: number): Promise<Buffer> {
  const { spawn } = await import('child_process');
  const ffmpegPath = await resolveFfmpegPath();

  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      '-ar', String(sampleRate),
      '-ac', '1',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let settled = false;
    const done = (err: Error | null, result?: Buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
      if (err) reject(err);
      else resolve(result!);
    };

    const timer = setTimeout(() => {
      done(new Error('ffmpeg mp3 decode timed out'));
    }, 60_000);

    const chunks: Buffer[] = [];
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    let stderr = '';
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
    child.on('close', (code) => {
      if (code === 0) done(null, Buffer.concat(chunks));
      else done(new Error(stderr.trim() || `ffmpeg mp3 decode failed (${code})`));
    });
    child.on('error', (err) => done(err));
    child.stdin.write(mp3);
    child.stdin.end();
  });
}

/** Copy PCM bytes (s16le) into an aligned Int16Array. */
function pcmBytesToInt16Pcm(data: Buffer): Int16Array {
  const byteLength = data.byteLength - (data.byteLength % 2);
  if (byteLength === 0) return new Int16Array(0);
  const samples = new Int16Array(byteLength / 2);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = view.getInt16(i * 2, true);
  }
  return samples;
}

/** Resolve ffmpeg binary path (bundled via ffmpeg-static or system). */
async function resolveFfmpegPath(): Promise<string> {
  try {
    const mod = await import('ffmpeg-static');
    const candidate = (mod as { default?: string | null }).default || (mod as unknown as string | null);
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  } catch { /* optional dep — fall through */ }
  return 'ffmpeg';
}

/**
 * REST preview for Customize UI — returns base64 WAV/audio from Bulbul.
 * Prefer this for short greeting playback (no call bridge).
 */
export async function previewSpeechSarvam(
  text: string,
  options?: { speaker?: string; language?: string }
): Promise<{ audioBase64: string; contentType: string; speaker: string; language: string }> {
  const apiKey = config.sarvam.apiKey;
  if (!apiKey) throw new Error('Sarvam API key not configured');

  const speaker = options?.speaker || config.sarvam.ttsSpeaker || 'shubh';
  const language =
    !options?.language || options.language === 'unknown' || options.language === 'auto'
      ? 'hi-IN'
      : options.language;
  const model = config.sarvam.ttsModel || 'bulbul:v3';

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
