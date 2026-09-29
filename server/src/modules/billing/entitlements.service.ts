import prisma from '../../config/database';
import { config } from '../../config';
import {
  PlanTier,
  PLAN_TIERS,
  legacyPlanToTier,
} from './plans';
import { AppError } from '../../utils/response';

function unlockLocalTesting(): boolean {
  return config.nodeEnv === 'development' && config.billing.allowTestBypass && !process.env.VITEST;
}

export type QuotaType =
  | 'waNumbers'
  | 'seats'
  | 'contacts'
  | 'publishedWorkflows'
  | 'ai'
  | 'calling';

export type FeatureType =
  | 'ai'
  | 'calling'
  | 'campaigns'
  | 'analyticsAdvanced'
  | 'integrations'
  | 'publicApi'
  | 'templates'
  | 'forms'
  | 'advancedInbox'
  | 'support';

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number | 'unlimited' | 'custom';
  upgradeCta: PlanTier;
  reason?: string;
  code?: string;
}

export interface OrgEntitlements {
  orgId: string;
  planTier: PlanTier;
  planName: string;
  subscriptionStatus: string;
  isLocked: boolean;
  softLocked: boolean;
  planExpiresAt: Date | null;
  planPeriodId: string | null;
  periodStartsAt: Date | null;
  periodEndsAt: Date | null;
  quotas: {
    waNumbers: { used: number; limit: number | 'unlimited' };
    seats: { used: number; limit: number | 'custom' };
    contacts: { used: number; limit: number | 'unlimited' };
    publishedWorkflows: { used: number; limit: number | 'unlimited' };
    aiIncluded: 'off' | 'included' | 'advanced' | 'dedicated';
    callingIncluded: boolean;
    analyticsAdvanced: boolean;
    campaigns: boolean;
    integrations: boolean;
    publicApi: boolean;
    templates: boolean;
    forms: boolean;
    advancedInbox: boolean;
    supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  };
}

export const TIER_ORDER: Record<PlanTier, number> = {
  launch: 0,
  starter: 1,
  growth: 2,
  pro: 3,
  enterprise: 4,
};

export function isTierSufficient(currentTier: PlanTier, requiredTier: PlanTier): boolean {
  return TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];
}

/**
 * Returns full entitlements and current usage snapshot for an organization.
 */
export async function getOrgEntitlements(organizationId: string): Promise<OrgEntitlements> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      plan: true,
      subscriptionStatus: true,
      planExpiresAt: true,
    },
  });

  if (!org) {
    throw new AppError(404, 'Organization not found');
  }

  const periodModel = (prisma as typeof prisma & {
    planPeriod?: {
      findFirst: (args: unknown) => Promise<{
        id: string;
        planTier: string;
        startsAt: Date;
        endsAt: Date;
        status: string;
      } | null>;
    };
  }).planPeriod;
  const subscriptionModel = (prisma as typeof prisma & {
    billingSubscription?: {
      findFirst: (args: unknown) => Promise<{ status: string; graceEndsAt: Date | null } | null>;
    };
  }).billingSubscription;

  // Keep unit tests and old databases readable while the additive migration is
  // rolling out. Once present, the ledger wins over the compatibility cache.
  const [currentPeriod, latestPeriod] = periodModel?.findFirst
    ? await Promise.all([
        periodModel.findFirst({
          where: {
            organizationId,
            status: 'ACTIVE',
            startsAt: { lte: new Date() },
            endsAt: { gt: new Date() },
          },
          orderBy: { startsAt: 'desc' },
        }),
        periodModel.findFirst({
          where: { organizationId },
          orderBy: { startsAt: 'desc' },
        }),
      ])
    : [null, null];

  const [waCount, seatCount, inviteCount, contactCount, automationCount, flowCount] =
    await Promise.all([
      prisma.whatsappNumber.count({
        where: { organizationId, isActive: true },
      }),
      prisma.organizationUser.count({
        where: { organizationId },
      }),
      prisma.teamInvite.count({
        where: { organizationId, status: 'PENDING' },
      }),
      prisma.contact.count({
        where: { organizationId },
      }),
      prisma.automation.count({
        where: { organizationId, enabled: true },
      }),
      prisma.flow?.count
        ? prisma.flow.count({
            where: { organizationId, enabled: true, status: 'PUBLISHED' },
          })
        : Promise.resolve(0),
    ]);

  const currentSubscription = subscriptionModel?.findFirst
    ? await subscriptionModel.findFirst({
        where: {
          organizationId,
          status: { in: ['PAST_DUE', 'GRACE', 'ACTIVE', 'HALTED', 'PAUSED'] },
        },
        orderBy: { createdAt: 'desc' },
      })
    : null;
  const ledgerPeriod = currentPeriod || latestPeriod;
  const planTier = ledgerPeriod
    ? legacyPlanToTier(ledgerPeriod.planTier)
    : legacyPlanToTier(org.plan);
  const tierDef = PLAN_TIERS[planTier] || PLAN_TIERS.launch;
  const isLedgerBacked = Boolean(latestPeriod);
  const now = new Date();
  const softLocked =
    org.subscriptionStatus === 'grace' || currentSubscription?.status === 'GRACE';
  const statusLocked =
    ['trial_expired', 'locked', 'expired', 'cancelled'].includes(org.subscriptionStatus) ||
    (org.subscriptionStatus === 'past_due' &&
      (!currentSubscription?.graceEndsAt || currentSubscription.graceEndsAt <= now));
  const computedLocked = isLedgerBacked
    ? !currentPeriod || statusLocked
    : statusLocked || Boolean(org.planExpiresAt && org.planExpiresAt <= now);
  const testing = unlockLocalTesting();
  const isLocked = testing ? false : computedLocked;
  const planExpiresAt = ledgerPeriod?.endsAt ?? org.planExpiresAt;

  return {
    orgId: organizationId,
    planTier,
    planName: tierDef.name,
    subscriptionStatus: org.subscriptionStatus,
    isLocked,
    softLocked,
    planExpiresAt,
    planPeriodId: currentPeriod?.id ?? latestPeriod?.id ?? null,
    periodStartsAt: ledgerPeriod?.startsAt ?? null,
    periodEndsAt: ledgerPeriod?.endsAt ?? planExpiresAt,
    quotas: {
      waNumbers: {
        used: waCount,
        limit: tierDef.waNumbers,
      },
      seats: {
        used: seatCount + inviteCount,
        limit: tierDef.seats,
      },
      contacts: {
        used: contactCount,
        limit: tierDef.contacts,
      },
      publishedWorkflows: {
        used: automationCount + flowCount,
        limit: tierDef.publishedWorkflows,
      },
      // Local testing already unlocks mutations via checkFeature. Mirror that in
      // the snapshot so the UI does not grey-out Send while the API would allow it.
      aiIncluded: testing && tierDef.aiIncluded === 'off' ? 'included' : tierDef.aiIncluded,
      callingIncluded: testing ? true : tierDef.callingIncluded,
      analyticsAdvanced: testing ? true : tierDef.analyticsAdvanced,
      campaigns: testing ? true : tierDef.campaigns,
      integrations: testing ? true : tierDef.integrations,
      publicApi: testing ? true : tierDef.publicApi,
      templates: testing ? true : tierDef.templates,
      forms: testing ? true : tierDef.forms,
      advancedInbox: testing ? true : tierDef.advancedInbox,
      supportLevel: tierDef.supportLevel,
    },
  };
}

export async function checkFeature(
  organizationId: string,
  feature: FeatureType
): Promise<{ allowed: boolean; requiredPlan: PlanTier; reason?: string; code?: string }> {
  if (unlockLocalTesting()) {
    return { allowed: true, requiredPlan: 'growth' };
  }
  const entitlements = await getOrgEntitlements(organizationId);
  const requiredPlan: PlanTier =
    feature === 'calling'
      ? 'pro'
      : feature === 'ai'
        ? 'growth'
        : feature === 'analyticsAdvanced' || feature === 'integrations' || feature === 'publicApi'
      ? 'growth'
      : feature === 'advancedInbox'
        ? 'pro'
        : feature === 'support'
          ? 'starter'
        : feature === 'campaigns'
          ? 'launch'
          : 'starter';

  if (entitlements.isLocked) {
    return {
      allowed: false,
      requiredPlan,
      code: 'SUBSCRIPTION_LOCKED',
      reason: 'Your paid period has expired. Purchase a plan to continue.',
    };
  }
  if (entitlements.softLocked && ['campaigns', 'ai', 'calling'].includes(feature)) {
    return {
      allowed: false,
      requiredPlan,
      code: 'SUBSCRIPTION_GRACE',
      reason: 'This feature is paused during the payment grace period. Inbox sending remains available.',
    };
  }

  const allowed =
    feature === 'ai'
      ? entitlements.quotas.aiIncluded !== 'off'
      : feature === 'calling'
        ? entitlements.quotas.callingIncluded
        : feature === 'support'
          ? entitlements.quotas.supportLevel !== 'community'
        : entitlements.quotas[feature];
  return {
    allowed,
    requiredPlan,
    code: allowed ? undefined : 'PLAN_FEATURE',
    reason: allowed
      ? undefined
      : `This feature requires the ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher.`,
  };
}

/**
 * Check whether an organization can perform an action within its current quota.
 */
export async function checkQuota(
  organizationId: string,
  quotaType: QuotaType,
  requestedCount = 1
): Promise<QuotaCheckResult> {
  const entitlements = await getOrgEntitlements(organizationId);

  if (unlockLocalTesting()) {
    return {
      allowed: true,
      used: 0,
      limit: 'unlimited',
      upgradeCta: 'growth',
    };
  }

  // Check commercial lock
  if (entitlements.isLocked) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      upgradeCta: 'growth',
      code: 'SUBSCRIPTION_LOCKED',
      reason: 'Your subscription or trial has expired. Upgrade to continue using this feature.',
    };
  }
  if (entitlements.softLocked && ['waNumbers', 'ai', 'calling'].includes(quotaType)) {
    return {
      allowed: false,
      used: entitlements.quotas.waNumbers.used,
      limit: entitlements.quotas.waNumbers.limit,
      upgradeCta: 'growth',
      code: 'SUBSCRIPTION_GRACE',
      reason: 'Connecting additional WhatsApp numbers is paused until billing is recovered.',
    };
  }

  const { planTier } = entitlements;

  switch (quotaType) {
    case 'waNumbers': {
      const { used, limit } = entitlements.quotas.waNumbers;
      if (limit === 'unlimited') return { allowed: true, used, limit, upgradeCta: 'growth' };
      const nextCount = used + requestedCount;
      const allowed = nextCount <= limit;
      const upgradeCta: PlanTier = planTier === 'launch' || planTier === 'starter' ? 'growth' : 'pro';
      return {
        allowed,
        used,
        limit,
        upgradeCta,
        code: 'PLAN_LIMIT_WA_NUMBERS',
        reason: allowed
          ? undefined
          : `WhatsApp number slot limit reached (${used}/${limit}). Upgrade to connect additional numbers.`,
      };
    }

    case 'seats': {
      const { used, limit } = entitlements.quotas.seats;
      if (limit === 'custom') return { allowed: true, used, limit, upgradeCta: 'enterprise' };
      const nextCount = used + requestedCount;
      const allowed = nextCount <= limit;
      const upgradeCta: PlanTier = planTier === 'launch' || planTier === 'starter' ? 'growth' : 'pro';
      return {
        allowed,
        used,
        limit,
        upgradeCta,
        code: 'PLAN_LIMIT_SEATS',
        reason: allowed
          ? undefined
          : `Team seat limit reached (${used}/${limit}). Upgrade to add more team members.`,
      };
    }

    case 'contacts': {
      const { used, limit } = entitlements.quotas.contacts;
      if (limit === 'unlimited') return { allowed: true, used, limit, upgradeCta: 'growth' };
      const nextCount = used + requestedCount;
      const allowed = nextCount <= limit;
      const upgradeCta: PlanTier = planTier === 'launch' ? 'starter' : planTier === 'starter' ? 'growth' : 'pro';
      return {
        allowed,
        used,
        limit,
        upgradeCta,
        code: 'PLAN_LIMIT_CONTACTS',
        reason: allowed
          ? undefined
          : `Contact limit reached (${used.toLocaleString()}/${typeof limit === 'number' ? limit.toLocaleString() : limit}). Upgrade to add more contacts.`,
      };
    }

    case 'publishedWorkflows': {
      const { used, limit } = entitlements.quotas.publishedWorkflows;
      if (limit === 'unlimited') return { allowed: true, used, limit, upgradeCta: 'growth' };
      const nextCount = used + requestedCount;
      const allowed = nextCount <= limit;
      const upgradeCta: PlanTier = 'growth';
      return {
        allowed,
        used,
        limit,
        upgradeCta,
        code: 'PLAN_LIMIT_WORKFLOWS',
        reason: allowed
          ? undefined
          : `Active workflow limit reached (${used}/${limit}). Upgrade to Growth for unlimited workflows.`,
      };
    }

    case 'ai': {
      const ai = entitlements.quotas.aiIncluded;
      const allowed = ai !== 'off';
      return {
        allowed,
        used: allowed ? 1 : 0,
        limit: allowed ? 1 : 0,
        upgradeCta: 'growth',
        code: 'PLAN_FEATURE_AI',
        reason: allowed
          ? undefined
          : 'AI Assistant is available on Growth and Pro plans. Upgrade to unlock AI features.',
      };
    }

    case 'calling': {
      const calling = entitlements.quotas.callingIncluded;
      return {
        allowed: calling,
        used: calling ? 1 : 0,
        limit: calling ? 1 : 0,
        upgradeCta: 'pro',
        code: 'PLAN_FEATURE_CALLING',
        reason: calling
          ? undefined
          : 'Calling module is available on Pro and Enterprise plans. Upgrade to unlock voice calling.',
      };
    }
  }
}

/**
 * Helper to get strictly bounded seat limit for an organization.
 */
export function getBoundedSeatLimit(planTier: PlanTier, customLimit?: number): number {
  const tierDef = PLAN_TIERS[planTier] || PLAN_TIERS.launch;
  if (tierDef.seats === 'custom') {
    return customLimit && customLimit > 0 ? customLimit : 999;
  }
  return typeof tierDef.seats === 'number' ? tierDef.seats : 10;
}
