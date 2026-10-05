import { config } from '../../config';
import { getPublicMediaUrl } from '../media/storage-adapter';

const PUBLIC_MARKER = '/api/media/public/';

/** Relative storage path inside a Samyoj signed media URL, or null. */
export function extractPublicMediaRelative(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(PUBLIC_MARKER)) {
    const relative = trimmed.slice(PUBLIC_MARKER.length).split('?')[0];
    return relative && !relative.includes('..') ? decodeURIComponent(relative) : null;
  }
  try {
    const parsed = new URL(trimmed);
    const idx = parsed.pathname.indexOf(PUBLIC_MARKER);
    if (idx < 0) return null;
    const relative = decodeURIComponent(parsed.pathname.slice(idx + PUBLIC_MARKER.length));
    if (!relative || relative.includes('..')) return null;
    return relative;
  } catch {
    return null;
  }
}

/**
 * Origin Meta can actually fetch. Localhost and the Vite UI (:3000) fail Graph image_url.
 * Prefer META_WEBHOOK_URL's host (Codespace :8000 / ngrok), else SERVER_URL.
 */
export function publicApiOrigin(
  webhookUrl = config.meta.webhookUrl,
  fallback = config.serverUrl,
): string {
  try {
    if (webhookUrl.trim()) {
      const origin = new URL(webhookUrl).origin;
      const host = new URL(origin).hostname;
      if (origin.startsWith('https://') && host !== 'localhost' && host !== '127.0.0.1') {
        return origin;
      }
    }
  } catch {
    /* fallback */
  }
  return fallback.replace(/\/$/, '');
}

/** Re-sign a stored media URL onto a host Instagram Graph can download. */
export function mediaUrlForMeta(url: string): string {
  const relative = extractPublicMediaRelative(url);
  if (!relative) return url.trim();
  return getPublicMediaUrl(relative, publicApiOrigin());
}

/**
 * Public https URL for a WhatsApp template that came from AI Studio.
 * The image the user picked as the header wins over the first generated slide.
 */
export function studioTemplateHeaderUrl(payload: {
  headerMediaUrl?: unknown;
  mediaPaths?: unknown;
}): string | null {
  const headerMediaUrl = typeof payload.headerMediaUrl === 'string' ? payload.headerMediaUrl.trim() : '';
  const fromHeader = headerMediaUrl ? extractPublicMediaRelative(headerMediaUrl) : null;
  const paths = Array.isArray(payload.mediaPaths)
    ? payload.mediaPaths.filter(
        (value): value is string => typeof value === 'string' && value.length > 0 && !value.includes('..'),
      )
    : [];
  const path = fromHeader || paths[0] || null;
  if (path) return getPublicMediaUrl(path, publicApiOrigin());
  if (headerMediaUrl.startsWith('https://')) return headerMediaUrl;
  return null;
}

/** Fresh signed URL for browser previews (API may return an older origin or expiry). */
/** Accept path-only Samyoj media URLs on write APIs; Zod `.url()` needs a full origin. */
export function coerceInstagramWriteMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new URIError('Invalid URL');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) {
    const origin = publicApiOrigin().replace(/\/$/, '');
    return `${origin}${trimmed}`;
  }
  throw new URIError('Invalid URL');
}

export function refreshSignedPublicMediaUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return null;
  const relative = extractPublicMediaRelative(trimmed);
  if (!relative) return trimmed;
  return getPublicMediaUrl(relative);
}
