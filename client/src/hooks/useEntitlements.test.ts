import { describe, expect, it } from 'vitest';
import { deriveEntitlements } from './useEntitlements';

describe('deriveEntitlements', () => {
  it('uses the server snapshot for feature flags and quota usage', () => {
    const entitlements = deriveEntitlements({
      plan: 'growth',
      subscriptionStatus: 'active',
      entitlements: {
        planTier: 'growth',
        planName: 'Growth',
        subscriptionStatus: 'active',
        isLocked: false,
        quotas: {
          contacts: { used: 25_000, limit: 25_000 },
          seats: { used: 9, limit: 10 },
          waNumbers: { used: 2, limit: 2 },
          publishedWorkflows: { used: 3, limit: 'unlimited' },
          aiIncluded: 'included',
          callingIncluded: false,
          analyticsAdvanced: false,
          campaigns: false,
          integrations: true,
          advancedInbox: false,
        },
        features: {
          advancedInbox: false,
        },
      },
    });

    expect(entitlements.planTier).toBe('growth');
    expect(entitlements.quotas.contacts).toEqual({ used: 25_000, limit: 25_000 });
    expect(entitlements.canAddToQuota('contacts')).toBe(false);
    expect(entitlements.canUseFeature('advancedInbox')).toBe(false);
    expect(entitlements.canUseFeature('campaigns')).toBe(false);
    expect(entitlements.canUseFeature('calling')).toBe(false);
    expect(entitlements.canUseFeature('integrations')).toBe(true);
    expect(entitlements.limits.publishedWorkflows).toBe('unlimited');
    expect(entitlements.getUpgradePlan('contacts')).toBe('pro');
  });

  it('fails closed for a locked organization while keeping the snapshot readable', () => {
    const entitlements = deriveEntitlements({
      plan: 'pro',
      entitlements: {
        planTier: 'pro',
        subscriptionStatus: 'past_due',
        isLocked: true,
        quotas: {
          contacts: { used: 12, limit: 100_000 },
        },
      },
    });

    expect(entitlements.isLocked).toBe(true);
    expect(entitlements.isReadOnly).toBe(true);
    expect(entitlements.canUseFeature('contacts')).toBe(false);
    expect(entitlements.canAddToQuota('contacts')).toBe(false);
    expect(entitlements.quotas.contacts.used).toBe(12);
  });

  it('falls back to the billing catalog when the detailed endpoint is unavailable', () => {
    const entitlements = deriveEntitlements({
      plan: 'starter',
      planTier: 'starter',
      subscriptionStatus: 'active',
      currentPlan: {
        id: 'starter',
        name: 'Starter',
        pricePaise: 0,
        priceLabel: '₹0',
        seats: 3,
        waNumbers: 1,
        contacts: 5_000,
        publishedWorkflows: 5,
        aiIncluded: 'off',
        callingIncluded: false,
        features: [],
      },
      plans: [],
      seatsUsed: 2,
      seatLimit: 3,
      canManageBilling: true,
      razorpayConfigured: false,
      razorpayKeyId: null,
    });

    expect(entitlements.planTier).toBe('starter');
    expect(entitlements.quotas.seats).toEqual({ used: 2, limit: 3 });
    expect(entitlements.quotas.contacts).toEqual({ used: 0, limit: 5_000 });
    expect(entitlements.canUseFeature('aiBots')).toBe(false);
    console.log('client-entitlements-ok');
  });
});
