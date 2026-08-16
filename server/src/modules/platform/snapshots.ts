import type { PlatformActivationStage, PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { utcDay } from './privacy';
import {
  computeActivationStage,
  computeIndependentFlags,
  worstQualityRating,
} from './stage';

const DAY_MS = 24 * 60 * 60 * 1000;

// The product spec requires retention but does not prescribe durations. Keep the
// policy explicit and centralized until legal/product replaces these defaults.
export const SNAPSHOT_RETENTION_DAYS = 400;
export const PRODUCT_EVENT_RETENTION_DAYS = 180;
export const META_ERROR_RETENTION_DAYS = 180;
export const AUDIT_RETENTION_DAYS = 365;
export const OUTREACH_RETENTION_DAYS = 365;
export const SESSION_RETENTION_DAYS = 7;

type SnapshotDatabase = Pick<
  PrismaClient,
  | 'organization'
  | 'organizationUser'
  | 'whatsappNumber'
  | 'contact'
  | 'conversation'
  | 'message'
  | 'campaign'
  | 'call'
  | 'aiUsageLog'
  | 'paymentOrder'
  | 'orgHealthSnapshot'
  | 'productEvent'
  | 'metaErrorStat'
  | 'platformAuditLog'
  | 'outreachLog'
  | 'platformSession'
>;

export interface OrgHealthMetrics {
  organizationId: string;
  stage: PlatformActivationStage;
  activeNumberCount: number;
  contactCount: number;
  conversationCount: number;
  outboundMessageCount: number;
  inboundMessageCount: number;
  campaignCount: number;
  callCount: number;
  aiTokensMonth: number;
  lastLoginAt: Date | null;
  plan: string;
  qualityRating: string | null;
  aiInactive: boolean;
  billingRisk: boolean;
  qualityRisk: boolean;
  webhookStale: boolean;
}

interface SnapshotData extends OrgHealthMetrics {
  capturedAt: Date;
}

export interface HealthFlagInput {
  stage: PlatformActivationStage;
  lastAiUsageAt: Date | null;
  subscriptionStatus: string;
  planExpiresAt: Date | null;
  failedPaymentCount: number;
  qualityRatings: Array<string | null>;
  lastInboundAt: Date | null;
  outboundMessageCount: number;
  now?: Date;
}

export function activationStage(input: {
  lastLoginAt: Date | null;
  activeNumberCount: number;
  contactCount: number;
  outboundMessageCount: number;
  inboundMessageCount: number;
}): PlatformActivationStage {
  return computeActivationStage(input);
}

export function healthFlags(input: HealthFlagInput): {
  aiInactive: boolean;
  billingRisk: boolean;
  qualityRisk: boolean;
  webhookStale: boolean;
} {
  return computeIndependentFlags({
    stage: input.stage,
    lastAiUsageAt: input.lastAiUsageAt,
    subscriptionStatus: input.subscriptionStatus,
    planExpiresAt: input.planExpiresAt,
    lastPaymentStatus: input.failedPaymentCount > 0 ? 'FAILED' : null,
    qualityRating: worstQualityRating(input.qualityRatings),
    lastInboundAt: input.lastInboundAt,
    outboundMessageCount: input.outboundMessageCount,
    now: input.now,
  });
}

function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function daysAgo(days: number, now: Date): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export async function computeOrgHealthSnapshot(
  organizationId: string,
  now = new Date(),
  database: SnapshotDatabase = prisma
): Promise<SnapshotData> {
  const capturedAt = utcDay(now);
  const monthStart = monthStartUtc(now);

  const [organization, activeNumbers, login] = await Promise.all([
    database.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        plan: true,
        planExpiresAt: true,
        subscriptionStatus: true,
      },
    }),
    database.whatsappNumber.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, qualityRating: true },
    }),
    database.organizationUser.aggregate({
      where: { organizationId },
      _max: { lastActiveAt: true },
    }),
  ]);

  if (!organization) throw new Error('Organization not found');

  const activeNumberIds = activeNumbers.map((number) => number.id);
  const activeNumberFilter = { in: activeNumberIds };
  const conversationWhere = {
    organizationId,
    whatsappNumberId: activeNumberFilter,
  };
  const messageWhere = {
    conversation: conversationWhere,
  };

  const [
    contactCount,
    conversationCount,
    outboundMessageCount,
    inboundMessageCount,
    campaignCount,
    callCount,
    aiUsageMonth,
    lastAiUsage,
    lastInbound,
    failedPaymentCount,
  ] = await Promise.all([
    database.contact.count({
      where: { organizationId, whatsappNumberId: activeNumberFilter },
    }),
    database.conversation.count({ where: conversationWhere }),
    database.message.count({
      where: { ...messageWhere, direction: 'OUTBOUND' },
    }),
    database.message.count({
      where: { ...messageWhere, direction: 'INBOUND' },
    }),
    database.campaign.count({
      where: { organizationId, whatsappNumberId: activeNumberFilter },
    }),
    database.call.count({
      where: { organizationId, whatsappNumberId: activeNumberFilter },
    }),
    database.aiUsageLog.aggregate({
      where: {
        organizationId,
        whatsappNumberId: activeNumberFilter,
        createdAt: { gte: monthStart, lt: now },
      },
      _sum: { totalTokens: true },
    }),
    database.aiUsageLog.findFirst({
      where: { organizationId, whatsappNumberId: activeNumberFilter },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    database.message.aggregate({
      where: { ...messageWhere, direction: 'INBOUND' },
      _max: { createdAt: true },
    }),
    database.paymentOrder.count({
      where: {
        organizationId,
        status: 'FAILED',
        createdAt: { gte: daysAgo(7, now), lt: now },
      },
    }),
  ]);

  const stage = activationStage({
    lastLoginAt: login._max.lastActiveAt,
    activeNumberCount: activeNumberIds.length,
    contactCount,
    outboundMessageCount,
    inboundMessageCount,
  });
  const flags = healthFlags({
    stage,
    lastAiUsageAt: lastAiUsage?.createdAt ?? null,
    subscriptionStatus: organization.subscriptionStatus,
    planExpiresAt: organization.planExpiresAt,
    failedPaymentCount,
    qualityRatings: activeNumbers.map((number) => number.qualityRating),
    lastInboundAt: lastInbound._max.createdAt,
    outboundMessageCount,
    now,
  });

  return {
    organizationId,
    stage,
    activeNumberCount: activeNumberIds.length,
    contactCount,
    conversationCount,
    outboundMessageCount,
    inboundMessageCount,
    campaignCount,
    callCount,
    aiTokensMonth: aiUsageMonth._sum.totalTokens ?? 0,
    lastLoginAt: login._max.lastActiveAt,
    plan: organization.plan,
    qualityRating: worstQualityRating(activeNumbers.map((number) => number.qualityRating)),
    ...flags,
    capturedAt,
  };
}

function toMetrics(row: SnapshotData): OrgHealthMetrics {
  const { capturedAt: _capturedAt, ...metrics } = row;
  return metrics;
}

export async function snapshotOrganization(
  organizationId: string,
  now = new Date(),
  database: SnapshotDatabase = prisma
): Promise<SnapshotData> {
  const data = await computeOrgHealthSnapshot(organizationId, now, database);
  await database.orgHealthSnapshot.upsert({
    where: {
      organizationId_capturedAt: {
        organizationId,
        capturedAt: data.capturedAt,
      },
    },
    create: data,
    update: {
      stage: data.stage,
      activeNumberCount: data.activeNumberCount,
      contactCount: data.contactCount,
      conversationCount: data.conversationCount,
      outboundMessageCount: data.outboundMessageCount,
      inboundMessageCount: data.inboundMessageCount,
      campaignCount: data.campaignCount,
      callCount: data.callCount,
      aiTokensMonth: data.aiTokensMonth,
      lastLoginAt: data.lastLoginAt,
      plan: data.plan,
      qualityRating: data.qualityRating,
      aiInactive: data.aiInactive,
      billingRisk: data.billingRisk,
      qualityRisk: data.qualityRisk,
      webhookStale: data.webhookStale,
    },
  });
  return data;
}

export async function snapshotAllOrganizations(
  now = new Date(),
  database: SnapshotDatabase = prisma
): Promise<{ attempted: number; written: number; failed: number }> {
  const organizations = await database.organization.findMany({ select: { id: true } });
  let written = 0;
  let failed = 0;

  for (const organization of organizations) {
    try {
      await snapshotOrganization(organization.id, now, database);
      written += 1;
    } catch {
      failed += 1;
    }
  }

  return { attempted: organizations.length, written, failed };
}

export async function collectOrgHealthMetrics(
  organizationId: string,
  now = new Date(),
  database: SnapshotDatabase = prisma
): Promise<OrgHealthMetrics | null> {
  try {
    return toMetrics(await computeOrgHealthSnapshot(organizationId, now, database));
  } catch {
    return null;
  }
}

export async function upsertOrgHealthSnapshot(
  organizationId: string,
  now = new Date(),
  database: SnapshotDatabase = prisma
): Promise<OrgHealthMetrics | null> {
  try {
    return toMetrics(await snapshotOrganization(organizationId, now, database));
  } catch {
    return null;
  }
}

export async function backfillOrgHealthSnapshots(
  now = new Date(),
  database: SnapshotDatabase = prisma
): Promise<{ orgs: number; attempted: number; written: number; failed: number }> {
  const result = await snapshotAllOrganizations(now, database);
  return { orgs: result.written, ...result };
}

export async function captureDailySnapshots(
  now = new Date(),
  database: SnapshotDatabase = prisma
): Promise<{ orgs: number; attempted: number; written: number; failed: number }> {
  return backfillOrgHealthSnapshots(now, database);
}

export async function cleanupPlatformTelemetry(
  now = new Date(),
  database: SnapshotDatabase = prisma
): Promise<{
  productEventsDeleted: number;
  snapshotsDeleted: number;
  metaErrorsDeleted: number;
}> {
  const [productEvents, snapshots, metaErrors] = await Promise.all([
    database.productEvent.deleteMany({
      where: { occurredAt: { lt: daysAgo(PRODUCT_EVENT_RETENTION_DAYS, now) } },
    }),
    database.orgHealthSnapshot.deleteMany({
      where: { capturedAt: { lt: daysAgo(SNAPSHOT_RETENTION_DAYS, now) } },
    }),
    database.metaErrorStat.deleteMany({
      where: { lastAt: { lt: daysAgo(META_ERROR_RETENTION_DAYS, now) } },
    }),
  ]);
  return {
    productEventsDeleted: productEvents.count,
    snapshotsDeleted: snapshots.count,
    metaErrorsDeleted: metaErrors.count,
  };
}

export async function purgePlatformTelemetry(
  now = new Date(),
  database: SnapshotDatabase = prisma
) {
  const [core, auditLogs, outreachLogs, sessions] = await Promise.all([
    cleanupPlatformTelemetry(now, database),
    database.platformAuditLog.deleteMany({
      where: { createdAt: { lt: daysAgo(AUDIT_RETENTION_DAYS, now) } },
    }),
    database.outreachLog.deleteMany({
      where: { createdAt: { lt: daysAgo(OUTREACH_RETENTION_DAYS, now) } },
    }),
    database.platformSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: daysAgo(SESSION_RETENTION_DAYS, now) } },
          { revokedAt: { lt: daysAgo(SESSION_RETENTION_DAYS, now) } },
        ],
      },
    }),
  ]);

  return {
    snapshots: core.snapshotsDeleted,
    events: core.productEventsDeleted,
    metaErrors: core.metaErrorsDeleted,
    auditLogs: auditLogs.count,
    outreachLogs: outreachLogs.count,
    sessions: sessions.count,
    capturedAt: utcDay(now),
  };
}
