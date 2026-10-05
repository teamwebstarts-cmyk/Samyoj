import { fetchStudioMediaBlob } from './studioHandoffMedia';

export const STUDIO_HEADER_CACHE_VERSION = 'v1';

export function studioHeaderCacheKey(packId: string, mediaUrl: string): string {
  return `samyoj.studioTemplateHeader.${STUDIO_HEADER_CACHE_VERSION}:${packId}:${mediaUrl}`;
}

export function readStudioHeaderCache(packId: string, mediaUrl: string): string | null {
  try {
    const raw = sessionStorage.getItem(studioHeaderCacheKey(packId, mediaUrl));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { handle?: string };
    return typeof parsed.handle === 'string' && parsed.handle.trim() ? parsed.handle.trim() : null;
  } catch {
    return null;
  }
}

export function writeStudioHeaderCache(packId: string, mediaUrl: string, handle: string): void {
  sessionStorage.setItem(studioHeaderCacheKey(packId, mediaUrl), JSON.stringify({ handle }));
}

export async function fetchStudioHeaderBlob(url: string, timeoutMs = 45_000): Promise<Blob> {
  return fetchStudioMediaBlob(url, timeoutMs);
}

/** Axios response from POST /templates/upload-header (`sendSuccess` → `{ data: { handle } }`). */
export function parseTemplateUploadHeaderHandle(response: {
  data?: { data?: { handle?: unknown } };
}): string {
  const handle = response.data?.data?.handle;
  if (typeof handle === 'string' && handle.trim()) return handle.trim();
  throw new Error('Meta did not return a media handle.');
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}
