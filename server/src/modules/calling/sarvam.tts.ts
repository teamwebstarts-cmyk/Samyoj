import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('sarvam-tts');

const SARVAM_TTS_REST = `https://api.sarvam.ai/text-to-speech`;

export interface SynthesizedAudio {
  samples: Int16Array;
  sampleRate: number;
}

export function isSarvamTtsConfigured(): boolean {
  return Boolean(config.sarvam.apiKey);
}

/** Sarvam Bulbul expects BCP-47 locales (e.g. hi-IN). STT may return bare "hi" / "en". */
const SARVAM_LOCALE_ALIASES: Record<string, string> = {
  hi: 'hi-IN',
  hindi: 'hi-IN',
  en: 'en-IN',
  english: 'en-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
};

export function normalizeSarvamLanguageCode(lang?: string | null): string {
  const configDefault = config.sarvam.sttLanguage;
  const fallback =
    configDefault && configDefault !== 'unknown' && configDefault !== 'auto'
      ? configDefault
      : 'hi-IN';

  if (!lang) return fallback;
  const trimmed = lang.trim();
  if (!trimmed || trimmed === 'unknown' || trimmed === 'auto') return fallback;
  if (/^[a-z]{2}-[A-Z]{2}$/.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const base = lower.split('-')[0] ?? lower;
  return SARVAM_LOCALE_ALIASES[base] || SARVAM_LOCALE_ALIASES[lower] || fallback;
}

/**
 * Synthesize speech via Sarvam Bulbul REST TTS — returns raw PCM for the call bridge.
 * Faster than WebSocket (no ffmpeg needed, no streaming overhead for short replies).
 * @see https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/convert
 */
export async function synthesizeSpeechSarvam(
  text: string,
  options?: { speaker?: string; language?: string; pace?: number }
): Promise<SynthesizedAudio> {
  const apiKey = config.sarvam.apiKey;
  if (!apiKey) throw new Error('Sarvam API key not configured');

  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) throw new Error('Empty text for TTS');

  const speaker = options?.speaker || config.sarvam.ttsSpeaker || 'shubh';
  const language = normalizeSarvamLanguageCode(options?.language);
  const model = config.sarvam.ttsModel || 'bulbul:v3';

  const res = await fetch(SARVAM_TTS_REST, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: trimmed,
      model,
      speaker,
      language_code: language,
      pace: options?.pace ?? 1.12,
      temperature: 0.6,
      speech_sample_rate: 48000,
    }),
  });

  const data = (await res.json()) as {
    audios?: string[];
    request_id?: string;
    error?: { message?: string; code?: number };
  };

  if (!res.ok) {
    throw new Error(data.error?.message || `Sarvam TTS failed (${res.status})`);
  }

  const b64 = (data.audios || []).join('');
  if (!b64) throw new Error('Sarvam TTS returned empty audio');

  const wav = Buffer.from(b64, 'base64');

  // Parse the WAV 'fmt ' chunk to get the actual sample rate (bytes 24-27, uint32 LE)
  // instead of assuming 48000 — the bridge resamples correctly only when it knows the real rate.
  let sampleRate = 48000;
  if (wav.length >= 28 && wav.toString('ascii', 8, 12) === 'WAVE') {
    sampleRate = wav.readUInt32LE(24);
  }

  // Parse WAV header → extract raw 16-bit PCM (skipping 44-byte header for simple WAV)
  let pcmOffset = 44;
  // Find the 'data' chunk marker for robustness
  for (let i = 0; i < Math.min(wav.length - 8, 1000); i++) {
    if (wav[i] === 0x64 && wav[i + 1] === 0x61 && wav[i + 2] === 0x74 && wav[i + 3] === 0x61) {
      pcmOffset = i + 8;
      break;
    }
  }

  const pcmLength = Math.floor((wav.length - pcmOffset) / 2);
  if (pcmLength <= 0) throw new Error('Sarvam TTS returned invalid WAV');

  const samples = new Int16Array(pcmLength);
  for (let i = 0; i < pcmLength; i++) {
    samples[i] = wav.readInt16LE(pcmOffset + i * 2);
  }

  return { samples, sampleRate };
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
  if (!apiKey) throw new Error('Sarvam voice is not configured on this server yet.');

  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) throw new Error('Add greeting text before previewing voice.');

  const speaker = (options?.speaker || config.sarvam.ttsSpeaker || 'shubh').trim().toLowerCase();
  const language = normalizeSarvamLanguageCode(options?.language);
  const model = config.sarvam.ttsModel || 'bulbul:v3';

  const res = await fetch(SARVAM_TTS_REST, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: trimmed,
      language_code: language,
      model,
      speaker,
    }),
  });

  let data: {
    audios?: string[];
    request_id?: string;
    error?: { message?: string };
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(
      res.ok ? 'Sarvam voice preview returned invalid audio.' : `Sarvam voice preview failed (${res.status})`
    );
  }

  if (!res.ok) {
    log.warn('Sarvam TTS preview failed', { status: res.status, error: data.error, speaker, language });
    throw new Error(data.error?.message || `Sarvam voice preview failed (${res.status})`);
  }

  const audioBase64 = (data.audios || []).join('');
  if (!audioBase64) throw new Error('Sarvam voice preview returned empty audio');

  return {
    audioBase64,
    contentType: 'audio/wav',
    speaker,
    language,
  };
}
