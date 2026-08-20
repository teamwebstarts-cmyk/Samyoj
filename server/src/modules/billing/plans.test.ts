import { describe, it, expect } from 'vitest';
import {
  BILLING_SKUS,
  getSku,
  getSkusByTier,
  PLAN_TIERS,
  getPlanTier,
  legacyPlanToTier,
  BILLING_PLANS,
  getPlan,
} from './plans';

describe('plans.ts', () => {
  describe('SKUs', () => {
    it('should have the expected SKUs', () => {
      const ids = BILLING_SKUS.map((s) => s.id);
      expect(ids).toEqual([
        'launch_trial',
        'starter_monthly',
        'starter_quarterly',
        'starter_yearly',
        'growth_monthly',
        'growth_quarterly',
        'growth_yearly',
        'pro_monthly',
        'pro_quarterly',
        'pro_yearly',
      ]);
    });

    it('should have the correct pricePaise values', () => {
      const prices = BILLING_SKUS.map((s) => s.pricePaise);
      expect(prices).toEqual([
        0,
        99900,
        285000,
        960000,
        249900,
        712500,
        2400000,
        499900,
        1425000,
        4800000,
      ]);
    });

    it('should calculate inclGstPaise correctly (18%)', () => {
      BILLING_SKUS.forEach((sku) => {
        expect(sku.inclGstPaise).toBe(Math.round(sku.pricePaise * 1.18));
      });
    });

    it('should allow UPI Autopay correctly based on cap', () => {
      expect(getSku('growth_yearly')?.upiAutopayAllowed).toBe(false);
      expect(getSku('pro_quarterly')?.upiAutopayAllowed).toBe(false);
      expect(getSku('pro_yearly')?.upiAutopayAllowed).toBe(false);

      expect(getSku('starter_monthly')?.upiAutopayAllowed).toBe(true);
      expect(getSku('growth_monthly')?.upiAutopayAllowed).toBe(true);
      expect(getSku('pro_monthly')?.upiAutopayAllowed).toBe(true);
    });
  });

  describe('Functions', () => {
    it('getSku returns correct SKU', () => {
      const sku = getSku('growth_monthly');
      expect(sku).toBeDefined();
      expect(sku?.id).toBe('growth_monthly');
    });

    it('getSkusByTier returns correct SKUs', () => {
      const skus = getSkusByTier('growth');
      expect(skus).toHaveLength(3);
      expect(skus.every((s) => s.planTier === 'growth')).toBe(true);
    });

    it('legacyPlanToTier maps correctly', () => {
      expect(legacyPlanToTier('starter')).toBe('starter');
      expect(legacyPlanToTier('growth')).toBe('growth');
      expect(legacyPlanToTier('business')).toBe('pro');
      expect(legacyPlanToTier('enterprise')).toBe('enterprise');
      expect(legacyPlanToTier('random')).toBe('launch');
    });

    it('PLAN_TIERS has correct entitlements', () => {
      expect(PLAN_TIERS.launch.waNumbers).toBe(1);
      expect(PLAN_TIERS.starter.seats).toBe(3);
      expect(PLAN_TIERS.growth.contacts).toBe(25000);
      expect(PLAN_TIERS.pro.waNumbers).toBe(5);
    });

    it('getPlanTier returns correct tier', () => {
      const tier = getPlanTier('starter');
      expect(tier.tier).toBe('starter');
      expect(tier.seats).toBe(3);
    });
  });

  describe('Legacy plans (backward compat)', () => {
    it('getPlan returns correct legacy plan', () => {
      expect(getPlan('starter')?.id).toBe('starter');
      expect(getPlan('growth')?.id).toBe('growth');
      expect(getPlan('pro')?.id).toBe('pro');
    });
  });
});
