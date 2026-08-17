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

/**
 * Local `setup-webhook` must not steal a live production callback (ngrok)
 * unless the operator explicitly opted in (`META_ALLOW_TUNNEL_WEBHOOK`).
 * Re-registering the same durable URL is allowed so fields can be refreshed.
 */
export function shouldReplaceAppWebhookCallback(
  currentUrl: string | null | undefined,
  nextUrl: string,
  options?: { allowTunnelOverride?: boolean }
): { replace: boolean; reason: string } {
  if (!nextUrl) {
    return { replace: false, reason: 'next webhook URL is empty' };
  }
  if (isEphemeralWebhookUrl(nextUrl) && isDurablePublicWebhookUrl(currentUrl)) {
    if (options?.allowTunnelOverride) {
      return { replace: true, reason: 'explicit tunnel override' };
    }
    return {
      replace: false,
      reason:
        'Refusing to replace a live production webhook URL with an ngrok/localhost tunnel. ' +
        'That stops inbound messages and calls on the connected WhatsApp number. ' +
        'Set META_ALLOW_TUNNEL_WEBHOOK=true for local testing (and stop the VPS), ' +
        'or use a dedicated test WABA.',
    };
  }
  return { replace: true, reason: 'ok' };
}
