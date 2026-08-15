import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/redis', () => ({
  getRedis: () => ({
    incr: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    mget: vi.fn().mockResolvedValue(['12', '8', '7', '1', '2026-08-15T14:34:40.000Z']),
  }),
}));

vi.mock('../../config/database', () => ({
  default: {
    providerWebhookEvent: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

import {
  hydrateWebhookHealth,
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
    expect(webhookHealth.lastReceivedAt).toBeTruthy();
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

  it('hydrates lastReceivedAt from Redis after a process restart', async () => {
    const previous = webhookHealth.lastReceivedAt;
    webhookHealth.lastReceivedAt = null;
    webhookHealth.totalReceived = 0;
    await hydrateWebhookHealth();
    expect(webhookHealth.lastReceivedAt).toBe('2026-08-15T14:34:40.000Z');
    expect(webhookHealth.totalReceived).toBeGreaterThanOrEqual(12);
    webhookHealth.lastReceivedAt = previous;
  });
});
