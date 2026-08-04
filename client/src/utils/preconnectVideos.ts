/** PreConnect intro / learn-card video URLs (env-driven; no invented embeds). */

export type PreconnectVideoId = 'intro' | 'api' | 'how' | 'benefits' | 'next';

const ENV_BY_ID: Record<PreconnectVideoId, keyof ImportMetaEnv> = {
  intro: 'VITE_PRECONNECT_VIDEO_URL',
  api: 'VITE_PRECONNECT_VIDEO_API',
  how: 'VITE_PRECONNECT_VIDEO_HOW',
  benefits: 'VITE_PRECONNECT_VIDEO_BENEFITS',
  next: 'VITE_PRECONNECT_VIDEO_NEXT',
};

function readEnv(key: keyof ImportMetaEnv): string | undefined {
  const v = import.meta.env[key];
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed || undefined;
}

/** Resolve video URL for a PreConnect slot. Learn cards fall back to the intro URL. */
export function getPreconnectVideoUrl(id: PreconnectVideoId): string | undefined {
  const own = readEnv(ENV_BY_ID[id]);
  if (own) return own;
  if (id !== 'intro') return readEnv('VITE_PRECONNECT_VIDEO_URL');
  return undefined;
}

export function isDirectMediaUrl(url: string): boolean {
  try {
    const path = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').pathname;
    return /\.(mp4|webm|ogg|mov)$/i.test(path);
  } catch {
    return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url);
  }
}

export function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return id;
      const embed = u.pathname.match(/\/embed\/([^/]+)/);
      if (embed?.[1]) return embed[1];
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id || null;
    }
  } catch {
    return null;
  }
  return null;
}

/** YouTube poster when a real watch/embed URL is configured (never invents IDs). */
export function youtubePosterUrl(url: string): string | null {
  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
      const id = extractYoutubeId(url);
      return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (isDirectMediaUrl(url)) return null;
    return url;
  } catch {
    return null;
  }
}
