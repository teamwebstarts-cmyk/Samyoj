import type { InstagramPostMediaType } from '@prisma/client';
import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';
import type { InstagramMediaItem } from './posts.media';

const log = createModuleLogger('instagram-posts');

function graphBase(): string {
  const version = (config.meta.apiVersion || 'v21.0').replace(/^\//, '');
  return `https://graph.facebook.com/${version}`;
}

async function graphForm(
  path: string,
  accessToken: string,
  body: Record<string, string>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${graphBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = (await res.json()) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Instagram publish failed (${res.status})`);
  }
  return data;
}

async function graphRead(path: string, accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${graphBase()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Instagram status failed (${res.status})`);
  }
  return data;
}

async function waitForContainer(
  containerId: string,
  accessToken: string,
  opts?: { maxAttempts?: number }
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 8;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const row = await graphRead(
      `/${containerId}?fields=status_code,status`,
      accessToken
    );
    const code = String(row.status_code || '');
    if (code === 'FINISHED' || code === 'PUBLISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(String(row.status || 'Instagram could not process this media.'));
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  log.warn('Instagram container still processing', { containerId });
}

async function createChildContainer(
  igUserId: string,
  accessToken: string,
  item: InstagramMediaItem
): Promise<string> {
  const body: Record<string, string> = { is_carousel_item: 'true' };
  if (item.kind === 'video') {
    body.media_type = 'VIDEO';
    body.video_url = item.url;
  } else {
    body.image_url = item.url;
  }
  const created = await graphForm(`/${igUserId}/media`, accessToken, body);
  const containerId = String(created.id || '');
  if (!containerId) throw new Error('Instagram did not return a carousel item.');
  await waitForContainer(containerId, accessToken, { maxAttempts: item.kind === 'video' ? 40 : 12 });
  return containerId;
}

export async function publishInstagramPost(opts: {
  igUserId: string;
  accessToken: string;
  mediaType: InstagramPostMediaType;
  caption: string;
  imageUrl: string;
  mediaPayload?: InstagramMediaItem[] | null;
  scheduledUnix?: number;
}): Promise<{ containerId: string; igMediaId: string | null }> {
  const scheduleExtras: Record<string, string> = {};
  if (opts.scheduledUnix) {
    scheduleExtras.published = 'false';
    scheduleExtras.scheduled_publish_time = String(opts.scheduledUnix);
  }

  if (opts.mediaType === 'REELS') {
    const videoUrl = opts.mediaPayload?.[0]?.url || opts.imageUrl;
    const body: Record<string, string> = {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: opts.caption,
      ...scheduleExtras,
    };
    const created = await graphForm(`/${opts.igUserId}/media`, opts.accessToken, body);
    const containerId = String(created.id || '');
    if (!containerId) throw new Error('Instagram did not return a media container.');
    await waitForContainer(containerId, opts.accessToken, { maxAttempts: 40 });
    const published = await graphForm(`/${opts.igUserId}/media_publish`, opts.accessToken, {
      creation_id: containerId,
    });
    return { containerId, igMediaId: published.id ? String(published.id) : null };
  }

  if (opts.mediaType === 'CAROUSEL') {
    const items = opts.mediaPayload || [];
    const childIds: string[] = [];
    for (const item of items) {
      childIds.push(await createChildContainer(opts.igUserId, opts.accessToken, item));
    }
    const body: Record<string, string> = {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption: opts.caption,
      ...scheduleExtras,
    };
    const created = await graphForm(`/${opts.igUserId}/media`, opts.accessToken, body);
    const containerId = String(created.id || '');
    if (!containerId) throw new Error('Instagram did not return a carousel container.');
    await waitForContainer(containerId, opts.accessToken, { maxAttempts: 20 });
    const published = await graphForm(`/${opts.igUserId}/media_publish`, opts.accessToken, {
      creation_id: containerId,
    });
    return { containerId, igMediaId: published.id ? String(published.id) : null };
  }

  const body: Record<string, string> = {
    image_url: opts.imageUrl,
    caption: opts.caption,
    ...scheduleExtras,
  };
  const created = await graphForm(`/${opts.igUserId}/media`, opts.accessToken, body);
  const containerId = String(created.id || '');
  if (!containerId) throw new Error('Instagram did not return a media container.');
  await waitForContainer(containerId, opts.accessToken);
  const published = await graphForm(`/${opts.igUserId}/media_publish`, opts.accessToken, {
    creation_id: containerId,
  });
  return { containerId, igMediaId: published.id ? String(published.id) : null };
}

/** @deprecated use publishInstagramPost */
export async function publishInstagramImage(opts: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
  scheduledUnix?: number;
}): Promise<{ containerId: string; igMediaId: string | null }> {
  return publishInstagramPost({
    ...opts,
    mediaType: 'IMAGE',
    mediaPayload: null,
  });
}
