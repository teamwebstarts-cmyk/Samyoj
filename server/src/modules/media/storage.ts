import fs from 'fs/promises';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'media');

export function getMediaAbsolutePath(relativePath: string): string {
  const resolved = path.resolve(UPLOAD_ROOT, relativePath);
  if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) {
    throw new Error('Invalid media path');
  }
  return resolved;
}

function extensionFromMime(mimeType?: string, filename?: string): string {
  if (filename) {
    const ext = path.extname(filename);
    if (ext) return ext.toLowerCase();
  }

  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/aac': '.aac',
    'audio/amr': '.amr',
    'application/pdf': '.pdf',
  };

  if (mimeType) {
    const base = mimeType.split(';')[0].trim().toLowerCase();
    return map[base] || '';
  }

  return '';
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
  const ext = extensionFromMime(options.mimeType, options.filename) || '.bin';
  await ensureUploadDir(options.organizationId);
  const relativePath = `${options.organizationId}/${options.messageId}${ext}`;
  const absolutePath = getMediaAbsolutePath(relativePath);
  await fs.writeFile(absolutePath, options.buffer);

  return {
    mediaPath: relativePath,
    mimeType: options.mimeType || 'application/octet-stream',
    size: options.buffer.length,
  };
}

export async function readMediaFile(relativePath: string): Promise<Buffer> {
  return fs.readFile(getMediaAbsolutePath(relativePath));
}

export async function mediaFileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(getMediaAbsolutePath(relativePath));
    return true;
  } catch {
    return false;
  }
}
