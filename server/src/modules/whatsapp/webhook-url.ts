/** Helpers for Meta app webhook callback URLs. Do not log secrets. */

const EPHEMERAL_HOST =
  /(?:^|\.)ngrok(?:-free)?\.(?:app|dev|io)$|localhost|127\.0\.0\.1|\[::1\]/i;

export function webhookUrlHost(url: string): string {
  try {
    return new URL(url).hostname || '';
  } catch {
    return '';
  }
}

export function webhookUrlPath(url: string): string {
  try {
    return new URL(url).pathname || '';
  } catch {
    return '';
  }
}

export function isEphemeralWebhookUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || '';
    if (EPHEMERAL_HOST.test(host)) return true;
    if (host.endsWith('.ngrok-free.dev') || host.endsWith('.ngrok.io') || host.includes('ngrok')) {
      return true;
    }
    return parsed.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1');
  } catch {
    return /ngrok|localhost|127\.0\.0\.1/i.test(url);
  }
}

export function isDurablePublicWebhookUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname) return false;
    if (isEphemeralWebhookUrl(url)) return false;
    return parsed.pathname.includes('/api/whatsapp/webhook');
  } catch {
    return false;
  }
}

/** Fallback when local META_WEBHOOK_URL is ngrok but the live WABA must stay on VPS. */
export const DEFAULT_PRODUCTION_WEBHOOK_URL = 'https://app.samyoj.com/api/whatsapp/webhook';

/**
 * WABA override target: prefer a durable configured URL, else the production
 * callback. Never pin Meta delivery to ngrok/localhost.
 */
export function resolveDurableWebhookPinUrl(
  configuredUrl: string | null | undefined,
  productionUrl?: string | null
): string | null {
  if (isDurablePublicWebhookUrl(configuredUrl)) return configuredUrl || null;
  if (isDurablePublicWebhookUrl(productionUrl)) return productionUrl || null;
  if (isDurablePublicWebhookUrl(DEFAULT_PRODUCTION_WEBHOOK_URL)) {
    return DEFAULT_PRODUCTION_WEBHOOK_URL;
  }
  return null;
}

/**
 * Local `setup-webhook` must not steal a live production callback with ngrok.
 * `META_ALLOW_TUNNEL_WEBHOOK` does not override this — that flag previously
 * took inbound off the VPS. Re-registering the same durable URL is allowed.
 */
export function shouldReplaceAppWebhookCallback(
  currentUrl: string | null | undefined,
  nextUrl: string,
  _options?: { allowTunnelOverride?: boolean }
): { replace: boolean; reason: string } {
  if (!nextUrl) {
    return { replace: false, reason: 'next webhook URL is empty' };
  }
  if (isEphemeralWebhookUrl(nextUrl) && isDurablePublicWebhookUrl(currentUrl)) {
    return {
      replace: false,
      reason:
        'Refusing to replace a live production webhook URL with an ngrok/localhost tunnel. ' +
        'That stops inbound messages and calls on the VPS. ' +
        'Use a dedicated test WABA / Meta app for local inbound, or send test replies to the live app.samyoj.com webhook.',
    };
  }
  return { replace: true, reason: 'ok' };
}
