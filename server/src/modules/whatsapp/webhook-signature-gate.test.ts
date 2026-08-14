import { describe, expect, it } from 'vitest';
import { inboundWebhookSignatureGate } from './webhook-signature-gate';

describe('inboundWebhookSignatureGate', () => {
  it('requires HMAC in production even when the platform app secret is configured', () => {
    expect(
      inboundWebhookSignatureGate({
        nodeEnv: 'production',
        hasSignature: false,
        hasGlobalSecret: true,
      })
    ).toEqual({ action: 'reject', status: 401, reason: 'missing' });
  });

  it('fails closed when production has no signature and no app secret', () => {
    expect(
      inboundWebhookSignatureGate({
        nodeEnv: 'production',
        hasSignature: false,
        hasGlobalSecret: false,
      })
    ).toEqual({ action: 'reject', status: 503, reason: 'unconfigured' });
  });

  it('verifies whenever a signature header is present', () => {
    expect(
      inboundWebhookSignatureGate({
        nodeEnv: 'production',
        hasSignature: true,
        hasGlobalSecret: true,
      })
    ).toEqual({ action: 'verify' });
  });

  it('allows unsigned webhooks only outside production', () => {
    expect(
      inboundWebhookSignatureGate({
        nodeEnv: 'development',
        hasSignature: false,
        hasGlobalSecret: true,
      })
    ).toEqual({ action: 'allow_unsigned' });
  });
});
