const CAPTION_MAX = 2200;
const HASHTAG_MAX = 30;
const MIN_LEAD_MS = 10 * 60 * 1000;
const MAX_LEAD_MS = 75 * 24 * 60 * 60 * 1000;

export function countHashtags(caption: string): number {
  const matches = caption.match(/#[\p{L}\p{N}_]+/gu);
  return matches?.length ?? 0;
}

export function assertCaption(caption: string): string {
  const text = caption.trim();
  if (text.length > CAPTION_MAX) {
    throw new Error(`Caption must be ${CAPTION_MAX} characters or fewer.`);
  }
  const tags = countHashtags(text);
  if (tags > HASHTAG_MAX) {
    throw new Error(`Use at most ${HASHTAG_MAX} hashtags.`);
  }
  return text;
}

/** Schedule must be 10 minutes to 75 days ahead. */
export function assertScheduleWindow(when: Date, now = new Date()): void {
  const delta = when.getTime() - now.getTime();
  if (delta < MIN_LEAD_MS) {
    throw new Error('Schedule at least 10 minutes from now.');
  }
  if (delta > MAX_LEAD_MS) {
    throw new Error('Schedule at most 75 days ahead.');
  }
}

export const INSTAGRAM_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const INSTAGRAM_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const INSTAGRAM_VIDEO_MIMES = new Set(['video/mp4', 'video/quicktime']);
export const INSTAGRAM_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
