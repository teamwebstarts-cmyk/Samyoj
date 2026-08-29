import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { DEFAULT_CAMPAIGN_SETTINGS, type CampaignSettings } from './types';
import { estimateCampaignCost } from '../billing/usage.service';
import { randomUUID } from 'node:crypto';
import { ownsCampaignQuotaReservation, utcDayStart } from './safety';
import type { Prisma } from '@prisma/client';

export async function getCampaignSettings(organizationId: string): Promise<CampaignSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const campaigns = (settings.campaigns as CampaignSettings) || {};
  return { ...DEFAULT_CAMPAIGN_SETTINGS, ...campaigns };
}

export async function getDailySendUsage(organizationId: string, whatsappNumberId?: string) {
  const settings = await getCampaignSettings(organizationId);

  const startOfDay = utcDayStart();
  const rolling24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const numberFilter = whatsappNumberId ? { whatsappNumberId } : {};

  const [sentToday, uniquePhones, ledger, number] = await Promise.all([
    prisma.campaignRecipient.count({
      where: {
        campaign: { organizationId, ...numberFilter },
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
        sentAt: { gte: startOfDay },
      },
    }),
    prisma.campaignRecipient.findMany({
      where: {
        campaign: { organizationId, ...numberFilter },
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
        sentAt: { gte: rolling24h },
      },
      distinct: ['phone'],
      select: { phone: true },
    }),
    prisma.campaignQuotaLedger.findUnique({
      where: { organizationId_periodStart: { organizationId, periodStart: startOfDay } },
      select: { reservedSendCount: true },
    }),
    whatsappNumberId
      ? prisma.whatsappNumber.findFirst({
          where: { id: whatsappNumberId, organizationId, isActive: true },
          select: { messagingLimitTier: true },
        })
      : Promise.resolve(null),
  ]);

  const dailySendLimit = settings.dailySendLimit ?? DEFAULT_CAMPAIGN_SETTINGS.dailySendLimit!;
  const reservedSendCount = ledger?.reservedSendCount ?? 0;
  const remaining = Math.max(0, dailySendLimit - sentToday - reservedSendCount);

  return {
    sentToday,
    dailySendLimit,
    reservedSendCount,
    remaining,
    uniqueUsed24h: uniquePhones.length,
    messagingLimitTier: number?.messagingLimitTier || null,
    batchSize: settings.batchSize ?? DEFAULT_CAMPAIGN_SETTINGS.batchSize!,
    batchDelayMs: settings.batchDelayMs ?? DEFAULT_CAMPAIGN_SETTINGS.batchDelayMs!,
  };
}

export async function assertDailySendQuota(organizationId: string, recipientCount: number) {
  const settings = await getCampaignSettings(organizationId);
  const limit = settings.dailySendLimit ?? DEFAULT_CAMPAIGN_SETTINGS.dailySendLimit!;
  const day = utcDayStart();
  const [sentToday, reserved] = await Promise.all([
    prisma.campaignRecipient.count({
      where: {
        campaign: { organizationId },
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
        sentAt: { gte: day },
      },
    }),
    prisma.campaignQuotaLedger.findUnique({
      where: { organizationId_periodStart: { organizationId, periodStart: day } },
      select: { reservedSendCount: true },
    }),
  ]);
  if (sentToday + (reserved?.reservedSendCount ?? 0) + recipientCount > limit) {
    throw new AppError(
      429,
      `Daily campaign recipient limit reached (${limit}). Try again tomorrow.`,
      'CAMPAIGN_DAILY_LIMIT'
    );
  }
}

export async function assertDailyBudget(
  organizationId: string,
  recipientCount: number,
  category = 'MARKETING',
) {
  const settings = await getCampaignSettings(organizationId);
  const budget = settings.dailyBudgetInr ?? DEFAULT_CAMPAIGN_SETTINGS.dailyBudgetInr!;

  const startOfDay = utcDayStart();

  const sentToday = await prisma.campaignRecipient.count({
    where: {
      campaign: { organizationId },
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      sentAt: { gte: startOfDay },
    },
  });

  const spentEstimate = estimateCampaignCost(sentToday, category).estimatedCostInr;
  const sendEstimate = estimateCampaignCost(recipientCount, category).estimatedCostInr;

  const ledger = await prisma.campaignQuotaLedger.findUnique({
    where: { organizationId_periodStart: { organizationId, periodStart: startOfDay } },
    select: { reservedBudgetCents: true },
  });
  const reservedEstimateInr = (ledger?.reservedBudgetCents ?? 0) / 100;
  if (spentEstimate + reservedEstimateInr + sendEstimate > budget) {
    throw new AppError(
      429,
      'The daily campaign budget is reserved. Try again tomorrow.',
      'CAMPAIGN_DAILY_BUDGET'
    );
  }

  return {
    budgetInr: budget,
    spentEstimateInr: spentEstimate,
    sendEstimateInr: sendEstimate,
    remainingInr: Math.max(0, budget - spentEstimate),
  };
}

/**
 * Reserves quota under a locked per-org/day ledger. This prevents two API or
 * scheduler processes from both passing a read-only quota check.
 */
export async function reserveCampaignQuota(
  organizationId: string,
  campaignId: string,
  runVersion: number,
  recipientCount: number,
  category = 'MARKETING'
) {
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
    if (existing?.status === 'ACTIVE') {
      if (!ownsCampaignQuotaReservation(existing.runVersion, runVersion)) {
        const current = await tx.campaign.findFirst({
          where: { id: campaignId, runVersion },
          select: { id: true },
        });
        if (!current) throw new AppError(409, 'Campaign already has an active reservation for another run');
        return tx.campaignQuotaReservation.update({
          where: { id: existing.id },
          data: { runVersion },
        });
      }
      return existing;
    }

    const settings = await getCampaignSettings(organizationId);
    const dailySendLimit = settings.dailySendLimit ?? DEFAULT_CAMPAIGN_SETTINGS.dailySendLimit!;
    const dailyBudgetInr = settings.dailyBudgetInr ?? DEFAULT_CAMPAIGN_SETTINGS.dailyBudgetInr!;
    const sentToday = await tx.campaignRecipient.count({
      where: {
        campaign: { organizationId },
        status: { in: ['SENT', 'DELIVERED', 'READ'] },
        sentAt: { gte: day },
      },
    });
    if (sentToday + lockedLedger.reservedSendCount + recipientCount > dailySendLimit) {
      throw new AppError(
        429,
        `Daily campaign recipient limit reached (${dailySendLimit}). Try again tomorrow.`,
        'CAMPAIGN_DAILY_LIMIT'
      );
    }
    const spentEstimateInr = estimateCampaignCost(sentToday, category).estimatedCostInr;
    const reservedBudgetInr = lockedLedger.reservedBudgetCents / 100;
    if (spentEstimateInr + reservedBudgetInr + budgetCents / 100 > dailyBudgetInr) {
      throw new AppError(
        429,
        'The daily campaign budget is reserved. Try again tomorrow.',
        'CAMPAIGN_DAILY_BUDGET'
      );
    }

    const updated = await tx.campaignQuotaLedger.updateMany({
      where: { id: ledger.id },
      data: { reservedSendCount: { increment: recipientCount }, reservedBudgetCents: { increment: budgetCents } },
    });
    if (updated.count !== 1) throw new AppError(409, 'Campaign quota changed; try again');
    if (existing) {
      return tx.campaignQuotaReservation.update({
        where: { id: existing.id },
        data: {
          runVersion,
          ledgerId: ledger.id,
          sendCount: recipientCount,
          budgetCents,
          status: 'ACTIVE',
          releasedAt: null,
        },
      });
    }
    return tx.campaignQuotaReservation.create({
      data: {
        id: randomUUID(),
        campaignId,
        runVersion,
        organizationId,
        ledgerId: ledger.id,
        sendCount: recipientCount,
        budgetCents,
      },
    });
  });
}

export async function releaseCampaignQuota(campaignId: string, runVersion: number) {
  return prisma.$transaction(async (tx) => {
    // The first read only locates the ledger. Ownership is checked again after
    // its lock so an old run cannot release a reservation transferred meanwhile.
    const located = await tx.campaignQuotaReservation.findUnique({ where: { campaignId } });
    if (!located) return false;
    await tx.$queryRaw`SELECT id FROM campaign_quota_ledgers WHERE id = ${located.ledgerId} FOR UPDATE`;
    const reservation = await tx.campaignQuotaReservation.findUnique({ where: { id: located.id } });
    if (
      !reservation ||
      reservation.status !== 'ACTIVE' ||
      !ownsCampaignQuotaReservation(reservation.runVersion, runVersion)
    ) return false;
    const updated = await tx.campaignQuotaReservation.updateMany({
      where: {
        id: reservation.id,
        campaignId,
        organizationId: reservation.organizationId,
        runVersion,
        status: 'ACTIVE',
      },
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

/**
 * Move an active reservation with the campaign's run fence. This must be
 * called inside the same transaction as the status/runVersion transition so
 * a failed pause/resume cannot strand ownership on the wrong run.
 */
export async function transferCampaignQuotaReservation(
  tx: Prisma.TransactionClient,
  campaignId: string,
  fromRunVersion: number,
  toRunVersion: number
) {
  if (fromRunVersion === toRunVersion) return false;
  const reservation = await tx.campaignQuotaReservation.findUnique({ where: { campaignId } });
  if (
    !reservation ||
    reservation.status !== 'ACTIVE' ||
    !ownsCampaignQuotaReservation(reservation.runVersion, fromRunVersion)
  ) {
    return false;
  }
  await tx.$queryRaw`SELECT id FROM campaign_quota_ledgers WHERE id = ${reservation.ledgerId} FOR UPDATE`;
  const updated = await tx.campaignQuotaReservation.updateMany({
    where: { id: reservation.id, status: 'ACTIVE', runVersion: fromRunVersion },
    data: { runVersion: toRunVersion },
  });
  return updated.count === 1;
}
