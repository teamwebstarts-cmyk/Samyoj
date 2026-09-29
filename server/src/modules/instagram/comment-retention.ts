import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('instagram-comment-retention');

export function getInstagramCommentRetentionDays(): number {
  const raw = parseInt(process.env.INSTAGRAM_COMMENT_RETENTION_DAYS || '7', 10);
  if (!Number.isFinite(raw) || raw < 7) return 7;
  return raw;
}

/** Comments older than this cutoff are hidden from lists and eligible for purge. */
export function instagramCommentRetentionCutoff(now = new Date()): Date {
  const days = getInstagramCommentRetentionDays();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function purgeExpiredInstagramComments(options?: {
  now?: Date;
}): Promise<{ deleted: number; retentionDays: number }> {
  const now = options?.now ?? new Date();
  const retentionDays = getInstagramCommentRetentionDays();
  const cutoff = instagramCommentRetentionCutoff(now);
  const result = await prisma.instagramComment.deleteMany({
    where: { commentedAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    log.info('Purged expired Instagram comments', {
      deleted: result.count,
      retentionDays,
      cutoff: cutoff.toISOString(),
    });
  }
  return { deleted: result.count, retentionDays };
}
