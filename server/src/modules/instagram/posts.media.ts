import type { InstagramPostMediaType } from '@prisma/client';

export type InstagramMediaItem = { url: string; kind: 'image' | 'video' };

export const CAROUSEL_MIN = 2;
export const CAROUSEL_MAX = 10;

export function parseMediaPayload(raw: unknown): InstagramMediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InstagramMediaItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const url = String((row as { url?: string }).url || '').trim();
    const kind = (row as { kind?: string }).kind === 'video' ? 'video' : 'image';
    if (url) out.push({ url, kind });
  }
  return out;
}

export function coverImageUrl(
  mediaType: InstagramPostMediaType,
  imageUrl: string,
  payload: InstagramMediaItem[]
): string {
  if (imageUrl.trim()) return imageUrl.trim();
  const first = payload[0];
  return first?.url || '';
}

/** Normalize create/update body into mediaType, cover image, and payload. */
export function resolvePostMedia(input: {
  mediaType?: InstagramPostMediaType;
  imageUrl?: string;
  videoUrl?: string;
  mediaItems?: InstagramMediaItem[];
}): { mediaType: InstagramPostMediaType; imageUrl: string; mediaPayload: InstagramMediaItem[] | null } {
  const mediaType = input.mediaType || 'IMAGE';
  if (mediaType === 'REELS') {
    const videoUrl = (input.videoUrl || input.imageUrl || '').trim();
    if (!videoUrl) throw new Error('Add a video for this Reel.');
    return {
      mediaType: 'REELS',
      imageUrl: videoUrl,
      mediaPayload: [{ url: videoUrl, kind: 'video' }],
    };
  }
  if (mediaType === 'CAROUSEL') {
    const items = (input.mediaItems || []).filter((row) => row.url.trim());
    if (items.length < CAROUSEL_MIN || items.length > CAROUSEL_MAX) {
      throw new Error(`Carousel needs ${CAROUSEL_MIN} to ${CAROUSEL_MAX} slides.`);
    }
    const cover = (input.imageUrl || items.find((i) => i.kind === 'image')?.url || items[0].url).trim();
    return { mediaType: 'CAROUSEL', imageUrl: cover, mediaPayload: items };
  }
  const imageUrl = (input.imageUrl || '').trim();
  if (!imageUrl) throw new Error('Add an image first.');
  return { mediaType: 'IMAGE', imageUrl, mediaPayload: null };
}
