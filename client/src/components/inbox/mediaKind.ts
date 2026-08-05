import type { Message, MessageMetadata } from '../../types';

export type VisualMediaKind = 'image' | 'gif' | 'sticker' | 'video';

function metaOf(message: Message): MessageMetadata {
  return (message.metadata || {}) as MessageMetadata;
}

/** True when mime/filename clearly denotes a GIF (or WhatsApp GIF-as-video). */
export function looksLikeGif(mimeType?: string | null, filename?: string | null, isGifFlag?: boolean) {
  if (isGifFlag) return true;
  const mime = (mimeType || '').toLowerCase();
  const name = (filename || '').toLowerCase();
  if (mime.includes('gif') || name.endsWith('.gif')) return true;
  // Some WhatsApp GIF forwards keep gif in the stored name while mime is video/mp4.
  if (name.includes('.gif') || name.includes('giphy') || name.includes('-gif-')) return true;
  return false;
}

/**
 * How the bubble should present visual media.
 * - sticker: small, no chrome
 * - gif: muted autoplay loop (WhatsApp-style), soft tap to expand
 * - video: poster + play control → MediaViewer
 * - image: static / animated <img> (image/gif still works in <img>)
 */
export function resolveVisualMediaKind(message: Message): VisualMediaKind {
  const type = message.type?.toUpperCase();
  const meta = metaOf(message);
  const mime = meta.mimeType;
  const filename = meta.filename;

  if (meta.isSticker || type === 'STICKER') return 'sticker';

  if (looksLikeGif(mime, filename, Boolean((meta as { isGif?: boolean }).isGif))) {
    return 'gif';
  }

  if (type === 'VIDEO') return 'video';
  return 'image';
}
