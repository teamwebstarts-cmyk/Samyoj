import { randomUUID } from 'crypto';
import { getPublicMediaUrl } from './storage-adapter';
import { saveMediaBuffer } from './storage';

/** Meta Cloud API practical limits (bytes). */
const LIMITS = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 16 * 1024 * 1024,
  AUDIO: 16 * 1024 * 1024,
  DOCUMENT: 100 * 1024 * 1024,
} as const;

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'application/pdf'];

export function mimeToMessageType(mimeType: string): 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  if (base.startsWith('image/')) return 'IMAGE';
  if (base.startsWith('video/')) return 'VIDEO';
  if (base.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

export function validateMediaUpload(mimeType: string, size: number): void {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME_PREFIXES.some((p) => base.startsWith(p))) {
    throw new Error('Unsupported file type. Allowed: images, videos, audio, and PDF documents.');
  }
  const type = mimeToMessageType(base);
  const max = LIMITS[type];
  if (size > max) {
    const label =
      type === 'IMAGE' ? '5 MB' : type === 'DOCUMENT' ? '100 MB' : '16 MB';
    throw new Error(`File too large. Maximum size for ${type.toLowerCase()} is ${label}.`);
  }
}

export async function storeOutboundMedia(options: {
  organizationId: string;
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<{
  mediaPath: string;
  publicUrl: string;
  mimeType: string;
  size: number;
  messageType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
}> {
  validateMediaUpload(options.mimeType, options.buffer.length);

  const uploadId = randomUUID();
  const saved = await saveMediaBuffer({
    organizationId: options.organizationId,
    messageId: uploadId,
    buffer: options.buffer,
    mimeType: options.mimeType,
    filename: options.filename,
  });

  return {
    mediaPath: saved.mediaPath,
    publicUrl: getPublicMediaUrl(saved.mediaPath),
    mimeType: saved.mimeType,
    size: saved.size,
    messageType: mimeToMessageType(saved.mimeType),
  };
}
