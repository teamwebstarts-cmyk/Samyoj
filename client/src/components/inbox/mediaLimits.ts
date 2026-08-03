/** Client + product media limits (bytes). Image/video/audio match Meta Cloud API; docs capped at 30MB. */
export const MEDIA_LIMITS = {
  IMAGE: 5 * 1024 * 1024,
  VIDEO: 16 * 1024 * 1024,
  AUDIO: 16 * 1024 * 1024,
  DOCUMENT: 30 * 1024 * 1024,
} as const;

export const MEDIA_LIMIT_LABELS = {
  IMAGE: '5 MB',
  VIDEO: '16 MB',
  AUDIO: '16 MB',
  DOCUMENT: '30 MB',
} as const;

/** Max voice-note length (seconds). */
export const VOICE_MAX_SECONDS = 120;
