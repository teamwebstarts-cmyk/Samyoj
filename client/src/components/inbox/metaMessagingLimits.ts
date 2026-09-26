/** Meta Instagram / Messenger DM attachment limits (Page messaging API). */

export const META_DM_LIMITS = {
  IMAGE_BYTES: 8 * 1024 * 1024,
  VIDEO_BYTES: 25 * 1024 * 1024,
  AUDIO_BYTES: 25 * 1024 * 1024,
  PDF_BYTES: 25 * 1024 * 1024,
  TEXT_CHARS: 1000,
} as const;

export const META_DM_LABELS = {
  IMAGE: '8 MB',
  VIDEO: '25 MB',
  AUDIO: '25 MB',
  PDF: '25 MB',
} as const;

export type MetaOutboundKind = 'image' | 'video' | 'audio' | 'file';

export type MetaComposerAttach = {
  photo: boolean;
  video: boolean;
  pdf: boolean;
  /** Browser voice notes are WebM — not accepted by Meta IG/Messenger without server transcode. */
  voice: boolean;
};

export const META_CHANNEL_ATTACH: MetaComposerAttach = {
  photo: true,
  video: true,
  pdf: true,
  voice: false,
};

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg']);
const VIDEO_MIME = new Set([
  'video/mp4',
  'video/ogg',
  'video/avi',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
]);
const AUDIO_MIME = new Set(['audio/aac', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/x-wav', 'audio/wave']);
const PDF_MIME = new Set(['application/pdf']);

export function metaOutboundKindForFile(file: File): MetaOutboundKind | null {
  const mime = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  if (IMAGE_MIME.has(mime) || /\.(png|jpe?g)$/.test(name)) return 'image';
  if (VIDEO_MIME.has(mime) || /\.(mp4|ogg|avi|mov|webm)$/.test(name)) return 'video';
  if (AUDIO_MIME.has(mime) || /\.(aac|m4a|wav|mp4)$/.test(name)) return 'audio';
  if (PDF_MIME.has(mime) || name.endsWith('.pdf')) return 'file';
  return null;
}

export type MetaDmChannel = 'instagram' | 'messenger';

function metaChannelLabel(channel: MetaDmChannel): string {
  return channel === 'messenger' ? 'Messenger' : 'Instagram';
}

export function validateMetaDmAttachment(
  file: File,
  channel: MetaDmChannel = 'instagram'
): { ok: true; kind: MetaOutboundKind } | { ok: false; message: string } {
  const label = metaChannelLabel(channel);
  const kind = metaOutboundKindForFile(file);
  if (!kind) {
    return {
      ok: false,
      message: `${label} supports PNG/JPEG photos, video (MP4 and similar), PDF, and AAC/M4A/WAV audio — not this file type.`,
    };
  }
  const size = file.size;
  if (kind === 'image' && size > META_DM_LIMITS.IMAGE_BYTES) {
    return { ok: false, message: `Image must be under ${META_DM_LABELS.IMAGE} (PNG or JPEG).` };
  }
  if (kind === 'video' && size > META_DM_LIMITS.VIDEO_BYTES) {
    return { ok: false, message: `Video must be under ${META_DM_LABELS.VIDEO}.` };
  }
  if (kind === 'audio' && size > META_DM_LIMITS.AUDIO_BYTES) {
    return { ok: false, message: `Audio must be under ${META_DM_LABELS.AUDIO}.` };
  }
  if (kind === 'file' && size > META_DM_LIMITS.PDF_BYTES) {
    return { ok: false, message: `PDF must be under ${META_DM_LABELS.PDF}.` };
  }
  if (kind === 'image' && !IMAGE_MIME.has((file.type || '').toLowerCase()) && !/\.(png|jpe?g)$/.test(file.name.toLowerCase())) {
    return { ok: false, message: `Only PNG and JPEG images are supported on ${label}.` };
  }
  return { ok: true, kind };
}
