import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';
import { fetchInstagramMedia, instagramMediaThumbnailUrl } from '../facebook/page-client';

const log = createModuleLogger('instagram-media-cache');

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_BATCH = 4;

export type InstagramMediaPreview = {
  igMediaId: string;
  mediaType: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  caption: string | null;
};

function toPreview(row: { igMediaId: string; mediaType: string | null; thumbnailUrl: string | null; permalink: string | null; caption: string | null }): InstagramMediaPreview {
  return {
    igMediaId: row.igMediaId,
    mediaType: row.mediaType,
    thumbnailUrl: row.thumbnailUrl,
    permalink: row.permalink,
    caption: row.caption,
  };
}

export async function loadInstagramMediaPreviews(opts: {
  channelId: string;
  pageAccessToken: string;
  igMediaIds: string[];
}): Promise<Map<string, InstagramMediaPreview>> {
  const unique = [...new Set(opts.igMediaIds.filter(Boolean))];
  const out = new Map<string, InstagramMediaPreview>();
  if (!unique.length) return out;

  const staleBefore = new Date(Date.now() - CACHE_TTL_MS);
  const cached = await prisma.instagramMediaCache.findMany({
    where: { channelId: opts.channelId, igMediaId: { in: unique } },
  });
  const byId = new Map(cached.map((row) => [row.igMediaId, row]));

  const needsFetch = unique.filter((id) => {
    const row = byId.get(id);
    return !row || row.fetchedAt < staleBefore;
  });

  for (let i = 0; i < needsFetch.length; i += FETCH_BATCH) {
    const batch = needsFetch.slice(i, i + FETCH_BATCH);
    await Promise.all(
      batch.map(async (igMediaId) => {
        try {
          const media = await fetchInstagramMedia(igMediaId, opts.pageAccessToken);
          if (!media?.id) return;
          const fetchedAt = new Date();
          const saved = await prisma.instagramMediaCache.upsert({
            where: { channelId_igMediaId: { channelId: opts.channelId, igMediaId } },
            create: {
              channelId: opts.channelId,
              igMediaId,
              mediaType: media.media_type || null,
              thumbnailUrl: instagramMediaThumbnailUrl(media),
              permalink: media.permalink || null,
              caption: media.caption?.slice(0, 500) || null,
              fetchedAt,
            },
            update: {
              mediaType: media.media_type || null,
              thumbnailUrl: instagramMediaThumbnailUrl(media),
              permalink: media.permalink || null,
              caption: media.caption?.slice(0, 500) || null,
              fetchedAt,
            },
          });
          byId.set(igMediaId, saved);
        } catch (err) {
          log.warn('Instagram media fetch failed', {
            igMediaId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      })
    );
  }

  for (const id of unique) {
    const row = byId.get(id);
    if (row) out.set(id, toPreview(row));
  }
  return out;
}
