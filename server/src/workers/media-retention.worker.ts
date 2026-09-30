import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/database';
import { createModuleLogger } from '../utils/logger';
import { deleteMediaObject } from '../modules/media/storage-adapter';
import {
  getInstagramCommentRetentionDays,
  purgeExpiredInstagramComments,
} from '../modules/instagram/comment-retention';

const log = createModuleLogger('media-retention');

const CALLS_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'calls');

export function getCallRecordingTtlDays(): number {
  const raw = parseInt(process.env.CALL_RECORDING_TTL_DAYS || '7', 10);
  if (!Number.isFinite(raw) || raw < 1) return 7;
  return raw;
}

/**
 * Delete local AI call recordings (`uploads/calls/*.pcm`) older than TTL.
 * Safe no-op when the directory is missing.
 */
export async function purgeExpiredCallRecordings(options?: {
  uploadsDir?: string;
  ttlDays?: number;
  now?: Date;
}): Promise<{ scanned: number; deleted: number }> {
  const uploadsDir = options?.uploadsDir ?? CALLS_UPLOAD_DIR;
  const ttlDays = options?.ttlDays ?? getCallRecordingTtlDays();
  const now = options?.now ?? new Date();
  const cutoffMs = now.getTime() - ttlDays * 24 * 60 * 60 * 1000;

  let scanned = 0;
  let deleted = 0;

  let entries: string[];
  try {
    entries = await fs.readdir(uploadsDir);
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === 'ENOENT') {
      return { scanned: 0, deleted: 0 };
    }
    throw err;
  }

  for (const name of entries) {
    if (!name.endsWith('.pcm')) continue;
    const filePath = path.join(uploadsDir, name);
    scanned += 1;

    let mtimeMs: number;
    try {
      const stat = await fs.stat(filePath);
      mtimeMs = stat.mtimeMs;
    } catch {
      continue;
    }

    if (mtimeMs >= cutoffMs) continue;

    try {
      await fs.unlink(filePath);
      deleted += 1;
      log.info('Deleted expired call recording', {
        file: name,
        ttlDays,
        ageDays: Math.round((now.getTime() - mtimeMs) / (24 * 60 * 60 * 1000)),
      });
    } catch (err) {
      log.warn('Failed to delete call recording', {
        file: name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (deleted > 0) {
    log.info('Call recording TTL cleanup finished', { scanned, deleted, ttlDays });
  }

  return { scanned, deleted };
}

export async function runMediaRetentionPass(): Promise<{
  scanned: number;
  purged: number;
  recordingsScanned: number;
  recordingsDeleted: number;
  instagramCommentsDeleted: number;
  gmailAttachmentsDeleted: number;
}> {
  const orgs = await prisma.organization.findMany({
    select: { id: true, retentionDaysMessages: true },
  });

  let scanned = 0;
  let purged = 0;

  for (const org of orgs) {
    const retentionDays = org.retentionDaysMessages || 365;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const messageWhere = {
      conversation: { organizationId: org.id },
      createdAt: { lt: cutoff },
    };
    const oldMessages = await prisma.message.findMany({
      where: messageWhere,
      select: { metadata: true },
    });
    const mediaPaths = oldMessages
      .map((message) => {
        const metadata = message.metadata as { mediaPath?: unknown } | null;
        return typeof metadata?.mediaPath === 'string' ? metadata.mediaPath : null;
      })
      .filter((mediaPath): mediaPath is string => Boolean(mediaPath));
    for (const mediaPath of mediaPaths) {
      await deleteMediaObject(mediaPath);
    }
    const result = await prisma.message.deleteMany({ where: messageWhere });

    scanned += 1;
    purged += result.count;

    if (result.count > 0) {
      log.info('Purged old messages for org', {
        organizationId: org.id,
        count: result.count,
        retentionDays,
      });
    }
  }

  const recordings = await purgeExpiredCallRecordings();
  const igComments = await purgeExpiredInstagramComments();
  // This is a system-wide storage cleanup, so it intentionally scans
  // disconnected workspaces too. User-facing attachment reads require an
  // active workspace and expiresAt > now in the Gmail routes/worker.
  const expiredGmailAttachments = await prisma.emailAttachment.findMany({
    where: { expiresAt: { lt: new Date() }, deletedAt: null },
    select: { id: true, storagePath: true, emailSendId: true },
  });
  for (const attachment of expiredGmailAttachments) {
    await deleteMediaObject(attachment.storagePath);
  }
  if (expiredGmailAttachments.length) {
    await prisma.emailAttachment.updateMany({
      where: { id: { in: expiredGmailAttachments.map((attachment) => attachment.id) } },
      data: { deletedAt: new Date() },
    });
    await prisma.emailSend.updateMany({
      where: {
        id: { in: expiredGmailAttachments.flatMap((attachment) => attachment.emailSendId ? [attachment.emailSendId] : []) },
        whatsappNumberId: { not: null },
        whatsappNumber: { isActive: true },
        status: 'QUEUED',
      },
      data: {
        status: 'FAILED',
        statusReason: 'Attachment upload expired before send',
        errorCode: 'ATTACHMENT_EXPIRED',
        failedAt: new Date(),
      },
    });
  }

  return {
    scanned,
    purged,
    recordingsScanned: recordings.scanned,
    recordingsDeleted: recordings.deleted,
    instagramCommentsDeleted: igComments.deleted,
    gmailAttachmentsDeleted: expiredGmailAttachments.length,
  };
}

export function startMediaRetentionWorker(): void {
  const intervalMs = parseInt(process.env.MEDIA_RETENTION_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10);

  const run = () => {
    runMediaRetentionPass().catch((err) =>
      log.error('Media retention pass failed', { error: String(err) })
    );
  };

  run();
  setInterval(run, intervalMs);
  log.info('Media retention worker started', {
    intervalMs,
    callRecordingTtlDays: getCallRecordingTtlDays(),
    instagramCommentRetentionDays: getInstagramCommentRetentionDays(),
  });
}
