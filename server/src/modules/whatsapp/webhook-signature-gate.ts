export type InboundWebhookSignatureGate =
  | { action: 'verify' }
  | { action: 'reject'; status: 401 | 503; reason: 'missing' | 'unconfigured' }
  | { action: 'allow_unsigned' };

export function publicHttpsWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return !['localhost', '127.0.0.1', '::1'].includes(host) && !host.endsWith('.local');
  } catch {
    return false;
  }
}

/** Public HTTPS and production inbound webhooks must present HMAC. */
export function inboundWebhookSignatureGate(opts: {
  nodeEnv: string;
  hasSignature: boolean;
  hasGlobalSecret: boolean;
  hasRawBody?: boolean;
  requireSignature?: boolean;
}): InboundWebhookSignatureGate {
  if (opts.hasSignature) {
    if (opts.nodeEnv === 'production' && opts.hasRawBody === false) {
      return { action: 'reject', status: 401, reason: 'missing' };
    }
    return { action: 'verify' };
  }
  if (opts.nodeEnv === 'production' || opts.requireSignature) {
    if (!opts.hasGlobalSecret) {
      return { action: 'reject', status: 503, reason: 'unconfigured' };
    }
    return { action: 'reject', status: 401, reason: 'missing' };
  }
  return { action: 'allow_unsigned' };
}
