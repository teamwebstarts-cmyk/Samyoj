import path from 'path';
import fs from 'fs/promises';
import { fetchMediaBuffer, mediaExists, persistMediaBuffer } from './storage-adapter';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'media');

export function getMediaAbsolutePath(relativePath: string): string {
  const resolved = path.resolve(UPLOAD_ROOT, relativePath);
  if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) {
    throw new Error('Invalid media path');
  }
  return resolved;
}

export async function ensureUploadDir(orgId: string): Promise<string> {
  const dir = path.join(UPLOAD_ROOT, orgId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveMediaBuffer(options: {
  organizationId: string;
  messageId: string;
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
}): Promise<{ mediaPath: string; mimeType: string; size: number }> {
  return persistMediaBuffer(options);
}

export async function readMediaFile(relativePath: string): Promise<Buffer> {
  return fetchMediaBuffer(relativePath);
}

export async function mediaFileExists(relativePath: string): Promise<boolean> {
  return mediaExists(relativePath);
}
