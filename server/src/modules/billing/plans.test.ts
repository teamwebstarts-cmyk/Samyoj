import { describe, expect, it } from 'vitest';
import { BILLING_PLANS, getPlan, BillingPlanDef } from './plans';

const REQUIRED_FIELDS: (keyof BillingPlanDef)[] = ['id', 'name', 'pricePaise', 'priceLabel', 'seats', 'features'];

describe('BILLING_PLANS', () => {
  it('contains the expected plan IDs', () => {
    const ids = BILLING_PLANS.map((p) => p.id);
    expect(ids).toEqual(['starter', 'growth', 'business', 'enterprise']);
  });

  it('every plan has all required fields', () => {
    for (const plan of BILLING_PLANS) {
      for (const field of REQUIRED_FIELDS) {
        expect(plan).toHaveProperty(field);
      }
    }
  });

  it('features is a non-empty array for every plan', () => {
    for (const plan of BILLING_PLANS) {
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('every plan has a non-empty string id and name', () => {
    for (const plan of BILLING_PLANS) {
      expect(typeof plan.id).toBe('string');
      expect(plan.id.length).toBeGreaterThan(0);
      expect(typeof plan.name).toBe('string');
      expect(plan.name.length).toBeGreaterThan(0);
    }
  });

  it('starter is free (pricePaise = 0)', () => {
    const starter = BILLING_PLANS.find((p) => p.id === 'starter')!;
    expect(starter.pricePaise).toBe(0);
    expect(starter.priceLabel).toBe('Free');
  });

  it('enterprise is custom-priced (pricePaise = 0, priceLabel = Custom)', () => {
    const enterprise = BILLING_PLANS.find((p) => p.id === 'enterprise')!;
    expect(enterprise.pricePaise).toBe(0);
    expect(enterprise.priceLabel).toBe('Custom');
  });

  it('growth and business have positive pricePaise', () => {
    const growth = BILLING_PLANS.find((p) => p.id === 'growth')!;
    const business = BILLING_PLANS.find((p) => p.id === 'business')!;
    expect(growth.pricePaise).toBeGreaterThan(0);
    expect(business.pricePaise).toBeGreaterThan(0);
  });

  it('seats increase from starter → growth → business → enterprise', () => {
    const seats = BILLING_PLANS.map((p) => p.seats);
    for (let i = 1; i < seats.length; i++) {
      expect(seats[i]).toBeGreaterThan(seats[i - 1]);
    }
  });
});

describe('getPlan', () => {
  it('returns the plan for a valid ID', () => {
    const plan = getPlan('growth');
    expect(plan).toBeDefined();
    expect(plan!.id).toBe('growth');
    expect(plan!.name).toBe('Growth');
  });

  it('returns undefined for an invalid ID', () => {
    expect(getPlan('nonexistent')).toBeUndefined();
    expect(getPlan('')).toBeUndefined();
  });

  it('returns undefined for case-sensitive mismatch', () => {
    expect(getPlan('Growth')).toBeUndefined();
    expect(getPlan('STARTER')).toBeUndefined();
  });

  it('returns each plan by its ID', () => {
    for (const expected of BILLING_PLANS) {
      const result = getPlan(expected.id);
      expect(result).toBe(expected);
    }
  });
});
