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
  const language =
    !options?.language || options.language === 'unknown' || options.language === 'auto'
      ? 'hi-IN'
      : options.language;
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
      target_language_code: language,
      pace: options?.pace ?? 1.0,
      temperature: 0.6,
      speech_sample_rate: 24000,
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

  return { samples, sampleRate: 48000 };
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
