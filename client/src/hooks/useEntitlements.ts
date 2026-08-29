import { useCallback, useEffect, useMemo, useState } from 'react';
import { billingApi } from '../services/api';
import type {
  BillingEntitlementSnapshot,
  BillingInfo,
  EntitlementLimit,
} from '../types';

export type PlanTier = 'launch' | 'starter' | 'growth' | 'pro' | 'enterprise';
export type EntitlementFeature =
  | 'contacts'
  | 'contactImport'
  | 'team'
  | 'whatsapp'
  | 'automations'
  | 'flowPublish'
  | 'aiBots'
  | 'calling'
  | 'campaigns'
  | 'templates'
  | 'analytics'
  | 'integrations'
  | 'advancedInbox';

export type EntitlementQuota =
  | 'waNumbers'
  | 'seats'
  | 'contacts'
  | 'publishedWorkflows';

export interface EntitlementQuotaView {
  used: number;
  limit: EntitlementLimit;
}

const TIER_ORDER: PlanTier[] = ['launch', 'starter', 'growth', 'pro', 'enterprise'];

export interface Entitlements {
  planTier: PlanTier;
  planName: string;
  subscriptionStatus: string;
  trialDaysRemaining: number | null;
  daysUntilExpiry: number | null;
  periodEnd: string | null;
  isLocked: boolean;
  isReadOnly: boolean;
  features: {
    [key in EntitlementFeature]: boolean;
  };
  limits: {
    waNumbers: EntitlementLimit;
    seats: EntitlementLimit;
    contacts: EntitlementLimit;
    publishedWorkflows: EntitlementLimit;
  };
  quotas: {
    waNumbers: EntitlementQuotaView;
    seats: EntitlementQuotaView;
    contacts: EntitlementQuotaView;
    publishedWorkflows: EntitlementQuotaView;
  };
  canUseFeature: (feature: EntitlementFeature) => boolean;
  canAddToQuota: (quota: EntitlementQuota, amount?: number) => boolean;
  getQuota: (quota: EntitlementQuota) => EntitlementQuotaView;
  getUpgradePlan: (featureOrQuota: EntitlementFeature | EntitlementQuota) => PlanTier;
}

const TIER_FEATURE_THRESHOLDS: Record<EntitlementFeature, PlanTier> = {
  contacts: 'launch',
  contactImport: 'launch',
  team: 'launch',
  whatsapp: 'launch',
  automations: 'launch',
  flowPublish: 'launch',
  aiBots: 'growth',
  calling: 'pro',
  campaigns: 'launch',
  templates: 'launch',
  analytics: 'growth',
  integrations: 'growth',
  advancedInbox: 'pro',
};

const DEFAULT_QUOTAS: Record<
  PlanTier,
  Record<EntitlementQuota, EntitlementLimit>
> = {
  launch: { waNumbers: 1, seats: 1, contacts: 100, publishedWorkflows: 1 },
  starter: { waNumbers: 1, seats: 3, contacts: 5000, publishedWorkflows: 5 },
  growth: { waNumbers: 2, seats: 10, contacts: 25000, publishedWorkflows: 'unlimited' },
  pro: { waNumbers: 5, seats: 25, contacts: 100000, publishedWorkflows: 'unlimited' },
  enterprise: {
    waNumbers: 'unlimited',
    seats: 'custom',
    contacts: 'unlimited',
    publishedWorkflows: 'unlimited',
  },
};

type BillingCurrentPayload = {
  plan?: string;
  planTier?: PlanTier;
  subscriptionStatus?: string;
  planExpiresAt?: string | null;
  entitlements?: BillingEntitlementSnapshot;
};

function daysBetween(from: string | null | undefined, to: Date = new Date()): number | null {
  if (!from) return null;
  const ms = new Date(from).getTime() - to.getTime();
  return Math.round(ms / 86_400_000);
}

function asPlanTier(value: string | undefined): PlanTier {
  return TIER_ORDER.includes(value as PlanTier) ? (value as PlanTier) : 'starter';
}

function isBillingInfo(value: BillingInfo | BillingCurrentPayload): value is BillingInfo {
  return 'currentPlan' in value && Array.isArray(value.plans);
}

function readQuota(
  snapshot: BillingEntitlementSnapshot | undefined,
  quota: EntitlementQuota,
  fallbackLimit: EntitlementLimit,
  fallbackUsed: number,
): EntitlementQuotaView {
  const serverQuota = snapshot?.quotas?.[quota];
  if (serverQuota && typeof serverQuota.used === 'number' && serverQuota.limit !== undefined) {
    return {
      used: Math.max(0, serverQuota.used),
      limit: serverQuota.limit,
    };
  }

  const serverLimit = snapshot?.limits?.[quota];
  const serverUsed = snapshot?.usage?.[quota];
  if (
    (typeof serverLimit === 'number' || serverLimit === 'unlimited' || serverLimit === 'custom') &&
    (serverUsed === undefined || typeof serverUsed === 'number')
  ) {
    return {
      used: Math.max(0, serverUsed ?? fallbackUsed),
      limit: serverLimit,
    };
  }

  return { used: Math.max(0, fallbackUsed), limit: fallbackLimit };
}

function readFeature(
  snapshot: BillingEntitlementSnapshot | undefined,
  feature: EntitlementFeature,
  fallback: boolean,
): boolean {
  const aliases: Record<EntitlementFeature, string[]> = {
    contacts: ['contacts'],
    contactImport: ['contactImport', 'imports', 'contactsImport'],
    team: ['team', 'teamMembers', 'seats'],
    whatsapp: ['whatsapp', 'whatsappConnect', 'whatsappNumbers'],
    automations: ['automations', 'automation'],
    flowPublish: ['flowPublish', 'publishedWorkflows', 'workflows'],
    aiBots: ['aiBots', 'ai', 'aiChat'],
    calling: ['calling', 'voiceCalling'],
    campaigns: ['campaigns', 'campaignAccess'],
    templates: ['templates', 'templateManagement'],
    analytics: ['analytics', 'advancedAnalytics', 'analyticsAdvanced'],
    integrations: ['integrations', 'publicApi', 'advancedIntegrations'],
    advancedInbox: ['advancedInbox', 'inboxAdvanced'],
  };

  for (const key of aliases[feature]) {
    const value = snapshot?.features?.[key];
    if (typeof value === 'boolean') return value;
  }

  const quotaValue =
    feature === 'aiBots'
      ? snapshot?.quotas?.aiIncluded !== undefined
        ? snapshot.quotas.aiIncluded !== 'off'
        : undefined
      : feature === 'calling'
        ? snapshot?.quotas?.callingIncluded
        : feature === 'analytics'
          ? snapshot?.quotas?.analyticsAdvanced
          : feature === 'campaigns'
            ? snapshot?.quotas?.campaigns
            : feature === 'integrations'
              ? snapshot?.quotas?.integrations
              : feature === 'templates'
                ? snapshot?.quotas?.templates
                : feature === 'advancedInbox'
                  ? snapshot?.quotas?.advancedInbox
                  : undefined;
  return typeof quotaValue === 'boolean' ? quotaValue : fallback;
}

export function deriveEntitlements(
  payload: BillingInfo | BillingCurrentPayload,
): Entitlements {
  const snapshot = payload.entitlements;
  const tier = asPlanTier(snapshot?.planTier || payload.planTier || payload.plan);
  const fallbackPlan = isBillingInfo(payload) ? payload.currentPlan : undefined;
  const defaultLimits = DEFAULT_QUOTAS[tier];
  const fallbackLimit = (quota: EntitlementQuota): EntitlementLimit => {
    if (fallbackPlan) {
      const value: number | string =
        quota === 'waNumbers'
          ? fallbackPlan.waNumbers
          : quota === 'seats'
            ? fallbackPlan.seats
            : quota === 'contacts'
              ? fallbackPlan.contacts
              : fallbackPlan.publishedWorkflows;
      if (typeof value === 'number' || value === 'unlimited' || value === 'custom') return value;
    }
    return defaultLimits[quota];
  };
  const fallbackUsed = (quota: EntitlementQuota): number => {
    if (!isBillingInfo(payload)) return 0;
    if (quota === 'seats') return payload.seatsUsed ?? 0;
    return 0;
  };

  const quotas = {
    waNumbers: readQuota(snapshot, 'waNumbers', fallbackLimit('waNumbers'), fallbackUsed('waNumbers')),
    seats: readQuota(snapshot, 'seats', fallbackLimit('seats'), fallbackUsed('seats')),
    contacts: readQuota(snapshot, 'contacts', fallbackLimit('contacts'), fallbackUsed('contacts')),
    publishedWorkflows: readQuota(
      snapshot,
      'publishedWorkflows',
      fallbackLimit('publishedWorkflows'),
      fallbackUsed('publishedWorkflows'),
    ),
  };

  const features = {} as Entitlements['features'];
  (Object.keys(TIER_FEATURE_THRESHOLDS) as EntitlementFeature[]).forEach((feature) => {
    const fallback = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(TIER_FEATURE_THRESHOLDS[feature]);
    features[feature] = readFeature(snapshot, feature, fallback);
  });

  const status = snapshot?.subscriptionStatus || payload.subscriptionStatus || 'trial';
  const expiry = snapshot?.planExpiresAt || (isBillingInfo(payload)
    ? payload.trialEndsAt || payload.currentPeriodEnd || payload.planExpiresAt
    : payload.planExpiresAt);
  const periodExpired = Boolean(expiry && new Date(expiry).getTime() <= Date.now());
  const statusLocked = ['trial_expired', 'locked', 'expired', 'cancelled', 'past_due'].includes(status);
  // Trust the server snapshot when it is present. Local testing sets isLocked=false
  // even if planExpiresAt is in the past; re-deriving the lock here greys every Send button.
  const isLocked =
    snapshot?.isLocked !== undefined
      ? Boolean(snapshot.isLocked)
      : statusLocked || periodExpired;
  const daysUntilExpiry = daysBetween(expiry);
  const planName =
    snapshot?.planName ||
    (isBillingInfo(payload) ? fallbackPlan?.name : undefined) ||
    (tier === 'launch' ? 'Kickstart' : tier[0].toUpperCase() + tier.slice(1));

  const getQuota = (quota: EntitlementQuota) => quotas[quota];
  const getUpgradePlan = (featureOrQuota: EntitlementFeature | EntitlementQuota): PlanTier => {
    if (featureOrQuota === 'contacts') {
      return tier === 'launch' ? 'starter' : tier === 'starter' ? 'growth' : 'pro';
    }
    if (featureOrQuota === 'seats' || featureOrQuota === 'waNumbers') {
      return tier === 'launch' || tier === 'starter' ? 'growth' : 'pro';
    }
    if (featureOrQuota in TIER_FEATURE_THRESHOLDS) {
      const required = TIER_FEATURE_THRESHOLDS[featureOrQuota as EntitlementFeature];
      const currentIndex = TIER_ORDER.indexOf(tier);
      const requiredIndex = TIER_ORDER.indexOf(required);
      if (!features[featureOrQuota as EntitlementFeature] && currentIndex >= requiredIndex) {
        return TIER_ORDER[Math.min(currentIndex + 1, TIER_ORDER.length - 1)];
      }
      return required;
    }
    return 'growth';
  };

  const canUseFeature = (feature: EntitlementFeature) => !isLocked && features[feature];
  const canAddToQuota = (quota: EntitlementQuota, amount = 1) => {
    if (isLocked || amount < 0) return false;
    const { used, limit } = quotas[quota];
    return limit === 'unlimited' || limit === 'custom' || used + amount <= limit;
  };

  return {
    planTier: tier,
    planName,
    subscriptionStatus: status,
    trialDaysRemaining: isBillingInfo(payload) ? daysBetween(payload.trialEndsAt) : null,
    daysUntilExpiry,
    periodEnd: expiry || null,
    isLocked,
    isReadOnly: isLocked,
    features,
    limits: {
      waNumbers: quotas.waNumbers.limit,
      seats: quotas.seats.limit,
      contacts: quotas.contacts.limit,
      publishedWorkflows: quotas.publishedWorkflows.limit,
    },
    quotas,
    canUseFeature,
    canAddToQuota,
    getQuota,
    getUpgradePlan,
  };
}

export function useEntitlements() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      let data: BillingInfo | BillingCurrentPayload;
      try {
        const res = await billingApi.current();
        data = res.data.data as BillingCurrentPayload;
      } catch {
        const res = await billingApi.get();
        data = res.data.data as BillingInfo;
      }
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
    (feature: EntitlementFeature) => (entitlements ? entitlements.canUseFeature(feature) : false),
    [entitlements],
  );

  const isCommercial = entitlements ? !entitlements.isLocked : false;

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
