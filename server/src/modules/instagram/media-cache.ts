import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';
import { fetchInstagramMedia, instagramMediaThumbnailUrl } from '../facebook/page-client';
import { extractPublicMediaRelative, refreshSignedPublicMediaUrl } from './posts.media-url';
import { getPublicMediaUrl, mediaExists, persistMediaBuffer } from '../media/storage-adapter';
import { thumbnailFetchUrl } from './media-cache.download';

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

function toPreview(row: {
  igMediaId: string;
  mediaType: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  caption: string | null;
}): InstagramMediaPreview {
  return {
    igMediaId: row.igMediaId,
    mediaType: row.mediaType,
    thumbnailUrl: refreshSignedPublicMediaUrl(row.thumbnailUrl),
    permalink: row.permalink,
    caption: row.caption,
  };
}

function storageKeyForIgMedia(igMediaId: string): string {
  const safe = igMediaId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `ig-thumb-${safe}`;
}

async function downloadRemoteThumbnail(
  sourceUrl: string,
  pageAccessToken: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const candidates = [sourceUrl];
  const withAuth = thumbnailFetchUrl(sourceUrl, pageAccessToken);
  if (withAuth !== sourceUrl) candidates.push(withAuth);
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, { redirect: 'follow' });
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!bytes.length) continue;
      const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
      if (!mimeType.startsWith('image/') && mimeType !== 'application/octet-stream') continue;
      return { buffer: bytes, mimeType: mimeType === 'application/octet-stream' ? 'image/jpeg' : mimeType };
    } catch (err) {
      log.warn('Instagram thumbnail download failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return null;
}

/** Graph CDN URLs expire; keep a Samyoj-signed copy for dashboard/comments UI. */
async function ensurePersistedThumbnail(opts: {
  organizationId: string;
  igMediaId: string;
  sourceUrl: string | null;
  pageAccessToken: string;
}): Promise<string | null> {
  const relativeExisting = opts.sourceUrl ? extractPublicMediaRelative(opts.sourceUrl) : null;
  if (relativeExisting && (await mediaExists(relativeExisting))) {
    return getPublicMediaUrl(relativeExisting);
  }
  if (!opts.sourceUrl || relativeExisting) return opts.sourceUrl;

  const downloaded = await downloadRemoteThumbnail(opts.sourceUrl, opts.pageAccessToken);
  if (!downloaded) return opts.sourceUrl;

  const stored = await persistMediaBuffer({
    organizationId: opts.organizationId,
    messageId: storageKeyForIgMedia(opts.igMediaId),
    buffer: downloaded.buffer,
    mimeType: downloaded.mimeType,
  });
  return getPublicMediaUrl(stored.mediaPath);
}

function rowNeedsGraphRefresh(
  row: { fetchedAt: Date; thumbnailUrl: string | null } | undefined,
  staleBefore: Date
): boolean {
  if (!row) return true;
  if (row.fetchedAt < staleBefore) return true;
  if (row.thumbnailUrl && !extractPublicMediaRelative(row.thumbnailUrl)) return true;
  return false;
}

export async function loadInstagramMediaPreviews(opts: {
  channelId: string;
  organizationId: string;
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

  const needsFetch = unique.filter((id) => rowNeedsGraphRefresh(byId.get(id), staleBefore));

  for (let i = 0; i < needsFetch.length; i += FETCH_BATCH) {
    const batch = needsFetch.slice(i, i + FETCH_BATCH);
    await Promise.all(
      batch.map(async (igMediaId) => {
        try {
          const media = await fetchInstagramMedia(igMediaId, opts.pageAccessToken);
          if (!media?.id) return;
          const remoteThumb = instagramMediaThumbnailUrl(media);
          const fetchedAt = new Date();
          const saved = await prisma.instagramMediaCache.upsert({
            where: { channelId_igMediaId: { channelId: opts.channelId, igMediaId } },
            create: {
              channelId: opts.channelId,
              igMediaId,
              mediaType: media.media_type || null,
              thumbnailUrl: remoteThumb,
              permalink: media.permalink || null,
              caption: media.caption?.slice(0, 500) || null,
              fetchedAt,
            },
            update: {
              mediaType: media.media_type || null,
              thumbnailUrl: remoteThumb,
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

  for (const igMediaId of unique) {
    const row = byId.get(igMediaId);
    if (!row?.thumbnailUrl) continue;
    try {
      const persisted = await ensurePersistedThumbnail({
        organizationId: opts.organizationId,
        igMediaId,
        sourceUrl: row.thumbnailUrl,
        pageAccessToken: opts.pageAccessToken,
      });
      if (persisted && persisted !== row.thumbnailUrl) {
        const updated = await prisma.instagramMediaCache.update({
          where: { channelId_igMediaId: { channelId: opts.channelId, igMediaId } },
          data: { thumbnailUrl: persisted },
        });
        byId.set(igMediaId, updated);
      }
    } catch (err) {
      log.warn('Instagram thumbnail persist failed', {
        igMediaId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const id of unique) {
    const row = byId.get(id);
    if (row) out.set(id, toPreview(row));
  }
  return out;
}
