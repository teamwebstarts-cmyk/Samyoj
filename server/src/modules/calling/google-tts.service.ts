import path from 'path';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('google-tts');

let client: TextToSpeechClient | null = null;

function getClient(): TextToSpeechClient {
  if (!client) {
    const credPath = path.isAbsolute(config.calling.googleCredentialsPath)
      ? config.calling.googleCredentialsPath
      : path.resolve(process.cwd(), config.calling.googleCredentialsPath);
    client = new TextToSpeechClient({ keyFilename: credPath });
  }
  return client;
}

export function isGoogleTtsConfigured(): boolean {
  return Boolean(config.calling.googleCredentialsPath);
}

export interface SynthesizedAudio {
  samples: Int16Array;
  sampleRate: number;
}

/** Copy PCM bytes into an aligned Int16Array (Buffer views may have odd byteOffset). */
export function pcmBytesToInt16(data: Buffer | Uint8Array): Int16Array {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const byteLength = buffer.byteLength - (buffer.byteLength % 2);
  if (byteLength === 0) return new Int16Array(0);

  const samples = new Int16Array(byteLength / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = buffer.readInt16LE(i * 2);
  }
  return samples;
}

export async function synthesizeSpeech(text: string): Promise<SynthesizedAudio> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { samples: new Int16Array(0), sampleRate: 48000 };
  }

  const tts = getClient();
  const [response] = await tts.synthesizeSpeech({
    input: { text: trimmed },
    voice: {
      languageCode: config.calling.googleTtsLanguage,
      name: config.calling.googleTtsVoice,
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 48000,
      speakingRate: 1.0,
      pitch: 0,
    },
  });

  const audio = response.audioContent;
  if (!audio) {
    throw new Error('Google TTS returned empty audio');
  }

  const buffer = Buffer.isBuffer(audio)
    ? audio
    : typeof audio === 'string'
      ? Buffer.from(audio, 'base64')
      : Buffer.from(audio);
  const samples = pcmBytesToInt16(buffer);

  log.debug('Speech synthesized', { chars: trimmed.length, samples: samples.length });
  return { samples, sampleRate: 48000 };
}

export function resamplePcm(
  input: Int16Array,
  inputRate: number,
  outputRate: number
): Int16Array {
  if (inputRate === outputRate || input.length === 0) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    output[i] = input[srcIndex] ?? 0;
  }
  return output;
}
