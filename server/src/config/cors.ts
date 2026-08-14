import { config } from './index';

function isCodespaceHost(hostname: string): boolean {
  return hostname.endsWith('.app.github.dev') || hostname.endsWith('.githubpreview.dev');
}

function isNgrokHost(hostname: string): boolean {
  return (
    hostname.endsWith('.ngrok-free.dev') ||
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.ngrok.io')
  );
}

/** Origins allowed for browser CORS / Socket.IO (CLIENT_URL + configured webhook host; localhost/Codespaces/ngrok only in non-production). */
export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    if (url.origin === new URL(config.clientUrl).origin) return true;
    // Dev-only wildcards — production must use CLIENT_URL / META_WEBHOOK_URL, not any localhost/ngrok host.
    if (config.nodeEnv !== 'production') {
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
      if (isCodespaceHost(url.hostname)) return true;
      if (isNgrokHost(url.hostname)) return true;
    }
    // Combined share proxy uses the same public host as META_WEBHOOK_URL.
    const webhookUrl = config.meta.webhookUrl;
    if (webhookUrl) {
      try {
        if (url.origin === new URL(webhookUrl).origin) return true;
      } catch {
        /* ignore bad webhook URL */
      }
    }
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
