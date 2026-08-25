import { describe, expect, it } from 'vitest';
import {
  periodIsExpired,
  periodSnapshot,
  tierFromPeriodOrCache,
} from './billing-state.service';

describe('billing-state.service', () => {
  it('billing-state-ok: prefers ledger tier over legacy cache', () => {
    expect(
      tierFromPeriodOrCache({ planTier: 'pro' }, 'starter')
    ).toBe('pro');
    expect(tierFromPeriodOrCache(null, 'growth')).toBe('growth');
    console.log('billing-state-ok');
  });

  it('billing-state-ok: detects expired periods', () => {
    const expired = { endsAt: new Date(Date.now() - 60_000) };
    const active = { endsAt: new Date(Date.now() + 60_000) };
    expect(periodIsExpired(null)).toBe(false);
    expect(periodIsExpired(expired)).toBe(true);
    expect(periodIsExpired(active)).toBe(false);
  });

  it('billing-state-ok: snapshots period metadata for audit trails', () => {
    const startsAt = new Date('2026-08-01T00:00:00.000Z');
    const endsAt = new Date('2026-09-01T00:00:00.000Z');
    expect(
      periodSnapshot({
        planTier: 'growth',
        skuId: 'growth_monthly',
        cadence: 'monthly',
        startsAt,
        endsAt,
        amountPaise: 249900,
        currency: 'INR',
        taxAmountPaise: 44982,
        sourcePaymentOrderId: 'order-1',
      })
    ).toEqual({
      planTier: 'growth',
      skuId: 'growth_monthly',
      cadence: 'monthly',
      startsAt,
      endsAt,
      amountPaise: 249900,
      currency: 'INR',
      taxAmountPaise: 44982,
      sourcePaymentOrderId: 'order-1',
      status: 'ACTIVE',
      supersedesId: null,
    });
  });
});
