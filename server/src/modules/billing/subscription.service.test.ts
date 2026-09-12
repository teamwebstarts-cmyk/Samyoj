import { describe, expect, it } from 'vitest';
import {
  calculateUpgradeProration,
  mapSubscriptionEventStatus,
  subscriptionCadencesForTier,
} from './subscription.service';

describe('subscription lifecycle contracts', () => {
  it('maps every provider lifecycle event to a server state', () => {
    expect(mapSubscriptionEventStatus('subscription.authenticated')).toBe('ACTIVE');
    expect(mapSubscriptionEventStatus('subscription.pending')).toBe('PAST_DUE');
    expect(mapSubscriptionEventStatus('subscription.halted')).toBe('HALTED');
    expect(mapSubscriptionEventStatus('subscription.paused')).toBe('PAUSED');
    expect(mapSubscriptionEventStatus('subscription.resumed')).toBe('ACTIVE');
    expect(mapSubscriptionEventStatus('subscription.cancelled')).toBe('CANCELLED');
    expect(mapSubscriptionEventStatus('subscription.completed')).toBe('COMPLETED');
    expect(mapSubscriptionEventStatus('subscription.unknown')).toBeNull();
  });

  it('prorates using the stored old and new cadence lengths', () => {
    expect(
      calculateUpgradeProration({
        remainingDays: 182,
        currentPeriodDays: 365,
        currentAmountPaise: 960_000,
        newPeriodDays: 90,
        newAmountPaise: 849_300,
      })
    ).toEqual({
      remainingDays: 182,
      unusedCredit: 478_684,
      newDebit: 1_717_473,
      netPaise: 1_238_789,
    });
  });

  it('exposes only paid recurring cadences for a tier', () => {
    expect(subscriptionCadencesForTier('growth').map((sku) => sku.id)).toEqual([
      'growth_monthly',
      'growth_quarterly',
      'growth_yearly',
    ]);
  });
});
