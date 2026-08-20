import prisma from '../../config/database';
import {
  PlanTier,
  PLAN_TIERS,
  legacyPlanToTier,
} from './plans';
import { AppError } from '../../utils/response';

export type QuotaType =
  | 'waNumbers'
  | 'seats'
  | 'contacts'
  | 'publishedWorkflows'
  | 'ai'
  | 'calling';

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
  planExpiresAt: Date | null;
  quotas: {
    waNumbers: { used: number; limit: number | 'unlimited' };
    seats: { used: number; limit: number | 'custom' };
    contacts: { used: number; limit: number | 'unlimited' };
    publishedWorkflows: { used: number; limit: number | 'unlimited' };
    aiIncluded: 'off' | 'included' | 'advanced' | 'dedicated';
    callingIncluded: boolean;
    analyticsAdvanced: boolean;
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

  const planTier = legacyPlanToTier(org.plan);
  const tierDef = PLAN_TIERS[planTier] || PLAN_TIERS.launch;

  const [waCount, seatCount, inviteCount, contactCount, automationCount] =
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
    ]);

  const isLocked = ['trial_expired', 'locked', 'expired', 'cancelled'].includes(
    org.subscriptionStatus
  );

  return {
    orgId: organizationId,
    planTier,
    planName: tierDef.name,
    subscriptionStatus: org.subscriptionStatus,
    isLocked,
    planExpiresAt: org.planExpiresAt,
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
        used: automationCount,
        limit: tierDef.publishedWorkflows,
      },
      aiIncluded: tierDef.aiIncluded,
      callingIncluded: tierDef.callingIncluded,
      analyticsAdvanced: tierDef.analyticsAdvanced,
    },
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
