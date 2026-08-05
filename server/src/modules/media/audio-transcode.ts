import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('audio-transcode');

export interface TranscodeAudioResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  converted: boolean;
}

function baseMime(mimeType?: string): string {
  return (mimeType || '').split(';')[0].trim().toLowerCase();
}

/** Meta Cloud API rejects browser voice recordings (`audio/webm`). */
export function needsWhatsAppAudioTranscode(mimeType?: string, filename?: string): boolean {
  const mime = baseMime(mimeType);
  const name = (filename || '').toLowerCase();
  if (mime === 'audio/ogg' || mime === 'audio/opus' || mime === 'audio/mpeg' || mime === 'audio/aac' || mime === 'audio/mp4' || mime === 'audio/amr') {
    return false;
  }
  return (
    mime === 'audio/webm' ||
    mime === 'video/webm' ||
    mime.includes('webm') ||
    name.endsWith('.webm') ||
    mime === 'audio/wav' ||
    mime === 'audio/x-wav' ||
    name.endsWith('.wav')
  );
}

async function resolveFfmpegPath(): Promise<string | null> {
  try {
    const mod = await import('ffmpeg-static');
    const candidate = (mod as { default?: string | null }).default || (mod as unknown as string | null);
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  } catch {
    /* optional dep */
  }
  return 'ffmpeg';
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * Convert browser voice notes (usually WebM/Opus) to OGG Opus for Meta WhatsApp.
 * Returns the original buffer unchanged when conversion is unnecessary or unavailable.
 */
export async function ensureWhatsAppAudio(options: {
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
}): Promise<TranscodeAudioResult> {
  const mime = baseMime(options.mimeType) || 'application/octet-stream';
  const filename = options.filename || 'audio.bin';

  if (!needsWhatsAppAudioTranscode(mime, filename)) {
    return {
      buffer: options.buffer,
      mimeType: mime.startsWith('audio/') ? mime : 'audio/ogg',
      filename,
      converted: false,
    };
  }

  const bin = await resolveFfmpegPath();
  if (!bin) {
    log.warn('ffmpeg unavailable — cannot convert voice note for Meta');
    return { buffer: options.buffer, mimeType: mime, filename, converted: false };
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'samyoj-audio-'));
  const inputExt = filename.includes('.') ? path.extname(filename) : '.webm';
  const inputPath = path.join(dir, `in${inputExt || '.webm'}`);
  const outputPath = path.join(dir, 'out.ogg');
  const outName = filename.replace(/\.[^.]+$/, '') || 'voice-note';
  const outFilename = `${outName}.ogg`;

  try {
    await writeFile(inputPath, options.buffer);
    await runFfmpeg(bin, [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-f',
      'ogg',
      outputPath,
    ]);
    const converted = await readFile(outputPath);
    if (converted.length < 64) {
      throw new Error('Converted audio too small');
    }
    return {
      buffer: converted,
      mimeType: 'audio/ogg',
      filename: outFilename,
      converted: true,
    };
  } catch (err) {
    log.warn('Voice note transcode failed', {
      error: err instanceof Error ? err.message : String(err),
      mime,
      filename,
    });
    return { buffer: options.buffer, mimeType: mime, filename, converted: false };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** WhatsApp inbound voice notes are OGG/Opus — Safari and some clients can't play them in <audio>. */
export function needsBrowserAudioTranscode(mimeType?: string, filename?: string): boolean {
  const mime = baseMime(mimeType);
  const name = (filename || '').toLowerCase();
  if (mime === 'audio/mpeg' || mime === 'audio/mp4' || mime === 'audio/aac' || mime === 'audio/wav') {
    return false;
  }
  return (
    mime === 'audio/ogg' ||
    mime === 'audio/opus' ||
    mime === 'application/ogg' ||
    mime === 'audio/amr' ||
    mime === 'audio/webm' ||
    name.endsWith('.ogg') ||
    name.endsWith('.opus') ||
    name.endsWith('.oga') ||
    name.endsWith('.amr') ||
    name.endsWith('.webm')
  );
}

/**
 * Transcode WhatsApp OGG/Opus (etc.) to MP3 so Inbox <audio> works in every browser.
 */
export async function ensureBrowserAudio(options: {
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
}): Promise<TranscodeAudioResult> {
  const mime = baseMime(options.mimeType) || 'application/octet-stream';
  const filename = options.filename || 'audio.bin';

  if (!needsBrowserAudioTranscode(mime, filename)) {
    return {
      buffer: options.buffer,
      mimeType: mime.startsWith('audio/') ? mime : 'audio/mpeg',
      filename,
      converted: false,
    };
  }

  const bin = await resolveFfmpegPath();
  if (!bin) {
    log.warn('ffmpeg unavailable — cannot convert voice note for browser playback');
    return { buffer: options.buffer, mimeType: mime, filename, converted: false };
  }

  const dir = await mkdtemp(path.join(tmpdir(), 'samyoj-play-'));
  const inputExt = filename.includes('.') ? path.extname(filename) : '.ogg';
  const inputPath = path.join(dir, `in${inputExt || '.ogg'}`);
  const outputPath = path.join(dir, 'out.mp3');
  const outName = filename.replace(/\.[^.]+$/, '') || 'voice-note';
  const outFilename = `${outName}.mp3`;

  try {
    await writeFile(inputPath, options.buffer);
    await runFfmpeg(bin, [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '48k',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-f',
      'mp3',
      outputPath,
    ]);
    const converted = await readFile(outputPath);
    if (converted.length < 64) {
      throw new Error('Converted playback audio too small');
    }
    return {
      buffer: converted,
      mimeType: 'audio/mpeg',
      filename: outFilename,
      converted: true,
    };
  } catch (err) {
    log.warn('Browser audio transcode failed', {
      error: err instanceof Error ? err.message : String(err),
      mime,
      filename,
    });
    return { buffer: options.buffer, mimeType: mime, filename, converted: false };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
