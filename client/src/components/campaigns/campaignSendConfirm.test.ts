import { describe, expect, it } from 'vitest';
import { buildCampaignSendConfirm, getCampaignSendErrorMessage } from './campaignSendConfirm';

describe('buildCampaignSendConfirm', () => {
  it('builds a rich send confirmation for small audiences', () => {
    const copy = buildCampaignSendConfirm({
      campaignName: 'Pay reminder',
      templateName: 'auto_pay_reminder_3',
      recipientCount: 5,
      batchSize: 50,
      batchDelayMs: 1000,
    });

    expect(copy.title).toContain('Pay reminder');
    expect(copy.highlight).toBe('auto_pay_reminder_3');
    expect(copy.details.some((line) => line.includes('5 subscribed'))).toBe(true);
    expect(copy.variant).toBe('send');
  });

  it('mentions batches and queue spread for large audiences', () => {
    const copy = buildCampaignSendConfirm({
      campaignName: 'Big blast',
      templateName: 'summer_offer',
      recipientCount: 2500,
      batchSize: 50,
      batchDelayMs: 1000,
    });

    expect(copy.details.some((line) => line.includes('50 batches'))).toBe(true);
    expect(copy.details.some((line) => line.includes('Estimated spread'))).toBe(true);
  });

  it('maps duplicate-record API errors to a user-friendly retry message', () => {
    expect(
      getCampaignSendErrorMessage(
        { response: { data: { error: { message: 'A record with this value already exists' } } } },
        'fallback',
      ),
    ).toMatch(/already queued/i);
  });

  it('maps empty-audience API errors to a subscribe message', () => {
    expect(
      getCampaignSendErrorMessage(
        { response: { data: { error: { message: 'Campaign must have at least one recipient' } } } },
        'fallback',
      ),
    ).toMatch(/subscribed to campaign messages/i);
  });
});
