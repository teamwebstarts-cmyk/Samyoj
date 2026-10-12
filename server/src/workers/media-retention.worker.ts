import prisma from '../config/database';
import { createModuleLogger } from '../utils/logger';
import { deleteMediaObject } from '../modules/media/storage-adapter';
import {
  getInstagramCommentRetentionDays,
  purgeExpiredInstagramComments,
} from '../modules/instagram/comment-retention';

const log = createModuleLogger('media-retention');

export async function runMediaRetentionPass(): Promise<{
  scanned: number;
  purged: number;
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
    instagramCommentRetentionDays: getInstagramCommentRetentionDays(),
  });
}
