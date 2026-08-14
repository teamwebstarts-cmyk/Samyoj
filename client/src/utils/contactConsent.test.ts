import { describe, expect, it } from 'vitest';
import { contactGetsCampaignMessages } from './contactConsent';

describe('contactGetsCampaignMessages', () => {
  it('matches campaign eligibility, not a bare optedIn flag', () => {
    expect(contactGetsCampaignMessages({ optedIn: true })).toBe(false);
    expect(
      contactGetsCampaignMessages({
        optedIn: true,
        consentSource: 'MANUAL',
        consentAt: '2026-08-14T12:00:00.000Z',
      })
    ).toBe(true);
    expect(
      contactGetsCampaignMessages({
        optedIn: true,
        consentSource: 'MANUAL',
        consentAt: '2026-08-14T12:00:00.000Z',
        optOutAt: '2026-08-14T13:00:00.000Z',
      })
    ).toBe(false);
  });
});
