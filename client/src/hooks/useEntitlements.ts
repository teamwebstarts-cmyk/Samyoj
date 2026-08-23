import { useCallback, useEffect, useMemo, useState } from 'react';
import { billingApi } from '../services/api';
import type { BillingInfo } from '../types';

export type PlanTier = 'launch' | 'starter' | 'growth' | 'pro' | 'enterprise';

const TIER_ORDER: PlanTier[] = ['launch', 'starter', 'growth', 'pro', 'enterprise'];

export interface Entitlements {
  planTier: PlanTier;
  subscriptionStatus: string;
  trialDaysRemaining: number | null;
  daysUntilExpiry: number | null;
  features: {
    aiBots: boolean;
    calling: boolean;
    campaigns: boolean;
  };
  limits: {
    seats: number;
  };
}

const TIER_FEATURE_THRESHOLDS: Record<
  keyof Entitlements['features'],
  PlanTier
> = {
  aiBots: 'growth',
  calling: 'pro',
  campaigns: 'starter',
};

function daysBetween(from: string | null | undefined, to: Date = new Date()): number | null {
  if (!from) return null;
  const ms = new Date(from).getTime() - to.getTime();
  return Math.round(ms / 86_400_000);
}

function deriveEntitlements(info: BillingInfo): Entitlements {
  const tier = (info.planTier || info.plan || 'starter') as PlanTier;
  const features = {
    aiBots: TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(TIER_FEATURE_THRESHOLDS.aiBots),
    calling:
      TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(TIER_FEATURE_THRESHOLDS.calling),
    campaigns:
      TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(TIER_FEATURE_THRESHOLDS.campaigns),
  };

  const expiry = info.trialEndsAt || info.currentPeriodEnd || info.planExpiresAt;
  const daysUntilExpiry = daysBetween(expiry);

  return {
    planTier: tier,
    subscriptionStatus: info.subscriptionStatus || 'trial',
    trialDaysRemaining: daysBetween(info.trialEndsAt),
    daysUntilExpiry,
    features,
    limits: {
      seats: info.seatLimit ?? 1,
    },
  };
}

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await billingApi.get();
      const data = res.data.data as BillingInfo;
      setEntitlements(deriveEntitlements(data));
      setError(null);
    } catch (e) {
      setError(e as Error);
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onBillingUpdated = () => {
      refresh();
    };
    window.addEventListener('billing:updated', onBillingUpdated);
    return () => window.removeEventListener('billing:updated', onBillingUpdated);
  }, [refresh]);

  const isPlanAtLeast = useCallback(
    (tier: PlanTier) =>
      entitlements
        ? TIER_ORDER.indexOf(entitlements.planTier) >= TIER_ORDER.indexOf(tier)
        : false,
    [entitlements],
  );

  const hasFeature = useCallback(
    (feature: keyof Entitlements['features']) =>
      entitlements ? entitlements.features[feature] : false,
    [entitlements],
  );

  const isCommercial = entitlements
    ? entitlements.subscriptionStatus !== 'cancelled'
    : false;

  return useMemo(
    () => ({
      entitlements,
      loading,
      error,
      refresh,
      isPlanAtLeast,
      hasFeature,
      isCommercial,
    }),
    [entitlements, loading, error, refresh, isPlanAtLeast, hasFeature, isCommercial],
  );
}
