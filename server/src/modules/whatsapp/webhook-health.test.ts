import { describe, expect, it } from 'vitest';
import {
  toPublicWebhookHealth,
  trackWebhookFailed,
  trackWebhookProcessed,
  trackWebhookQueued,
  trackWebhookReceived,
  webhookHealth,
} from './webhook-health';

describe('webhook health lifecycle', () => {
  it('distinguishes receipt, queue, completion, and failure', () => {
    const snapshot = { ...webhookHealth };
    trackWebhookReceived();
    trackWebhookQueued();
    trackWebhookProcessed();
    trackWebhookFailed(new Error('worker failed'));

    expect(webhookHealth.totalReceived).toBe(snapshot.totalReceived + 1);
    expect(webhookHealth.totalQueued).toBe(snapshot.totalQueued + 1);
    expect(webhookHealth.totalProcessed).toBe(snapshot.totalProcessed + 1);
    expect(webhookHealth.totalFailed).toBe(snapshot.totalFailed + 1);
    expect(webhookHealth.lastError).toBe('worker failed');
  });

  it('omits the live webhook URL from the public health payload', () => {
    const payload = toPublicWebhookHealth({
      queueDepth: 2,
      webhookConfigured: true,
      verifyTokenConfigured: true,
      appSecretConfigured: true,
    });

    expect(payload).toMatchObject({
      queueDepth: 2,
      webhookConfigured: true,
      verifyTokenConfigured: true,
      appSecretConfigured: true,
    });
    expect(payload).not.toHaveProperty('webhookUrl');
    expect(payload).not.toHaveProperty('lastError');
    expect(payload).not.toHaveProperty('lastFbTraceId');
    expect(JSON.stringify(payload)).not.toContain('ngrok');
    expect(JSON.stringify(payload)).not.toContain('http');
    expect(JSON.stringify(payload)).not.toContain('worker failed');
  });
});
