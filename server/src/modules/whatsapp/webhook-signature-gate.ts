export type InboundWebhookSignatureGate =
  | { action: 'verify' }
  | { action: 'reject'; status: 401 | 503; reason: 'missing' | 'unconfigured' }
  | { action: 'allow_unsigned' };

/** Production inbound webhooks must present HMAC. Unsigned is only allowed outside production. */
export function inboundWebhookSignatureGate(opts: {
  nodeEnv: string;
  hasSignature: boolean;
  hasGlobalSecret: boolean;
}): InboundWebhookSignatureGate {
  if (opts.hasSignature) return { action: 'verify' };
  if (opts.nodeEnv === 'production') {
    if (!opts.hasGlobalSecret) {
      return { action: 'reject', status: 503, reason: 'unconfigured' };
    }
    return { action: 'reject', status: 401, reason: 'missing' };
  }
  return { action: 'allow_unsigned' };
}
