import { createModuleLogger } from '../../utils/logger';
import { listInstagramMediaIds, listMediaComments } from '../facebook/page-client';
import { isOwnInstagramComment, metaScalarId } from '../whatsapp/webhook-dispatcher';
import { ingestInstagramComment } from './comment-ingest';
import { instagramCommentRetentionCutoff } from './comment-retention';
import getRedis from '../../config/redis';

const log = createModuleLogger('instagram-comment-sync');
const SYNC_LOCK_PREFIX = 'ig-comment-sync:';
const SYNC_LOCK_TTL_SEC = 120;

export async function withInstagramCommentSyncLock<T>(
  channelId: string,
  fn: () => Promise<T>
): Promise<T | 'busy'> {
  const redis = getRedis();
  const key = `${SYNC_LOCK_PREFIX}${channelId}`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const acquired = await redis.set(key, token, 'EX', SYNC_LOCK_TTL_SEC, 'NX');
  if (acquired !== 'OK') return 'busy';
  try {
    return await fn();
  } finally {
    const current = await redis.get(key);
    if (current === token) await redis.del(key);
  }
}

/**
 * Pull comments already on Instagram into the list.
 * Keyword auto-reply stays off: a history import must not DM everyone who ever commented.
 * ponytail: stops after maxMedia / maxScan. Older posts need another sync; upgrade is a stored cursor.
 */
export async function syncInstagramComments(opts: {
  organizationId: string;
  channelId: string;
  igUserId: string;
  pageAccessToken: string;
  businessUsername?: string | null;
  maxMedia?: number;
  maxScan?: number;
}): Promise<{ inserted: number; scanned: number }> {
  const maxMedia = opts.maxMedia ?? 40;
  const maxScan = opts.maxScan ?? 1000;
  const retentionCutoff = instagramCommentRetentionCutoff();
  let inserted = 0;
  let scanned = 0;
  let mediaSeen = 0;
  let mediaAfter: string | undefined;

  while (mediaSeen < maxMedia && scanned < maxScan) {
    const media = await listInstagramMediaIds(opts.igUserId, opts.pageAccessToken, mediaAfter);
    if (media.ids.length === 0) break;
    for (const mediaId of media.ids) {
      if (mediaSeen >= maxMedia || scanned >= maxScan) break;
      mediaSeen += 1;
      let commentAfter: string | undefined;
      let dupStreak = 0;
      do {
        const page = await listMediaComments(mediaId, opts.pageAccessToken, commentAfter);
        for (const comment of page.comments) {
          if (scanned >= maxScan) break;
          const igCommentId = metaScalarId(comment.id);
          if (!igCommentId) continue;
          scanned += 1;
          const fromUsername = comment.username || comment.from?.username;
          const fromId = metaScalarId(comment.from?.id);
          if (
            isOwnInstagramComment({
              fromId,
              entryId: opts.igUserId,
              fromUsername,
              businessUsername: opts.businessUsername,
            })
          ) {
            continue;
          }
          const commentedAt = comment.timestamp ? new Date(comment.timestamp) : undefined;
          if (commentedAt && commentedAt < retentionCutoff) {
            continue;
          }
          const stored = await ingestInstagramComment({
            organizationId: opts.organizationId,
            channelId: opts.channelId,
            igCommentId,
            igMediaId: mediaId,
            fromId,
            fromUsername,
            text: comment.text || '',
            commentedAt,
            skipAutomation: true,
          });
          if (stored.created) {
            inserted += 1;
            dupStreak = 0;
          } else {
            dupStreak += 1;
          }
        }
        commentAfter = page.next;
        if (dupStreak >= 20) break;
      } while (commentAfter && scanned < maxScan);
    }
    if (!media.next) break;
    mediaAfter = media.next;
  }

  log.info('Instagram comment history synced', {
    organizationId: opts.organizationId,
    channelId: opts.channelId,
    inserted,
    scanned,
  });
  return { inserted, scanned };
}
