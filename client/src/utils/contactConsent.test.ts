import { describe, expect, it } from 'vitest';
import {
  contactGetsCampaignMessages,
  getContactConsentDisplay,
} from './contactConsent';

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
        consentSource: 'INBOUND',
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

describe('getContactConsentDisplay', () => {
  it('returns not_on_list for missing contact', () => {
    expect(getContactConsentDisplay(null)).toBe('not_on_list');
    expect(getContactConsentDisplay(undefined)).toBe('not_on_list');
    expect(contactGetsCampaignMessages(null)).toBe(false);
  });

  it('shows stopped only for real opt-outs', () => {
    expect(
      getContactConsentDisplay({
        optedIn: true,
        consentSource: 'INBOUND',
        consentAt: '2026-08-14T12:00:00.000Z',
      })
    ).toBe('eligible');
    expect(
      getContactConsentDisplay({
        optedIn: true,
      })
    ).toBe('not_on_list');
    expect(
      getContactConsentDisplay({
        optedIn: false,
        consentSource: 'STOP_KEYWORD',
        consentAt: '2026-08-14T12:00:00.000Z',
        optOutAt: '2026-08-14T12:00:00.000Z',
      })
    ).toBe('stopped');
  });
});
