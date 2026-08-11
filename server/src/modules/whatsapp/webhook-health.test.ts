import { describe, expect, it } from 'vitest';
import {
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
});
