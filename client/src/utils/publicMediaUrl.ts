/**
 * Display-only: rewrite signed media URLs onto the current page origin so <img>
 * previews work when the API returns localhost:8000 or Codespace :8000 but the
 * UI is on :3000. Do not persist this rewrite — Meta cannot fetch the Vite host.
 */
export function resolvePublicMediaUrl(url: string | null | undefined): string {
  const raw = (url ?? '').trim();
  if (!raw) return '';
  if (typeof window === 'undefined') return raw;

  try {
    const parsed = new URL(raw, window.location.origin);
    const marker = '/api/media/public/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx >= 0) {
      const relative = parsed.pathname.slice(idx + marker.length);
      if (relative && !relative.includes('..')) {
        return `${window.location.origin}${marker}${relative}${parsed.search}`;
      }
    }
  } catch {
    /* use raw */
  }
  return raw;
}
