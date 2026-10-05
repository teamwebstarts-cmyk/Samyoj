import { instagramApi } from '../services/api';
import { absolutizeStudioMediaUrl } from './studioHandoffMedia';

/** Absolute https? URL for POST /instagram/posts (Zod rejects path-only `/api/...`). */
export function absoluteMediaUrlForApi(url: string): string {
  return absolutizeStudioMediaUrl(url);
}

/** AI Studio handoff may pass blob: object URLs or same-origin media paths. */
export async function prepareInstagramHandoffMediaUrls(urls: string[]): Promise<string[]> {
  const prepared: string[] = [];
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('blob:')) {
      const blob = await fetch(trimmed).then((r) => {
        if (!r.ok) throw new Error('Could not read generated image');
        return r.blob();
      });
      const file = new File([blob], `ai-studio-${prepared.length + 1}.png`, {
        type: blob.type || 'image/png',
      });
      const { data: res } = await instagramApi.posts.upload(file);
      const stored = res.data.mediaUrl || res.data.imageUrl;
      if (!stored) throw new Error('Upload did not return a media URL');
      prepared.push(absoluteMediaUrlForApi(stored));
      continue;
    }
    prepared.push(absoluteMediaUrlForApi(trimmed));
  }
  return prepared;
}

export function absolutizePostMediaBody<T extends {
  imageUrl?: string;
  videoUrl?: string;
  mediaItems?: Array<{ url: string; kind: 'image' | 'video' }>;
}>(body: T): T {
  const next = { ...body };
  if (next.imageUrl) next.imageUrl = absoluteMediaUrlForApi(next.imageUrl);
  if (next.videoUrl) next.videoUrl = absoluteMediaUrlForApi(next.videoUrl);
  if (next.mediaItems?.length) {
    next.mediaItems = next.mediaItems.map((item) => ({
      ...item,
      url: absoluteMediaUrlForApi(item.url),
    }));
  }
  return next;
}
