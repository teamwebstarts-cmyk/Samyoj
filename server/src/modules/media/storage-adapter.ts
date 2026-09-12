import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';
import { signPublicMediaQuery } from './public-sign';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'media');

export function resolveLocalMediaPath(relativePath: string): string {
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
    throw new Error('Invalid media path');
  }
  const root = path.resolve(UPLOAD_ROOT);
  const absolute = path.resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('Invalid media path');
  }
  return absolute;
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
    'audio/ogg': '.ogg',
    'audio/webm': '.webm',
    'audio/mpeg': '.mp3',
    'application/pdf': '.pdf',
  };
  if (mimeType) {
    const base = mimeType.split(';')[0].trim().toLowerCase();
    return map[base] || '';
  }
  return '';
}

export function buildRelativePath(orgId: string, messageId: string, mimeType?: string, filename?: string) {
  const ext = extensionFromMime(mimeType, filename) || '.bin';
  return `${orgId}/${messageId}${ext}`;
}

async function saveLocal(relativePath: string, buffer: Buffer) {
  const absolute = resolveLocalMediaPath(relativePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer);
}

async function readLocal(relativePath: string): Promise<Buffer> {
  return fs.readFile(resolveLocalMediaPath(relativePath));
}

async function existsLocal(relativePath: string): Promise<boolean> {
  try {
    await fs.access(resolveLocalMediaPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

async function loadS3Client(): Promise<{
  S3Client: new (args: Record<string, unknown>) => { send: (cmd: unknown) => Promise<{ Body?: { transformToByteArray: () => Promise<Uint8Array> } }> };
  PutObjectCommand: new (args: Record<string, unknown>) => unknown;
  GetObjectCommand: new (args: Record<string, unknown>) => unknown;
  HeadObjectCommand: new (args: Record<string, unknown>) => unknown;
  DeleteObjectCommand: new (args: Record<string, unknown>) => unknown;
}> {
  try {
    return await import('@aws-sdk/client-s3' as string);
  } catch {
    throw new Error('S3 storage requires @aws-sdk/client-s3 — run npm install in server/');
  }
}

async function saveS3(relativePath: string, buffer: Buffer, mimeType: string) {
  const { s3Bucket, s3Region, s3AccessKey, s3SecretKey } = config.storage;
  if (!s3Bucket || !s3AccessKey || !s3SecretKey) {
    throw new Error('S3 storage is not fully configured');
  }

  const { S3Client, PutObjectCommand } = await loadS3Client();
  const client = new S3Client({
    region: s3Region,
    credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: relativePath,
      Body: buffer,
      ContentType: mimeType,
    })
  );
}

async function readS3(relativePath: string): Promise<Buffer> {
  const { s3Bucket, s3Region, s3AccessKey, s3SecretKey } = config.storage;
  const { S3Client, GetObjectCommand } = await loadS3Client();
  const client = new S3Client({
    region: s3Region,
    credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
  });

  const res = await client.send(new GetObjectCommand({ Bucket: s3Bucket, Key: relativePath }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error('Empty S3 object');
  return Buffer.from(bytes);
}

async function existsS3(relativePath: string): Promise<boolean> {
  try {
    const { s3Bucket, s3Region, s3AccessKey, s3SecretKey } = config.storage;
    const { S3Client, HeadObjectCommand } = await loadS3Client();
    const client = new S3Client({
      region: s3Region,
      credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
    });
    await client.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: relativePath }));
    return true;
  } catch {
    return false;
  }
}

export function getPublicMediaUrl(relativePath: string): string {
  const { exp, sig } = signPublicMediaQuery(relativePath);
  return `${config.serverUrl}/api/media/public/${relativePath}?exp=${exp}&sig=${sig}`;
}

export async function persistMediaBuffer(options: {
  organizationId: string;
  messageId: string;
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
}): Promise<{ mediaPath: string; mimeType: string; size: number }> {
  const relativePath = buildRelativePath(
    options.organizationId,
    options.messageId,
    options.mimeType,
    options.filename
  );
  const mimeType = options.mimeType || 'application/octet-stream';

  if (config.storage.driver === 's3') {
    await saveS3(relativePath, options.buffer, mimeType);
  } else {
    await saveLocal(relativePath, options.buffer);
  }

  return { mediaPath: relativePath, mimeType, size: options.buffer.length };
}

export async function fetchMediaBuffer(relativePath: string): Promise<Buffer> {
  if (config.storage.driver === 's3') {
    return readS3(relativePath);
  }
  return readLocal(relativePath);
}

export async function mediaExists(relativePath: string): Promise<boolean> {
  if (config.storage.driver === 's3') {
    return existsS3(relativePath);
  }
  return existsLocal(relativePath);
}

/** Best-effort delete of a stored media object (local disk or S3). */
export async function deleteMediaObject(relativePath: string): Promise<void> {
  if (!relativePath) return;
  try {
    if (config.storage.driver === 's3') {
      const { s3Bucket, s3Region, s3AccessKey, s3SecretKey } = config.storage;
      if (!s3Bucket || !s3AccessKey || !s3SecretKey) return;
      const { S3Client, DeleteObjectCommand } = await loadS3Client();
      const client = new S3Client({
        region: s3Region,
        credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
      });
      await client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: relativePath }));
      return;
    }
    const absolute = resolveLocalMediaPath(relativePath);
    await fs.unlink(absolute).catch(() => undefined);
  } catch {
    /* ignore missing / permission errors — clearing chat must still succeed */
  }
}
