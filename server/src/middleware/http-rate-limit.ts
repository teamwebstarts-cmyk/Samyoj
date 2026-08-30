/**
 * Global HTTP limiter skip rules. SPA HTML/JS/images must never 429 —
 * a refresh loop on /login + /favicon.ico burned the old 5000/15m bucket.
 */
export function skipGlobalHttpRateLimit(
  path: string,
  upgradeHeader?: string | string[]
): boolean {
  const p = (path || '').split('?')[0];
  const upgrade = Array.isArray(upgradeHeader) ? upgradeHeader[0] : upgradeHeader;
  if (upgrade && upgrade.toLowerCase() === 'websocket') return true;
  if (p === '/health' || p.startsWith('/api/whatsapp/webhook')) return true;
  if (p.startsWith('/socket.io') || p.startsWith('/api/socket.io')) return true;
  if (!p.startsWith('/api')) return true;
  return false;
}
