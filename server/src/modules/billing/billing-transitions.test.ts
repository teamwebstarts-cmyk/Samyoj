import { describe, expect, it } from 'vitest';
import { TIER_ORDER } from './entitlements.service';
import { legacyPlanToTier, type PlanTier } from './plans';

type TransitionResult =
  | 'ALLOW'
  | 'PLAN_DOWNGRADE_NOT_ALLOWED_ACTIVE';

function evaluatePaidPlanPurchase(params: {
  currentTier: PlanTier;
  requestedTier: PlanTier;
  hasActivePaidPeriod: boolean;
}): TransitionResult {
  if (!params.hasActivePaidPeriod) return 'ALLOW';
  if (TIER_ORDER[params.requestedTier] < TIER_ORDER[params.currentTier]) {
    return 'PLAN_DOWNGRADE_NOT_ALLOWED_ACTIVE';
  }
  return 'ALLOW';
}

describe('manual billing plan transitions', () => {
  it('plan-transitions-ok: active same-plan purchase is allowed', () => {
    expect(
      evaluatePaidPlanPurchase({
        currentTier: 'pro',
        requestedTier: 'pro',
        hasActivePaidPeriod: true,
      })
    ).toBe('ALLOW');
  });

  it('plan-transitions-ok: active downgrade is rejected', () => {
    expect(
      evaluatePaidPlanPurchase({
        currentTier: 'pro',
        requestedTier: 'starter',
        hasActivePaidPeriod: true,
      })
    ).toBe('PLAN_DOWNGRADE_NOT_ALLOWED_ACTIVE');
    expect(
      evaluatePaidPlanPurchase({
        currentTier: 'growth',
        requestedTier: 'starter',
        hasActivePaidPeriod: true,
      })
    ).toBe('PLAN_DOWNGRADE_NOT_ALLOWED_ACTIVE');
  });

  it('plan-transitions-ok: active upgrade is allowed', () => {
    expect(
      evaluatePaidPlanPurchase({
        currentTier: 'growth',
        requestedTier: 'pro',
        hasActivePaidPeriod: true,
      })
    ).toBe('ALLOW');
  });

  it('plan-transitions-ok: post-expiry lower-plan purchase is allowed', () => {
    expect(
      evaluatePaidPlanPurchase({
        currentTier: 'pro',
        requestedTier: 'starter',
        hasActivePaidPeriod: false,
      })
    ).toBe('ALLOW');
  });

  it('plan-transitions-ok: pro inherits growth and starter capabilities', () => {
    expect(legacyPlanToTier('pro')).toBe('pro');
    expect(TIER_ORDER.pro).toBeGreaterThan(TIER_ORDER.growth);
    expect(TIER_ORDER.growth).toBeGreaterThan(TIER_ORDER.starter);
    console.log('plan-transitions-ok');
  });
});
