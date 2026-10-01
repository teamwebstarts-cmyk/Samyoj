import path from 'path';

export const GMAIL_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'] as const;
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_DECODED_MIME_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000;
export const GMAIL_REQUEST_TIMEOUT_MS = 30_000;
export const GMAIL_SEND_LEASE_MS = 15 * 60 * 1000;
export const GMAIL_ENQUEUE_FAILED = 'GMAIL_ENQUEUE_FAILED';
export const GMAIL_ENQUEUE_FAILED_MESSAGE = 'Email could not be queued. Try again.';

/** BullMQ 5 rejects custom job ids that contain `:`. */
export function gmailSendJobId(sendId: string): string {
  const id = sendId.trim();
  if (!id || id.includes(':')) {
    throw new Error('Gmail send job id cannot contain a colon');
  }
  return `gmail-send-${id}`;
}

export const ALLOWED_ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export function normalizeMime(value: string): string {
  return value.split(';', 1)[0].trim().toLowerCase();
}

export function safeAttachmentFilename(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 180 || trimmed.includes('\0')) {
    throw new Error('Invalid attachment filename');
  }
  const base = path.basename(trimmed);
  if (base !== trimmed || base === '.' || base === '..' || /[\\/]/.test(trimmed)) {
    throw new Error('Attachment filename must be a basename');
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._()\-+]*$/u.test(base)) {
    throw new Error('Attachment filename contains unsupported characters');
  }
  return base;
}

function hasPrefix(buffer: Buffer, prefix: Buffer): boolean {
  return buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix);
}

export function matchesAttachmentMagic(mimeType: string, buffer: Buffer): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return hasPrefix(buffer, Buffer.from('%PDF-'));
    case 'image/jpeg':
      return hasPrefix(buffer, Buffer.from([0xff, 0xd8, 0xff]));
    case 'image/png':
      return hasPrefix(buffer, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif':
      return hasPrefix(buffer, Buffer.from('GIF8'));
    case 'image/webp':
      return hasPrefix(buffer, Buffer.from('RIFF')) && buffer.subarray(8, 12).equals(Buffer.from('WEBP'));
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return hasPrefix(buffer, Buffer.from('PK'));
    case 'text/plain':
    case 'text/csv':
      return !buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
    default:
      return false;
  }
}

export function validateAttachmentBuffer(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): { filename: string; mimeType: string; sizeBytes: number } {
  const filename = safeAttachmentFilename(input.filename);
  const mimeType = normalizeMime(input.mimeType);
  if (!ALLOWED_ATTACHMENT_MIMES.has(mimeType)) throw new Error('Attachment MIME type is not allowed');
  if (!input.buffer.length || input.buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Each attachment must be between 1 byte and ${MAX_ATTACHMENT_BYTES} bytes`);
  }
  if (!matchesAttachmentMagic(mimeType, input.buffer)) {
    throw new Error('Attachment content does not match its declared MIME type');
  }
  return { filename, mimeType, sizeBytes: input.buffer.length };
}

