import type { Prisma } from '@prisma/client';
import prisma from '../../../config/database';
import { AppError } from '../../../utils/response';
import { legacyPlanToTier, type PlanTier } from '../plans';
import { checkQuota } from '../entitlements.service';
import {
  type AiCreditPool,
  INCLUDED_ALLOWANCES,
  tokensToChatCredits,
  callingSecondsToMinutes,
  getAiTopupSku,
  type AiTopupSku,
} from './catalog';

export type AiCreditBalanceView = {
  pool: AiCreditPool;
  includedLimit: number;
  includedUsed: number;
  includedRemaining: number;
  addonBalance: number;
  totalRemaining: number;
  periodStart: string;
  periodEnd: string;
};

type Tx = Prisma.TransactionClient;

function defaultPeriodEnd(planExpiresAt: Date | null): Date {
  if (planExpiresAt && planExpiresAt.getTime() > Date.now()) {
    return planExpiresAt;
  }
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  return end;
}

function defaultPeriodStart(periodEnd: Date): Date {
  const start = new Date(periodEnd);
  start.setMonth(start.getMonth() - 1);
  return start;
}

export function includedLimitForPlan(planTier: PlanTier, pool: AiCreditPool): number {
  const row = INCLUDED_ALLOWANCES[planTier] || INCLUDED_ALLOWANCES.launch;
  return pool === 'chat' ? row.chatCreditsIncluded : row.callingMinutesIncluded;
}

async function loadOrg(orgId: string, tx: Tx = prisma) {
  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: { id: true, plan: true, planExpiresAt: true },
  });
  if (!org) throw new AppError(404, 'Organization not found');
  return org;
}

async function ensureBalanceRow(
  organizationId: string,
  pool: AiCreditPool,
  tx: Tx = prisma
) {
  const org = await loadOrg(organizationId, tx);
  const planTier = legacyPlanToTier(org.plan);
  const periodEnd = defaultPeriodEnd(org.planExpiresAt);
  const periodStart = defaultPeriodStart(periodEnd);

  const existing = await tx.orgAiCreditBalance.findUnique({
    where: { organizationId_pool: { organizationId, pool } },
  });

  if (!existing) {
    return tx.orgAiCreditBalance.create({
      data: {
        organizationId,
        pool,
        includedUsed: 0,
        addonBalance: 0,
        periodStart,
        periodEnd,
      },
    });
  }

  if (existing.periodEnd.getTime() !== periodEnd.getTime()) {
    return tx.orgAiCreditBalance.update({
      where: { id: existing.id },
      data: {
        includedUsed: 0,
        periodStart,
        periodEnd,
      },
    });
  }

  return existing;
}

function toView(
  pool: AiCreditPool,
  row: {
    includedUsed: number;
    addonBalance: number;
    periodStart: Date;
    periodEnd: Date;
  },
  includedLimit: number
): AiCreditBalanceView {
  const includedRemaining = Math.max(0, includedLimit - row.includedUsed);
  const totalRemaining = includedRemaining + Math.max(0, row.addonBalance);
  return {
    pool,
    includedLimit,
    includedUsed: row.includedUsed,
    includedRemaining,
    addonBalance: row.addonBalance,
    totalRemaining,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
  };
}

export async function getAiCreditBalances(organizationId: string): Promise<{
  chat: AiCreditBalanceView;
  calling: AiCreditBalanceView;
  periodEnd: string | null;
}> {
  const org = await loadOrg(organizationId);
  const planTier = legacyPlanToTier(org.plan);

  const [chatRow, callingRow] = await Promise.all([
    ensureBalanceRow(organizationId, 'chat'),
    ensureBalanceRow(organizationId, 'calling'),
  ]);

  return {
    chat: toView('chat', chatRow, includedLimitForPlan(planTier, 'chat')),
    calling: toView('calling', callingRow, includedLimitForPlan(planTier, 'calling')),
    periodEnd: org.planExpiresAt?.toISOString() ?? chatRow.periodEnd.toISOString(),
  };
}

export async function assertAiCreditsAvailable(
  organizationId: string,
  pool: AiCreditPool,
  amount = 1
): Promise<void> {
  const entitlement =
    pool === 'calling'
      ? await checkQuota(organizationId, 'calling')
      : await checkQuota(organizationId, 'ai');
  if (!entitlement.allowed) {
    throw new AppError(
      403,
      entitlement.reason || 'AI is not included on your plan.',
      entitlement.code
    );
  }

  const balances = await getAiCreditBalances(organizationId);
  const view = pool === 'chat' ? balances.chat : balances.calling;
  if (view.totalRemaining < amount) {
    throw new AppError(
      429,
      pool === 'chat'
        ? 'AI chat credits exhausted. Buy a top-up pack in Billing.'
        : 'AI calling minutes exhausted. Buy a top-up pack in Billing.',
      'AI_CREDITS_EXHAUSTED'
    );
  }
}

export function computeDeductionSplit(params: {
  includedLimit: number;
  includedUsed: number;
  addonBalance: number;
  amount: number;
}): { includedUsed: number; addonBalance: number } | null {
  const includedRoom = Math.max(0, params.includedLimit - params.includedUsed);
  const fromIncluded = Math.min(includedRoom, params.amount);
  const includedUsed = params.includedUsed + fromIncluded;
  const remaining = params.amount - fromIncluded;

  if (remaining > 0) {
    if (params.addonBalance < remaining) return null;
    return {
      includedUsed,
      addonBalance: params.addonBalance - remaining,
    };
  }

  return {
    includedUsed,
    addonBalance: params.addonBalance,
  };
}

async function deductAmount(
  organizationId: string,
  pool: AiCreditPool,
  amount: number,
  tx: Tx
): Promise<void> {
  if (amount <= 0) return;

  const org = await loadOrg(organizationId, tx);
  const planTier = legacyPlanToTier(org.plan);
  const includedLimit = includedLimitForPlan(planTier, pool);

  const row = await ensureBalanceRow(organizationId, pool, tx);

  const next = computeDeductionSplit({
    includedLimit,
    includedUsed: row.includedUsed,
    addonBalance: row.addonBalance,
    amount,
  });
  if (!next) {
    throw new AppError(429, 'AI credits exhausted', 'AI_CREDITS_EXHAUSTED');
  }

  await tx.orgAiCreditBalance.update({
    where: { id: row.id },
    data: { includedUsed: next.includedUsed, addonBalance: next.addonBalance },
  });
}

export async function deductChatCreditsFromUsageLog(params: {
  organizationId: string;
  usageLogId: string;
  promptTokens: number;
  completionTokens: number;
}): Promise<void> {
  const amount = tokensToChatCredits(params.promptTokens, params.completionTokens);
  if (amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.aiCreditDeduction.findUnique({
      where: { usageLogId: params.usageLogId },
    });
    if (existing) return;

    await deductAmount(params.organizationId, 'chat', amount, tx);
    await tx.aiCreditDeduction.create({
      data: {
        organizationId: params.organizationId,
        pool: 'chat',
        amount,
        usageLogId: params.usageLogId,
      },
    });
  });
}

export async function deductCallingMinutesForCall(params: {
  organizationId: string;
  callId: string;
  durationSeconds: number;
}): Promise<void> {
  const amount = callingSecondsToMinutes(params.durationSeconds);
  if (amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.aiCreditDeduction.findUnique({
      where: { callId: params.callId },
    });
    if (existing) return;

    await deductAmount(params.organizationId, 'calling', amount, tx);
    await tx.aiCreditDeduction.create({
      data: {
        organizationId: params.organizationId,
        pool: 'calling',
        amount,
        callId: params.callId,
      },
    });
  });
}

export async function grantTopUp(params: {
  organizationId: string;
  sku: AiTopupSku;
  quantity?: number;
  paymentOrderId?: string;
}): Promise<{ creditsGranted: number; addonBalance: number }> {
  const quantity = Math.max(1, params.quantity ?? 1);
  const creditsGranted = params.sku.units * quantity;

  if (params.paymentOrderId) {
    const existing = await prisma.aiCreditPurchase.findFirst({
      where: { paymentOrderId: params.paymentOrderId },
    });
    if (existing) {
      const row = await prisma.orgAiCreditBalance.findUnique({
        where: {
          organizationId_pool: {
            organizationId: params.organizationId,
            pool: params.sku.pool,
          },
        },
      });
      return {
        creditsGranted: existing.creditsGranted,
        addonBalance: row?.addonBalance ?? 0,
      };
    }
  }

  return prisma.$transaction(async (tx) => {
    await ensureBalanceRow(params.organizationId, params.sku.pool, tx);
    const row = await tx.orgAiCreditBalance.update({
      where: {
        organizationId_pool: {
          organizationId: params.organizationId,
          pool: params.sku.pool,
        },
      },
      data: {
        addonBalance: { increment: creditsGranted },
      },
    });

    await tx.aiCreditPurchase.create({
      data: {
        organizationId: params.organizationId,
        pool: params.sku.pool,
        skuId: params.sku.id,
        purchaseType: params.sku.purchaseType,
        quantity,
        creditsGranted,
        amountPaise: params.sku.pricePaise * quantity,
        paymentOrderId: params.paymentOrderId,
      },
    });

    return { creditsGranted, addonBalance: row.addonBalance };
  });
}

export async function grantTopUpBySkuId(params: {
  organizationId: string;
  skuId: string;
  quantity?: number;
  paymentOrderId?: string;
}): Promise<{ creditsGranted: number; addonBalance: number }> {
  const sku = getAiTopupSku(params.skuId);
  if (!sku) throw new AppError(400, 'Unknown AI add-on SKU');
  return grantTopUp({
    organizationId: params.organizationId,
    sku,
    quantity: params.quantity,
    paymentOrderId: params.paymentOrderId,
  });
}

export async function resetIncludedOnRenewal(organizationId: string): Promise<void> {
  const org = await loadOrg(organizationId);
  const periodEnd = defaultPeriodEnd(org.planExpiresAt);
  const periodStart = defaultPeriodStart(periodEnd);

  await prisma.orgAiCreditBalance.updateMany({
    where: { organizationId },
    data: {
      includedUsed: 0,
      periodStart,
      periodEnd,
    },
  });
}

export async function grantRecurringAddon(organizationId: string, skuId: string): Promise<void> {
  const sku = getAiTopupSku(skuId);
  if (!sku || sku.purchaseType !== 'recurring_addon') return;
  await grantTopUp({ organizationId, sku, quantity: 1 });
}

/** Platform admin manual grant into add-on pool. */
export async function grantAdminAddonBalance(params: {
  organizationId: string;
  pool: AiCreditPool;
  amount: number;
}): Promise<void> {
  if (params.amount <= 0) return;
  await ensureBalanceRow(params.organizationId, params.pool);
  await prisma.orgAiCreditBalance.update({
    where: {
      organizationId_pool: {
        organizationId: params.organizationId,
        pool: params.pool,
      },
    },
    data: { addonBalance: { increment: params.amount } },
  });
}
