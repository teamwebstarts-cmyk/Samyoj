import { describe, expect, it } from 'vitest';
import { inboundWebhookSignatureGate, publicHttpsWebhookUrl } from './webhook-signature-gate';

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

  it('rejects production HMAC verification when the raw request body is missing', () => {
    expect(
      inboundWebhookSignatureGate({
        nodeEnv: 'production',
        hasSignature: true,
        hasGlobalSecret: true,
        hasRawBody: false,
      })
    ).toEqual({ action: 'reject', status: 401, reason: 'missing' });
  });

  it('verifies whenever a signature header is present and the raw body exists', () => {
    expect(
      inboundWebhookSignatureGate({
        nodeEnv: 'production',
        hasSignature: true,
        hasGlobalSecret: true,
        hasRawBody: true,
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

  it('requires HMAC for a public HTTPS webhook even in development', () => {
    expect(
      inboundWebhookSignatureGate({
        nodeEnv: 'development',
        hasSignature: false,
        hasGlobalSecret: true,
        requireSignature: publicHttpsWebhookUrl('https://random.ngrok-free.dev/api/whatsapp/webhook'),
      })
    ).toEqual({ action: 'reject', status: 401, reason: 'missing' });
  });

  it('keeps localhost development fixtures unsigned', () => {
    expect(publicHttpsWebhookUrl('http://localhost:8000/api/whatsapp/webhook')).toBe(false);
  });
});
