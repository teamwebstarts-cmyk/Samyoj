import type { PlatformActivationStage } from '@prisma/client';
import prisma from '../../config/database';
import {
  getOrgAiSettings,
  getOrgUsageSummary,
  saveOrgAiSettings,
} from '../ai/org-ai.service';
import { getAiCreditBalances, grantAdminAddonBalance } from '../billing/ai-credits/service';
import { getOrgFeatureFlags, KNOWN_FEATURE_FLAGS, setFeatureFlag } from '../settings/feature-flags';
import { AppError } from '../../utils/response';
import { maskBusinessPhone, utcDay } from './privacy';
import { ACTIVATION_STAGES } from './stage';
import {
  backfillOrgHealthSnapshots,
  collectOrgHealthMetrics,
  upsertOrgHealthSnapshot,
  type OrgHealthMetrics,
} from './snapshots';
import { writePlatformAudit } from './audit';

const PAGE_SIZE = 25;

export const PLATFORM_AI_COVERAGE_NOTE =
  'AI usage is the current ledger. STT/TTS coverage is still incomplete (SAMYOJ-56). Figures are usage units, not rupees, and do not include Meta message fees.';

export function monthlyTokenLimitFromSettings(settings: unknown): number | null {
  if (!settings || typeof settings !== 'object') return null;
  const ai = (settings as { ai?: { monthlyTokenLimit?: unknown } }).ai;
  const limit = ai?.monthlyTokenLimit;
  return typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : null;
}

export function summarizePlatformAiUsage(
  rows: Array<{
    organizationId: string;
    companyName: string;
    aiTokensMonth: number;
    monthlyTokenLimit: number | null;
  }>
) {
  const tokensMonth = rows.reduce((sum, row) => sum + (row.aiTokensMonth || 0), 0);
  const capped = rows.filter((row) => row.monthlyTokenLimit != null);
  const tokenLimitSum = capped.reduce((sum, row) => sum + (row.monthlyTokenLimit || 0), 0);
  const topOrgs = [...rows]
    .filter((row) => (row.aiTokensMonth || 0) > 0)
    .sort((a, b) => b.aiTokensMonth - a.aiTokensMonth)
    .slice(0, 8)
    .map((row) => ({
      organizationId: row.organizationId,
      companyName: row.companyName,
      aiTokensMonth: row.aiTokensMonth,
      monthlyTokenLimit: row.monthlyTokenLimit,
    }));
  return {
    tokensMonth,
    tokenLimitSum: capped.length ? tokenLimitSum : null,
    cappedOrgCount: capped.length,
    uncappedOrgCount: rows.length - capped.length,
    topOrgs,
  };
}

function publicAiControls(settings: Awaited<ReturnType<typeof getOrgAiSettings>>) {
  return {
    chatEnabled: settings.chatEnabled !== false,
    callingEnabled: settings.callingEnabled !== false,
    monthlyTokenLimit: settings.monthlyTokenLimit ?? null,
  };
}

function accountRow(
  org: { id: string; companyName: string; plan: string; createdAt: Date },
  ownerEmail: string | null,
  metrics: OrgHealthMetrics,
  activeNumbers: Array<{ phoneNumber: string; qualityRating: string | null; isActive: boolean }>
) {
  return {
    id: org.id,
    companyName: org.companyName,
    ownerEmail,
    stage: metrics.stage,
    lastLoginAt: metrics.lastLoginAt,
    plan: org.plan,
    qualityRating: metrics.qualityRating,
    aiTokensMonth: metrics.aiTokensMonth,
    monthlyTokenLimit: null as number | null,
    flags: {
      aiInactive: metrics.aiInactive,
      billingRisk: metrics.billingRisk,
      qualityRisk: metrics.qualityRisk,
      webhookStale: metrics.webhookStale,
    },
    numbersConnected: activeNumbers.length,
    numbers: activeNumbers.map((number) => ({
      maskedPhone: maskBusinessPhone(number.phoneNumber),
      isActive: number.isActive,
      qualityRating: number.qualityRating,
    })),
    createdAt: org.createdAt,
  };
}

export async function getPlatformOverview(now = new Date()) {
  const today = utcDay(now);
  const existing = await prisma.orgHealthSnapshot.count({ where: { capturedAt: today } });
  if (existing === 0) {
    await backfillOrgHealthSnapshots(now);
  }

  const [funnelRows, attention, errorGroups, snapshotAi, orgCount] = await Promise.all([
    prisma.orgHealthSnapshot.groupBy({
      by: ['stage'],
      where: { capturedAt: today },
      _count: { _all: true },
    }),
    prisma.orgHealthSnapshot.findMany({
      where: {
        capturedAt: today,
        OR: [
          { stage: { in: ['REGISTERED', 'NOT_CONNECTED'] } },
          { billingRisk: true },
          { qualityRisk: true },
          { webhookStale: true },
          { aiInactive: true, stage: 'LIVE' },
        ],
      },
      include: { organization: { select: { companyName: true } } },
      orderBy: { lastLoginAt: 'asc' },
      take: 40,
    }),
    prisma.metaErrorStat.groupBy({
      by: ['code'],
      where: { lastAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      _sum: { count: true },
      orderBy: { _sum: { count: 'desc' } },
      take: 12,
    }),
    prisma.orgHealthSnapshot.findMany({
      where: { capturedAt: today },
      select: {
        organizationId: true,
        aiTokensMonth: true,
        organization: { select: { companyName: true, settings: true } },
      },
    }),
    prisma.organization.count(),
  ]);

  const ai = summarizePlatformAiUsage(
    snapshotAi.map((row) => ({
      organizationId: row.organizationId,
      companyName: row.organization.companyName,
      aiTokensMonth: row.aiTokensMonth,
      monthlyTokenLimit: monthlyTokenLimitFromSettings(row.organization.settings),
    }))
  );

  const funnel = ACTIVATION_STAGES.map((stage) => ({
    stage,
    count: funnelRows.find((row) => row.stage === stage)?._count._all ?? 0,
  }));

  return {
    orgCount,
    funnel,
    needsAttention: attention.map((row) => ({
      organizationId: row.organizationId,
      companyName: row.organization.companyName,
      stage: row.stage,
      lastLoginAt: row.lastLoginAt,
      flags: {
        aiInactive: row.aiInactive,
        billingRisk: row.billingRisk,
        qualityRisk: row.qualityRisk,
        webhookStale: row.webhookStale,
      },
    })),
    metaErrors: errorGroups.map((row) => ({
      code: row.code,
      count: row._sum.count || 0,
    })),
    aiTokensMonth: ai.tokensMonth,
    aiCap: {
      tokenLimitSum: ai.tokenLimitSum,
      cappedOrgCount: ai.cappedOrgCount,
      uncappedOrgCount: ai.uncappedOrgCount,
    },
    topAiOrgs: ai.topOrgs,
    coverageNote: PLATFORM_AI_COVERAGE_NOTE,
  };
}

export async function listPlatformOrgs(input: {
  q?: string;
  stage?: PlatformActivationStage;
  page?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const page = Math.max(1, input.page ?? 1);
  if (input.stage) {
    const today = utcDay(now);
    const snapshotCount = await prisma.orgHealthSnapshot.count({ where: { capturedAt: today } });
    if (snapshotCount === 0) await backfillOrgHealthSnapshots(now);
  }
  const stageOrgIds = input.stage
    ? (
        await prisma.orgHealthSnapshot.findMany({
          where: { capturedAt: utcDay(now), stage: input.stage },
          select: { organizationId: true },
        })
      ).map((row) => row.organizationId)
    : null;
  const where = {
    ...(stageOrgIds ? { id: { in: stageOrgIds } } : {}),
    ...(input.q
      ? {
          OR: [
            { companyName: { contains: input.q, mode: 'insensitive' as const } },
            {
              users: {
                some: {
                  role: 'OWNER' as const,
                  user: { email: { contains: input.q, mode: 'insensitive' as const } },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [total, orgs] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        companyName: true,
        plan: true,
        createdAt: true,
        users: {
          where: { role: 'OWNER' },
          take: 1,
          select: { user: { select: { email: true } } },
        },
        whatsappNumbers: {
          where: { isActive: true },
          select: { phoneNumber: true, qualityRating: true, isActive: true },
        },
      },
    }),
  ]);

  const rows = [];
  for (const org of orgs) {
    const metrics = await collectOrgHealthMetrics(org.id, now);
    if (!metrics) continue;
    if (input.stage && metrics.stage !== input.stage) continue;
    const row = accountRow(org, org.users[0]?.user.email ?? null, metrics, org.whatsappNumbers);
    row.monthlyTokenLimit = (await getOrgAiSettings(org.id)).monthlyTokenLimit ?? null;
    rows.push(row);
  }

  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    rows,
  };
}

export async function getPlatformOrg(organizationId: string, now = new Date()) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      companyName: true,
      plan: true,
      planExpiresAt: true,
      subscriptionStatus: true,
      createdAt: true,
      users: {
        select: {
          role: true,
          lastActiveAt: true,
          user: { select: { email: true, name: true } },
        },
      },
      whatsappNumbers: {
        select: {
          id: true,
          phoneNumber: true,
          isActive: true,
          qualityRating: true,
          createdAt: true,
        },
      },
    },
  });
  if (!org) throw new AppError(404, 'Organization not found');

  const metrics = await collectOrgHealthMetrics(organizationId, now);
  if (!metrics) throw new AppError(404, 'Organization not found');

  const owner = org.users.find((row) => row.role === 'OWNER');
  const [ai, flags, payments, events, snapshots, messageCounts, creditBalances] = await Promise.all([
    getOrgUsageSummary(organizationId, 30),
    getOrgFeatureFlags(organizationId),
    prisma.paymentOrder.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        planId: true,
        amountPaise: true,
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
      },
    }),
    prisma.productEvent.groupBy({
      by: ['area', 'name'],
      where: { organizationId },
      _sum: { count: true },
    }),
    prisma.orgHealthSnapshot.findMany({
      where: { organizationId },
      orderBy: { capturedAt: 'asc' },
      take: 30,
      select: { capturedAt: true, stage: true },
    }),
    Promise.all(
      org.whatsappNumbers.map(async (number) => {
        const [inboundCount, outboundCount] = await Promise.all([
          prisma.message.count({
            where: {
              direction: 'INBOUND',
              conversation: { organizationId, whatsappNumberId: number.id },
            },
          }),
          prisma.message.count({
            where: {
              direction: 'OUTBOUND',
              conversation: { organizationId, whatsappNumberId: number.id },
            },
          }),
        ]);
        return { id: number.id, inboundCount, outboundCount };
      })
    ),
    getAiCreditBalances(organizationId),
  ]);
  const countsByNumber = new Map(messageCounts.map((row) => [row.id, row]));

  return {
    id: org.id,
    companyName: org.companyName,
    ownerEmail: owner?.user.email ?? null,
    ownerName: owner?.user.name ?? null,
    seatCount: org.users.length,
    createdAt: org.createdAt,
    stage: metrics.stage,
    lastLoginAt: metrics.lastLoginAt,
    flags: {
      aiInactive: metrics.aiInactive,
      billingRisk: metrics.billingRisk,
      qualityRisk: metrics.qualityRisk,
      webhookStale: metrics.webhookStale,
    },
    counts: {
      activeNumberCount: metrics.activeNumberCount,
      contactCount: metrics.contactCount,
      conversationCount: metrics.conversationCount,
      outboundMessageCount: metrics.outboundMessageCount,
      inboundMessageCount: metrics.inboundMessageCount,
      campaignCount: metrics.campaignCount,
      callCount: metrics.callCount,
    },
    timeline: snapshots,
    product: events.map((row) => ({
      area: row.area,
      name: row.name,
      count: row._sum.count || 0,
    })),
    whatsapp: org.whatsappNumbers.map((number) => {
      const counts = countsByNumber.get(number.id);
      return {
        id: number.id,
        maskedPhone: maskBusinessPhone(number.phoneNumber),
        isActive: number.isActive,
        qualityRating: number.qualityRating,
        inboundCount: counts?.inboundCount ?? 0,
        outboundCount: counts?.outboundCount ?? 0,
        createdAt: number.createdAt,
      };
    }),
    billing: {
      plan: org.plan,
      planExpiresAt: org.planExpiresAt,
      subscriptionStatus: org.subscriptionStatus,
      payments,
      ledgerNote:
        'This is the current Razorpay Orders checkout, not TARGET Subscriptions/GST/dunning (SAMYOJ-35). Meta Cloud API fees are a separate WABA ledger.',
    },
    ai: {
      ...publicAiControls(await getOrgAiSettings(organizationId)),
      usage: ai,
      credits: creditBalances,
      coverageNote: PLATFORM_AI_COVERAGE_NOTE,
    },
    flagsCatalog: flags,
  };
}

export async function patchPlatformOrgAi(input: {
  organizationId: string;
  operatorId: string;
  reason: string;
  monthlyTokenLimit?: number | null;
  chatEnabled?: boolean;
  callingEnabled?: boolean;
  grantChatAddon?: number;
  grantCallingAddon?: number;
}) {
  const before = {
    ...publicAiControls(await getOrgAiSettings(input.organizationId)),
    credits: await getAiCreditBalances(input.organizationId),
  };
  const saved = await saveOrgAiSettings(input.organizationId, {
    ...(input.monthlyTokenLimit !== undefined
      ? { monthlyTokenLimit: input.monthlyTokenLimit ?? undefined }
      : {}),
    ...(input.chatEnabled !== undefined ? { chatEnabled: input.chatEnabled } : {}),
    ...(input.callingEnabled !== undefined ? { callingEnabled: input.callingEnabled } : {}),
  });
  if (input.grantChatAddon && input.grantChatAddon > 0) {
    await grantAdminAddonBalance({
      organizationId: input.organizationId,
      pool: 'chat',
      amount: input.grantChatAddon,
    });
  }
  if (input.grantCallingAddon && input.grantCallingAddon > 0) {
    await grantAdminAddonBalance({
      organizationId: input.organizationId,
      pool: 'calling',
      amount: input.grantCallingAddon,
    });
  }
  const after = {
    ...publicAiControls(saved),
    credits: await getAiCreditBalances(input.organizationId),
  };
  await writePlatformAudit({
    operatorId: input.operatorId,
    action: 'PLATFORM_ORG_AI_UPDATED',
    organizationId: input.organizationId,
    targetType: 'Organization',
    targetId: input.organizationId,
    reason: input.reason,
    beforeState: before,
    afterState: after,
  });
  await upsertOrgHealthSnapshot(input.organizationId);
  return after;
}

export async function patchPlatformOrgFlags(input: {
  organizationId: string;
  operatorId: string;
  reason: string;
  flag: string;
  enabled: boolean;
}) {
  if (!(KNOWN_FEATURE_FLAGS as readonly string[]).includes(input.flag)) {
    throw new AppError(400, 'Unknown feature flag');
  }
  const current = await getOrgFeatureFlags(input.organizationId);
  const before = current.find((row) => row.flag === input.flag);
  await setFeatureFlag(input.organizationId, input.flag, input.enabled);
  await writePlatformAudit({
    operatorId: input.operatorId,
    action: 'PLATFORM_ORG_FLAG_UPDATED',
    organizationId: input.organizationId,
    targetType: 'OrgFeatureFlag',
    targetId: input.flag,
    reason: input.reason,
    beforeState: { flag: input.flag, enabled: before?.enabled ?? false },
    afterState: { flag: input.flag, enabled: input.enabled },
  });
  return getOrgFeatureFlags(input.organizationId);
}

export async function patchPlatformOrgBilling(input: {
  organizationId: string;
  operatorId: string;
  reason: string;
  planExpiresAt?: Date | null;
  subscriptionStatus?: string;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { planExpiresAt: true, subscriptionStatus: true },
  });
  if (!org) throw new AppError(404, 'Organization not found');

  const nextStatus = input.subscriptionStatus;
  if (
    nextStatus &&
    !['active', 'complimentary', 'expired', 'past_due', 'cancelled'].includes(nextStatus)
  ) {
    throw new AppError(400, 'Unsupported subscription status');
  }

  const updated = await prisma.organization.update({
    where: { id: input.organizationId },
    data: {
      ...(input.planExpiresAt !== undefined ? { planExpiresAt: input.planExpiresAt } : {}),
      ...(nextStatus ? { subscriptionStatus: nextStatus } : {}),
    },
    select: { plan: true, planExpiresAt: true, subscriptionStatus: true },
  });

  await writePlatformAudit({
    operatorId: input.operatorId,
    action: 'PLATFORM_ORG_BILLING_UPDATED',
    organizationId: input.organizationId,
    targetType: 'Organization',
    targetId: input.organizationId,
    reason: input.reason,
    beforeState: {
      planExpiresAt: org.planExpiresAt?.toISOString() ?? null,
      subscriptionStatus: org.subscriptionStatus,
    },
    afterState: {
      planExpiresAt: updated.planExpiresAt?.toISOString() ?? null,
      subscriptionStatus: updated.subscriptionStatus,
    },
  });
  await upsertOrgHealthSnapshot(input.organizationId);
  return {
    ...updated,
    ledgerNote:
      'Complimentary/extend writes change expiry and status only. They do not create Razorpay payments (SAMYOJ-35).',
  };
}
