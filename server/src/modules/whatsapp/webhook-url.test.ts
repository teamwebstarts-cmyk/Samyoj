import { describe, expect, it } from 'vitest';
import {
  isDurablePublicWebhookUrl,
  isEphemeralWebhookUrl,
  shouldReplaceAppWebhookCallback,
  webhookUrlHost,
} from './webhook-url';

describe('webhook URL guards', () => {
  it('treats ngrok and localhost as ephemeral', () => {
    expect(isEphemeralWebhookUrl('https://collision-modified-spur.ngrok-free.dev/api/whatsapp/webhook')).toBe(
      true
    );
    expect(isEphemeralWebhookUrl('https://abc.ngrok-free.app/api/whatsapp/webhook')).toBe(true);
    expect(isEphemeralWebhookUrl('http://localhost:8000/api/whatsapp/webhook')).toBe(true);
    expect(isEphemeralWebhookUrl('https://app.samyoj.com/api/whatsapp/webhook')).toBe(false);
  });

  it('accepts the production HTTPS webhook as durable', () => {
    expect(isDurablePublicWebhookUrl('https://app.samyoj.com/api/whatsapp/webhook')).toBe(true);
    expect(isDurablePublicWebhookUrl('https://foo.ngrok-free.dev/api/whatsapp/webhook')).toBe(false);
    expect(webhookUrlHost('https://app.samyoj.com/api/whatsapp/webhook')).toBe('app.samyoj.com');
  });

  it('refuses to replace production callback with ngrok', () => {
    const decision = shouldReplaceAppWebhookCallback(
      'https://app.samyoj.com/api/whatsapp/webhook',
      'https://collision-modified-spur.ngrok-free.dev/api/whatsapp/webhook'
    );
    expect(decision.replace).toBe(false);
    expect(decision.reason).toMatch(/production webhook/i);
  });

  it('allows replacing ngrok with production and refreshing the same URL', () => {
    expect(
      shouldReplaceAppWebhookCallback(
        'https://collision-modified-spur.ngrok-free.dev/api/whatsapp/webhook',
        'https://app.samyoj.com/api/whatsapp/webhook'
      ).replace
    ).toBe(true);
    expect(
      shouldReplaceAppWebhookCallback(
        'https://app.samyoj.com/api/whatsapp/webhook',
        'https://app.samyoj.com/api/whatsapp/webhook'
      ).replace
    ).toBe(true);
    expect(isEphemeralWebhookUrl('https://not-a-tunnel.example.com/api/whatsapp/webhook')).toBe(false);
  });
});
