import { describe, expect, it } from 'vitest';
import { maskBusinessPhone } from './masking';
import { recordContainsRawPhone, toStackedAccountRecord, type AccountListRow } from './records';

describe('admin masking', () => {
  it('masks middle digits and never returns the original phone', () => {
    const raw = '+919876543210';
    const masked = maskBusinessPhone(raw);
    expect(masked).toBe('91••••10');
    expect(masked).not.toContain('987654');
  });

  it('strips raw phones from stacked account records', () => {
    const raw = '+919876543210';
    const row: AccountListRow = {
      id: 'org-1',
      companyName: 'Acme',
      ownerEmail: 'owner@acme.test',
      stage: 'LIVE',
      lastLoginAt: null,
      plan: 'growth',
      qualityRating: 'GREEN',
      aiTokensMonth: 12,
      monthlyTokenLimit: null,
      flags: { aiInactive: false, billingRisk: false, qualityRisk: false, webhookStale: false },
      numbersConnected: 1,
      numbers: [{ maskedPhone: raw }],
    };
    const record = toStackedAccountRecord(row);
    expect(record.maskedNumbers[0]).toBe('91••••10');
    expect(recordContainsRawPhone(record, raw)).toBe(false);
  });
});
