import { describe, expect, it } from 'vitest';
import {
  buildConsentSnapshot,
  canRetryCampaignRecipient,
  fitsReservedQuota,
  isAbsoluteInstant,
  isClaimLeaseExpired,
} from './safety';

describe('campaign safety boundaries', () => {
  it('expires a claimed lease deterministically', () => {
    const now = new Date('2026-08-09T00:00:00.000Z');
    expect(isClaimLeaseExpired(new Date('2026-08-08T23:45:00.001Z'), now, 15 * 60 * 1000)).toBe(false);
    expect(isClaimLeaseExpired(new Date('2026-08-08T23:45:00.000Z'), now, 15 * 60 * 1000)).toBe(true);
  });

  it('requires absolute UTC scheduling instants', () => {
    expect(isAbsoluteInstant('2026-08-09T12:00:00.000Z')).toBe(true);
    expect(isAbsoluteInstant('2026-08-09T12:00:00+05:30')).toBe(false);
    expect(isAbsoluteInstant('2026-08-09T12:00:00')).toBe(false);
  });

  it('captures business, policy, provenance, opt-out, and typed decision data', () => {
    const snapshot = buildConsentSnapshot({
      phone: '919999999999',
      business: { organizationId: 'org-1', name: 'Acme', businessId: 'biz-1', phoneNumberId: 'pn-1' },
      category: 'MARKETING',
      policyVersion: 'campaign-consent-v2',
      capturedAt: new Date('2026-08-09T00:00:00.000Z'),
      contact: {
        optedIn: true,
        consentSource: 'EXPLICIT',
        consentAt: new Date('2026-08-01T00:00:00.000Z'),
        consentVersion: 'form-v3',
        consentDecision: { type: 'OPT_IN', method: 'checkbox' },
        optOutAt: null,
      },
    });
    expect(snapshot).toMatchObject({
      business: { organizationId: 'org-1', businessId: 'biz-1' },
      category: 'MARKETING',
      policyVersion: 'campaign-consent-v2',
      source: 'EXPLICIT',
      consentVersion: 'form-v3',
      decision: { type: 'OPT_IN' },
      optedIn: true,
    });
  });

  it('rejects ambiguous outcomes from ordinary retry', () => {
    expect(canRetryCampaignRecipient('FAILED')).toBe(true);
    expect(canRetryCampaignRecipient('AMBIGUOUS')).toBe(false);
    expect(canRetryCampaignRecipient('SENT')).toBe(false);
  });

  it('enforces both locked send and budget reservations', () => {
    const base = {
      sentCount: 10,
      reservedSendCount: 20,
      requestedSendCount: 5,
      sendLimit: 40,
      spentBudgetCents: 1000,
      reservedBudgetCents: 2000,
      requestedBudgetCents: 500,
      budgetLimitCents: 4000,
    };
    expect(fitsReservedQuota(base)).toBe(true);
    expect(fitsReservedQuota({ ...base, reservedBudgetCents: 2501 })).toBe(false);
    expect(fitsReservedQuota({ ...base, requestedSendCount: 11 })).toBe(false);
  });
});
