import { describe, expect, it } from 'vitest';
import {
  contactConsentData,
  contactCreateConsentFields,
  contactListOptedInWhere,
  inboundReplyConsentFields,
  shouldGrantInboundReplyConsent,
} from './consent';

describe('contact consent mutations', () => {
  it('writes source, timestamp, version, and decision when opted in', () => {
    const at = new Date('2026-08-14T12:00:00.000Z');
    const data = contactConsentData(true, 'MANUAL', at);
    expect(data).toMatchObject({
      optedIn: true,
      consentSource: 'MANUAL',
      consentAt: at,
      consentVersion: 'manual-v1',
      optOutAt: null,
    });
    expect(data.consentDecision).toMatchObject({
      type: 'OPT_IN',
      optedIn: true,
      source: 'MANUAL',
    });
  });

  it('writes optOutAt when opted out', () => {
    const at = new Date('2026-08-14T12:00:00.000Z');
    const data = contactConsentData(false, 'MANUAL', at);
    expect(data).toMatchObject({
      optedIn: false,
      optOutAt: at,
    });
    expect(data.consentSource).toBeUndefined();
    expect(data.consentDecision).toMatchObject({ type: 'OPT_OUT', optedIn: false });
  });

  it('defaults new contacts to auditable campaign consent when optedIn is omitted', () => {
    const data = contactCreateConsentFields(undefined, 'MANUAL');
    expect(data).toMatchObject({
      optedIn: true,
      consentSource: 'MANUAL',
      optOutAt: null,
    });
    expect(data.consentAt).toBeInstanceOf(Date);
  });

  it('filters the contact list with the same auditable consent shape as campaigns', () => {
    expect(contactListOptedInWhere('true')).toEqual({
      optedIn: true,
      consentSource: { not: null },
      consentAt: { not: null },
      optOutAt: null,
    });
    expect(contactListOptedInWhere('false')).toEqual({
      NOT: {
        optedIn: true,
        consentSource: { not: null },
        consentAt: { not: null },
        optOutAt: null,
      },
    });
  });

  it('records inbound reply consent for campaign eligibility', () => {
    const at = new Date('2026-08-14T12:00:00.000Z');
    expect(inboundReplyConsentFields(at)).toMatchObject({
      optedIn: true,
      consentSource: 'INBOUND',
      consentAt: at,
      optOutAt: null,
    });
  });

  it('skips inbound consent repair after opt-out or when already auditable', () => {
    expect(
      shouldGrantInboundReplyConsent({
        optedIn: true,
        consentSource: 'INBOUND',
        consentAt: new Date(),
        optOutAt: null,
      })
    ).toBe(false);
    expect(
      shouldGrantInboundReplyConsent({
        consentSource: 'STOP_KEYWORD',
        consentAt: new Date(),
        optOutAt: new Date(),
      })
    ).toBe(false);
    expect(
      shouldGrantInboundReplyConsent({
        consentSource: null,
        consentAt: null,
        optOutAt: null,
      })
    ).toBe(true);
  });
});
