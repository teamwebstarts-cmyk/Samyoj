import type { Pack } from '../components/ai-studio/data/types';

/** Same-origin absolute URL for API calls and authenticated media fetch. */
export function absolutizeStudioMediaUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window === 'undefined') return raw;
  if (raw.startsWith('blob:')) return raw;
  try {
    return new URL(raw, window.location.origin).href;
  } catch {
    return raw;
  }
}

export function studioPublicUrlFromStoragePath(path: string): string {
  const clean = path.trim().replace(/^\/+/, '');
  if (!clean || clean.includes('..')) return '';
  if (clean.startsWith('api/media/public/')) {
    return absolutizeStudioMediaUrl(`/${clean}`);
  }
  return absolutizeStudioMediaUrl(`/api/media/public/${clean}`);
}

/** Poster / attachment source for Email handoff (not raw storage path). */
export function emailPosterUrlFromPack(pack: Pack): string | undefined {
  const slide = pack.carousel?.[0] ?? pack.image?.options[pack.image?.selected ?? 0];
  const fromSlide = typeof slide?.image === 'string' ? slide.image.trim() : '';
  if (fromSlide && (fromSlide.startsWith('/') || /^https?:\/\//i.test(fromSlide))) {
    return absolutizeStudioMediaUrl(fromSlide);
  }
  const path = pack.mediaPaths?.find((p) => p && !p.includes('..'));
  if (path) return studioPublicUrlFromStoragePath(path);
  return undefined;
}

export async function fetchStudioMediaBlob(url: string, timeoutMs = 45_000): Promise<Blob> {
  const target = absolutizeStudioMediaUrl(url);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target, { credentials: 'include', signal: controller.signal });
    if (!response.ok) throw new Error('Generated image could not be loaded');
    return await response.blob();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Generated image took too long to load');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function studioMediaBlobAsFile(
  url: string,
  fileName: string,
  mimeType = 'image/png',
): Promise<File> {
  const blob = await fetchStudioMediaBlob(url);
  return new File([blob], fileName, { type: blob.type || mimeType });
}
