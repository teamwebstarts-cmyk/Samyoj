import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { DEFAULT_CAMPAIGN_SETTINGS, type CampaignSettings } from './types';
import { estimateCampaignCost } from '../billing/usage.service';
import { randomUUID } from 'node:crypto';
import { fitsReservedQuota } from './safety';

export async function getCampaignSettings(organizationId: string): Promise<CampaignSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const campaigns = (settings.campaigns as CampaignSettings) || {};
  return { ...DEFAULT_CAMPAIGN_SETTINGS, ...campaigns };
}

export async function getDailySendUsage(organizationId: string) {
  const settings = await getCampaignSettings(organizationId);
  const limit = settings.dailySendLimit ?? DEFAULT_CAMPAIGN_SETTINGS.dailySendLimit!;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sentToday = await prisma.campaignRecipient.count({
    where: {
      campaign: { organizationId },
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      sentAt: { gte: startOfDay },
    },
  });

  return {
    sentToday,
    limit,
    remaining: Math.max(0, limit - sentToday),
    batchSize: settings.batchSize ?? DEFAULT_CAMPAIGN_SETTINGS.batchSize!,
    batchDelayMs: settings.batchDelayMs ?? DEFAULT_CAMPAIGN_SETTINGS.batchDelayMs!,
  };
}

export async function assertDailySendQuota(organizationId: string, recipientCount: number) {
  const settings = await getCampaignSettings(organizationId);
  const limit = settings.dailySendLimit ?? DEFAULT_CAMPAIGN_SETTINGS.dailySendLimit!;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sentToday = await prisma.campaignRecipient.count({
    where: {
      campaign: { organizationId },
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      sentAt: { gte: startOfDay },
    },
  });

  if (sentToday + recipientCount > limit) {
    throw new AppError(
      429,
      `Daily campaign send limit exceeded (${sentToday}/${limit} sent today, ${recipientCount} requested).`
    );
  }
}

export async function assertDailyBudget(organizationId: string, recipientCount: number, category = 'MARKETING') {
  const settings = await getCampaignSettings(organizationId);
  const budget = settings.dailyBudgetInr ?? DEFAULT_CAMPAIGN_SETTINGS.dailyBudgetInr!;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sentToday = await prisma.campaignRecipient.count({
    where: {
      campaign: { organizationId },
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      sentAt: { gte: startOfDay },
    },
  });

  const spentEstimate = estimateCampaignCost(sentToday, category).estimatedCostInr;
  const sendEstimate = estimateCampaignCost(recipientCount, category).estimatedCostInr;

  if (spentEstimate + sendEstimate > budget) {
    throw new AppError(
      429,
      `Daily Meta budget exceeded. Estimated spend today: ₹${spentEstimate.toFixed(2)} + ₹${sendEstimate.toFixed(2)} requested exceeds ₹${budget} daily cap.`
    );
  }

  return {
    budgetInr: budget,
    spentEstimateInr: spentEstimate,
    sendEstimateInr: sendEstimate,
    remainingInr: Math.max(0, budget - spentEstimate),
  };
}

function utcDayStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Reserves quota under a locked per-org/day ledger. This prevents two API or
 * scheduler processes from both passing a read-only quota check.
 */
export async function reserveCampaignQuota(
  organizationId: string,
  campaignId: string,
  recipientCount: number,
  category = 'MARKETING'
) {
  const settings = await getCampaignSettings(organizationId);
  const sendLimit = settings.dailySendLimit ?? DEFAULT_CAMPAIGN_SETTINGS.dailySendLimit!;
  const budgetCents = Math.round(estimateCampaignCost(recipientCount, category).estimatedCostInr * 100);
  const day = utcDayStart();
  return prisma.$transaction(async (tx) => {
    const ledger = await tx.campaignQuotaLedger.upsert({
      where: { organizationId_periodStart: { organizationId, periodStart: day } },
      create: { organizationId, periodStart: day },
      update: {},
    });
    await tx.$queryRaw`SELECT id FROM campaign_quota_ledgers WHERE id = ${ledger.id} FOR UPDATE`;
    const lockedLedger = await tx.campaignQuotaLedger.findUniqueOrThrow({ where: { id: ledger.id } });
    const existing = await tx.campaignQuotaReservation.findUnique({ where: { campaignId } });
    if (existing?.status === 'ACTIVE') return existing;

    const sentToday = await tx.campaignRecipient.count({
      where: {
        campaign: { organizationId },
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
        sentAt: { gte: day },
      },
    });
    const spentEstimateCents = Math.round(estimateCampaignCost(sentToday, category).estimatedCostInr * 100);
    const budgetLimitCents = Math.round(
      (settings.dailyBudgetInr ?? DEFAULT_CAMPAIGN_SETTINGS.dailyBudgetInr!) * 100
    );
    const fitsQuota = fitsReservedQuota({
      sentCount: sentToday,
      reservedSendCount: lockedLedger.reservedSendCount,
      requestedSendCount: recipientCount,
      sendLimit,
      spentBudgetCents: spentEstimateCents,
      reservedBudgetCents: lockedLedger.reservedBudgetCents,
      requestedBudgetCents: budgetCents,
      budgetLimitCents,
    });
    if (sentToday + lockedLedger.reservedSendCount + recipientCount > sendLimit) {
      throw new AppError(429, `Daily campaign send limit exceeded (${sendLimit} recipients/day).`);
    }
    if (!fitsQuota) {
      throw new AppError(429, `Daily Meta budget exceeded (₹${(budgetLimitCents / 100).toFixed(2)} daily cap).`);
    }
    const updated = await tx.campaignQuotaLedger.updateMany({
      where: { id: ledger.id },
      data: { reservedSendCount: { increment: recipientCount }, reservedBudgetCents: { increment: budgetCents } },
    });
    if (updated.count !== 1) throw new AppError(409, 'Campaign quota changed; try again');
    return tx.campaignQuotaReservation.create({
      data: { id: randomUUID(), campaignId, organizationId, ledgerId: ledger.id, sendCount: recipientCount, budgetCents },
    });
  });
}

export async function releaseCampaignQuota(campaignId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.campaignQuotaReservation.findUnique({ where: { campaignId } });
    if (!reservation || reservation.status !== 'ACTIVE') return false;
    await tx.$queryRaw`SELECT id FROM campaign_quota_ledgers WHERE id = ${reservation.ledgerId} FOR UPDATE`;
    const updated = await tx.campaignQuotaReservation.updateMany({
      where: { id: reservation.id, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
    if (updated.count !== 1) return false;
    const ledgerUpdated = await tx.campaignQuotaLedger.updateMany({
      where: {
        id: reservation.ledgerId,
        reservedSendCount: { gte: reservation.sendCount },
        reservedBudgetCents: { gte: reservation.budgetCents },
      },
      data: {
        reservedSendCount: { decrement: reservation.sendCount },
        reservedBudgetCents: { decrement: reservation.budgetCents },
      },
    });
    if (ledgerUpdated.count !== 1) throw new AppError(409, 'Campaign quota ledger is inconsistent; reconcile before release');
    return true;
  });
}
