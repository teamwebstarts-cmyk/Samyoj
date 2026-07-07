/**
 * Resolve API/socket origins the same way as Skillr:
 * - If VITE_API_ORIGIN is an absolute http(s) URL, use it (cross-origin / staging).
 * - Otherwise use the current page origin (same host in production; Vite dev proxy on :3000).
 */
function absoluteBaseForApi(): string {
  const envOrigin = import.meta.env.VITE_API_ORIGIN;
  if (envOrigin && /^https?:\/\//i.test(envOrigin)) {
    return envOrigin.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

/** Full API prefix, e.g. http://localhost:3000/api (dev) or https://myapp.com/api (prod). */
export const apiBaseUrl = (() => {
  const base = absoluteBaseForApi();
  if (!base) return '/api';
  return new URL('/api', `${base}/`).href.replace(/\/$/, '');
})();

/** Socket.IO server URL — same origin in prod; explicit env overrides for split deployments. */
export const socketBaseUrl = (() => {
  const envSocket = import.meta.env.VITE_SOCKET_URL;
  if (envSocket && /^https?:\/\//i.test(envSocket)) {
    return envSocket.replace(/\/$/, '');
  }
  const base = absoluteBaseForApi();
  return base || 'http://localhost:8000';
})();
