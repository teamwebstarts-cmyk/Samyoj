import { config } from './index';

function isCodespaceHost(hostname: string): boolean {
  return hostname.endsWith('.app.github.dev') || hostname.endsWith('.githubpreview.dev');
}

/** Origins allowed for browser CORS / Socket.IO (local + Codespaces + CLIENT_URL). */
export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    if (url.origin === new URL(config.clientUrl).origin) return true;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    if (isCodespaceHost(url.hostname)) return true;
  } catch {
    return false;
  }

  return false;
}

export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  callback(null, isAllowedCorsOrigin(origin));
}
