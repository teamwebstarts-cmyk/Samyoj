import type { FeedRatioId } from './cropImage';

export type MediaKind = 'image' | 'video';
export type MediaType = 'IMAGE' | 'REELS' | 'CAROUSEL';
export type MediaItem = { url: string; kind: MediaKind };

export type MediaUploadState = {
  fileName: string;
  label: string;
  progress: number;
};

export type PostRow = {
  id: string;
  status: string;
  mediaType: MediaType;
  feedRatio?: FeedRatioId;
  caption: string;
  imageUrl: string;
  mediaPayload: MediaItem[];
  scheduledAt: string | null;
  publishedAt: string | null;
  igMediaId: string | null;
  permalink?: string | null;
  lastError: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LibraryItem = {
  igMediaId: string;
  mediaType: string;
  thumbnailUrl: string;
  permalink: string | null;
  caption: string;
  likes?: number | null;
  comments?: number | null;
};

export type PanelTab = 'create' | 'preview' | 'automation';

export const REMOTE_PREFIX = 'remote:';

export function isRemoteId(id: string | null): id is string {
  return Boolean(id && id.startsWith(REMOTE_PREFIX));
}

/** User-facing status labels — documented set, no invented states. */
export function statusLabel(status: string): string {
  if (status === 'PROCESSING') return 'Publishing';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'ALL') return 'All';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Tile status pill modifier. */
export function statusModifier(status: string): string {
  if (status === 'PROCESSING') return 'processing';
  return status.toLowerCase();
}

/** Date shown on tiles: Sep 22, 2026 · 10:30 AM */
export function formatPostDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

/** Best-effort display date for a post row. */
export function postDisplayDate(post: PostRow): string | null {
  if (post.status === 'SCHEDULED') return formatPostDate(post.scheduledAt);
  if (post.status === 'PUBLISHED') return formatPostDate(post.publishedAt);
  return formatPostDate(post.publishedAt || post.scheduledAt || post.createdAt);
}

export function countHashtags(caption: string): number {
  const matches = caption.match(/#[\p{L}\p{N}_]+/gu);
  return matches?.length ?? 0;
}

export function extractHashtags(caption: string): string[] {
  return caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
}

export const HASHTAG_MAX = 30;
export const CAPTION_MAX = 2200;
export const CAROUSEL_MIN = 2;
export const CAROUSEL_MAX = 10;
export const IMAGE_MAX_MB = 8;
export const VIDEO_MAX_MB = 100;
