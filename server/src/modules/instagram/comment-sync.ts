import { createModuleLogger } from '../../utils/logger';
import { listInstagramMediaIds, listMediaComments } from '../facebook/page-client';
import { isOwnInstagramComment, metaScalarId } from '../whatsapp/webhook-dispatcher';
import { ingestInstagramComment } from './comment-ingest';

const log = createModuleLogger('instagram-comment-sync');

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
          const stored = await ingestInstagramComment({
            organizationId: opts.organizationId,
            channelId: opts.channelId,
            igCommentId,
            igMediaId: mediaId,
            fromId,
            fromUsername,
            text: comment.text || '',
            commentedAt: comment.timestamp ? new Date(comment.timestamp) : undefined,
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
