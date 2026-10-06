import type { Prisma } from '@prisma/client';
import prisma from '../../../config/database';
import { AppError } from '../../../utils/response';
import { type PlanTier } from '../plans';
import type { OrgAiSettings } from '../../ai/types';
import { checkQuota, getOrgEntitlements } from '../entitlements.service';
import { getCurrentPlanPeriod, tierFromPeriodOrCache } from '../billing-state.service';
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
  includedLimit: number | 'custom';
  includedUsed: number;
  includedRemaining: number | 'custom';
  addonBalance: number;
  reserved: number;
  totalRemaining: number | 'custom';
  periodStart: string;
  periodEnd: string;
};

type Tx = Prisma.TransactionClient;

function defaultPeriodEnd(planExpiresAt: Date | null): Date {
  if (planExpiresAt) {
    return planExpiresAt;
  }
  // Legacy organizations without an expiry still need a stable monthly
  // bucket; using `now + 1 month` would reset included usage on every read.
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

function defaultPeriodStart(periodEnd: Date): Date {
  const start = new Date(periodEnd);
  start.setMonth(start.getMonth() - 1);
  return start;
}

export function includedLimitForPlan(
  planTier: PlanTier,
  pool: AiCreditPool,
  settings?: Pick<OrgAiSettings, 'customChatCreditsIncluded' | 'customCallingMinutesIncluded'>
): number {
  const row = INCLUDED_ALLOWANCES[planTier] || INCLUDED_ALLOWANCES.launch;
  const allowance = pool === 'chat' ? row.chatCreditsIncluded : row.callingMinutesIncluded;
  if (allowance === 'custom') {
    const configured =
      pool === 'chat' ? settings?.customChatCreditsIncluded : settings?.customCallingMinutesIncluded;
    return typeof configured === 'number' && configured >= 0 ? configured : 0;
  }
  return allowance;
}

export function includedAllowanceForPlan(
  planTier: PlanTier,
  pool: AiCreditPool,
  settings?: Pick<OrgAiSettings, 'customChatCreditsIncluded' | 'customCallingMinutesIncluded'>
): number | 'custom' {
  const row = INCLUDED_ALLOWANCES[planTier] || INCLUDED_ALLOWANCES.launch;
  const allowance = pool === 'chat' ? row.chatCreditsIncluded : row.callingMinutesIncluded;
  if (allowance !== 'custom') return allowance;
  const configured =
    pool === 'chat' ? settings?.customChatCreditsIncluded : settings?.customCallingMinutesIncluded;
  return typeof configured === 'number' && configured >= 0 ? configured : 'custom';
}

async function loadOrg(orgId: string, tx: Tx = prisma) {
  const org = await tx.organization.findUnique({
    where: { id: orgId },
    select: { id: true, plan: true, planExpiresAt: true, settings: true },
  });
  if (!org) throw new AppError(404, 'Organization not found');
  return org;
}

async function ensureBalanceRow(
  organizationId: string,
  pool: AiCreditPool,
  tx: Tx = prisma,
  planExpiresAtOverride?: Date | null
) {
  const org = await loadOrg(organizationId, tx);
  const periodEnd = defaultPeriodEnd(planExpiresAtOverride ?? org.planExpiresAt);
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
    reserved: number;
    periodStart: Date;
    periodEnd: Date;
  },
  includedLimit: number | 'custom'
): AiCreditBalanceView {
  if (includedLimit === 'custom') {
    return {
      pool,
      includedLimit,
      includedUsed: row.includedUsed,
      includedRemaining: 'custom',
      addonBalance: row.addonBalance,
      reserved: row.reserved,
      totalRemaining: 'custom',
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
    };
  }
  const includedRemaining = Math.max(0, includedLimit - row.includedUsed);
  const totalRemaining = Math.max(
    0,
    includedRemaining + Math.max(0, row.addonBalance) - Math.max(0, row.reserved),
  );
  return {
    pool,
    includedLimit,
    includedUsed: row.includedUsed,
    includedRemaining,
    addonBalance: row.addonBalance,
    reserved: row.reserved,
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
  const entitlements = await getOrgEntitlements(organizationId);
  const planTier = entitlements.planTier;
  const aiSettings = ((org.settings as Record<string, unknown> | null)?.ai || {}) as OrgAiSettings;

  const [chatRow, callingRow] = await Promise.all([
    ensureBalanceRow(organizationId, 'chat', prisma, entitlements.planExpiresAt),
    ensureBalanceRow(organizationId, 'calling', prisma, entitlements.planExpiresAt),
  ]);

  return {
    chat: toView('chat', chatRow, includedAllowanceForPlan(planTier, 'chat', aiSettings)),
    calling: toView('calling', callingRow, includedAllowanceForPlan(planTier, 'calling', aiSettings)),
    periodEnd: entitlements.planExpiresAt?.toISOString() ?? chatRow.periodEnd.toISOString(),
  };
}

async function meteringEnforced(): Promise<boolean> {
  const { isSubscriptionEnforcementEnabled } = await import('../subscription-enforcement');
  return isSubscriptionEnforcementEnabled();
}

export async function assertAiCreditsAvailable(
  organizationId: string,
  pool: AiCreditPool,
  amount = 1
): Promise<void> {
  if (!(await meteringEnforced())) return;
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
  if (view.totalRemaining === 'custom') {
    throw new AppError(
      403,
      'Your Enterprise AI allowance is administrator-configured. Contact your administrator to enable usage.',
      'AI_CUSTOM_ALLOWANCE_REQUIRED'
    );
  }
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

export async function reserveCallingMinutesForCall(params: {
  organizationId: string;
  callId: string;
  minutes?: number;
}): Promise<void> {
  if (!(await meteringEnforced())) return;
  const amount = Math.max(1, Math.ceil(params.minutes ?? 1));
  const quota = await checkQuota(params.organizationId, 'calling');
  if (!quota.allowed) {
    throw new AppError(403, quota.reason || 'AI calling is not included on your plan.', quota.code);
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.aiCreditReservation.findUnique({
      where: { callId: params.callId },
    });
    if (existing) return;

    const org = await loadOrg(params.organizationId, tx);
    const currentPeriod = await getCurrentPlanPeriod(params.organizationId, tx);
    const planTier = tierFromPeriodOrCache(currentPeriod, org.plan);
    const aiSettings = ((org.settings as Record<string, unknown> | null)?.ai || {}) as OrgAiSettings;
    const includedLimit = includedAllowanceForPlan(planTier, 'calling', aiSettings);
    if (includedLimit === 'custom') {
      throw new AppError(
        403,
        'Your Enterprise AI allowance is administrator-configured. Contact your administrator to enable usage.',
        'AI_CUSTOM_ALLOWANCE_REQUIRED',
      );
    }

    await ensureBalanceRow(
      params.organizationId,
      'calling',
      tx,
      currentPeriod?.endsAt ?? org.planExpiresAt,
    );
    await tx.$queryRaw`
      SELECT id
      FROM "org_ai_credit_balances"
      WHERE "organization_id" = ${params.organizationId} AND "pool" = 'calling'
      FOR UPDATE
    `;
    const row = await tx.orgAiCreditBalance.findUnique({
      where: {
        organizationId_pool: {
          organizationId: params.organizationId,
          pool: 'calling',
        },
      },
    });
    if (!row) throw new AppError(500, 'AI credit balance unavailable');

    const available =
      Math.max(0, includedLimit - row.includedUsed) +
      Math.max(0, row.addonBalance) -
      Math.max(0, row.reserved);
    if (available < amount) {
      throw new AppError(429, 'AI calling minutes exhausted.', 'AI_CREDITS_EXHAUSTED');
    }

    await tx.orgAiCreditBalance.update({
      where: { id: row.id },
      data: { reserved: row.reserved + amount },
    });
    await tx.aiCreditReservation.create({
      data: {
        organizationId: params.organizationId,
        pool: 'calling',
        callId: params.callId,
        amount,
      },
    });
  });
}

/** Stop hammering the same row. Exhausted credits will not appear until a top-up. */
export const AI_METERING_MAX_ATTEMPTS = 8;

export function nextMeteringStatus(err: unknown, attempts: number): 'PENDING_RETRY' | 'FAILED' {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  const message = err instanceof Error ? err.message : String(err);
  if (code === 'AI_CREDITS_EXHAUSTED' || /credits exhausted|minutes exhausted/i.test(message)) {
    return 'FAILED';
  }
  if (attempts >= AI_METERING_MAX_ATTEMPTS) return 'FAILED';
  return 'PENDING_RETRY';
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
  const currentPeriod = await getCurrentPlanPeriod(organizationId, tx);
  const planTier = tierFromPeriodOrCache(currentPeriod, org.plan);
  const aiSettings = ((org.settings as Record<string, unknown> | null)?.ai || {}) as OrgAiSettings;
  const includedLimit = includedLimitForPlan(planTier, pool, aiSettings);

  await ensureBalanceRow(organizationId, pool, tx, currentPeriod?.endsAt ?? org.planExpiresAt);
  // Serialize deductions for the same pool. A read-then-write without this
  // lock lets concurrent AI requests spend the same included/add-on units.
  await tx.$queryRaw`
    SELECT id
    FROM "org_ai_credit_balances"
    WHERE "organization_id" = ${organizationId} AND "pool" = ${pool}
    FOR UPDATE
  `;
  const lockedRow = await tx.orgAiCreditBalance.findUnique({
    where: { organizationId_pool: { organizationId, pool } },
  });
  if (!lockedRow) throw new AppError(500, 'AI credit balance unavailable');

  const next = computeDeductionSplit({
    includedLimit,
    includedUsed: lockedRow.includedUsed,
    addonBalance: lockedRow.addonBalance,
    amount,
  });
  const available =
    Math.max(0, includedLimit - lockedRow.includedUsed) +
    Math.max(0, lockedRow.addonBalance) -
    Math.max(0, lockedRow.reserved);
  if (!next || available < amount) {
    throw new AppError(429, 'AI credits exhausted', 'AI_CREDITS_EXHAUSTED');
  }

  await tx.orgAiCreditBalance.update({
    where: { id: lockedRow.id },
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
  if (!(await meteringEnforced())) return;

  try {
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
  } catch (err) {
    // Two retry workers may race on the same usage row. A unique-key winner
    // means the deduction already committed; treat that retry as successful.
    if ((err as { code?: string })?.code === 'P2002') {
      const existing = await prisma.aiCreditDeduction.findUnique({
        where: { usageLogId: params.usageLogId },
      });
      if (existing) return;
    }
    throw err;
  }
}

export async function deductCallingMinutesForCall(params: {
  organizationId: string;
  callId: string;
  durationSeconds: number;
}): Promise<void> {
  const amount = callingSecondsToMinutes(params.durationSeconds);
  if (amount <= 0) return;
  if (!(await meteringEnforced())) return;

  try {
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
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002') {
      const existing = await prisma.aiCreditDeduction.findUnique({
        where: { callId: params.callId },
      });
      if (existing) return;
    }
    throw err;
  }
}

async function releaseCallingReservation(organizationId: string, callId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.aiCreditReservation.findUnique({ where: { callId } });
    if (!current || current.status !== 'RESERVED') return;
    const balance = await tx.orgAiCreditBalance.findUnique({
      where: {
        organizationId_pool: { organizationId, pool: 'calling' },
      },
    });
    if (balance) {
      await tx.orgAiCreditBalance.update({
        where: { id: balance.id },
        data: { reserved: Math.max(0, balance.reserved - current.amount) },
      });
    }
    await tx.aiCreditReservation.update({
      where: { id: current.id },
      data: { status: 'EXPIRED', settledAt: new Date() },
    });
  });
}

export async function settleCallingMinutesForCall(params: {
  organizationId: string;
  callId: string;
  durationSeconds: number;
}): Promise<void> {
  if (!(await meteringEnforced())) {
    await releaseCallingReservation(params.organizationId, params.callId);
    return;
  }
  const actualAmount = callingSecondsToMinutes(params.durationSeconds);
  const current = await prisma.aiCreditReservation.findUnique({
    where: { callId: params.callId },
  });
  if (!current) {
    await deductCallingMinutesForCall(params);
    return;
  }
  if (current.status !== 'RESERVED') return;

  await prisma.$transaction(async (tx) => {
    const reservation = await tx.aiCreditReservation.findUnique({
      where: { callId: params.callId },
    });
    if (!reservation || reservation.status !== 'RESERVED') return;

    const org = await loadOrg(params.organizationId, tx);
    const currentPeriod = await getCurrentPlanPeriod(params.organizationId, tx);
    await ensureBalanceRow(
      params.organizationId,
      'calling',
      tx,
      currentPeriod?.endsAt ?? org.planExpiresAt,
    );
    await tx.$queryRaw`
      SELECT id
      FROM "org_ai_credit_balances"
      WHERE "organization_id" = ${params.organizationId} AND "pool" = 'calling'
      FOR UPDATE
    `;
    const row = await tx.orgAiCreditBalance.findUnique({
      where: {
        organizationId_pool: {
          organizationId: params.organizationId,
          pool: 'calling',
        },
      },
    });
    if (!row) throw new AppError(500, 'AI credit balance unavailable');

    await tx.orgAiCreditBalance.update({
      where: { id: row.id },
      data: { reserved: Math.max(0, row.reserved - reservation.amount) },
    });

    if (actualAmount > 0) {
      await deductAmount(params.organizationId, 'calling', actualAmount, tx);
      await tx.aiCreditDeduction.create({
        data: {
          organizationId: params.organizationId,
          pool: 'calling',
          amount: actualAmount,
          callId: params.callId,
        },
      });
    }
    await tx.aiCreditReservation.update({
      where: { id: reservation.id },
      data: {
        status: 'SETTLED',
        amount: actualAmount,
        settledAt: new Date(),
      },
    });
  });
}

export async function releaseStaleCallingCreditReservations(
  maxAgeMs = 2 * 60 * 60 * 1000,
  limit = 100,
): Promise<number> {
  const rows = await prisma.aiCreditReservation.findMany({
    where: {
      pool: 'calling',
      status: 'RESERVED',
      createdAt: { lt: new Date(Date.now() - maxAgeMs) },
    },
    select: { id: true, organizationId: true, pool: true, amount: true },
    take: limit,
  });
  let released = 0;
  for (const reservation of rows) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.aiCreditReservation.findUnique({
        where: { id: reservation.id },
      });
      if (!current || current.status !== 'RESERVED') return;
      await tx.$queryRaw`
        SELECT id
        FROM "org_ai_credit_balances"
        WHERE "organization_id" = ${current.organizationId} AND "pool" = ${current.pool}
        FOR UPDATE
      `;
      const balance = await tx.orgAiCreditBalance.findUnique({
        where: {
          organizationId_pool: {
            organizationId: current.organizationId,
            pool: current.pool,
          },
        },
      });
      if (balance) {
        await tx.orgAiCreditBalance.update({
          where: { id: balance.id },
          data: { reserved: Math.max(0, balance.reserved - current.amount) },
        });
      }
      await tx.aiCreditReservation.update({
        where: { id: current.id },
        data: { status: 'EXPIRED', settledAt: new Date() },
      });
      released += 1;
    });
  }
  return released;
}

/**
 * Reconcile call deductions that were durably marked pending after a call
 * ended. The deduction key is the call ID, so a retry is safe after a worker
 * crash or a concurrent retry.
 */
export async function retryPendingCallingMinuteDeductions(limit = 100): Promise<number> {
  const rows = await prisma.call.findMany({
    where: {
      metadata: {
        path: ['billingStatus'],
        equals: 'PENDING_RETRY',
      },
    },
    select: {
      id: true,
      organizationId: true,
      metadata: true,
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });

  let settled = 0;
  for (const row of rows) {
    const metadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const durationSeconds = Number(metadata.billedDurationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      await prisma.call.update({
        where: { id: row.id },
        data: {
          metadata: {
            ...metadata,
            billingStatus: 'SETTLED',
            billingError: null,
          },
        },
      });
      settled += 1;
      continue;
    }

    try {
      await settleCallingMinutesForCall({
        organizationId: row.organizationId,
        callId: row.id,
        durationSeconds,
      });
      await prisma.call.update({
        where: { id: row.id },
        data: {
          metadata: {
            ...metadata,
            billingStatus: 'SETTLED',
            billingError: null,
          },
        },
      });
      settled += 1;
    } catch (err) {
      const attempts = Number(metadata.billingAttempts || 0) + 1;
      const billingStatus = nextMeteringStatus(err, attempts);
      await prisma.call.update({
        where: { id: row.id },
        data: {
          metadata: {
            ...metadata,
            billingStatus,
            billingAttempts: attempts,
            billingError: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
          },
        },
      });
    }
  }
  return settled;
}

export async function grantTopUp(params: {
  organizationId: string;
  sku: AiTopupSku;
  quantity?: number;
  paymentOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySubscriptionId?: string;
}): Promise<{ creditsGranted: number; addonBalance: number }> {
  const quantity = Math.max(1, params.quantity ?? 1);
  if (params.sku.purchaseType === 'topup' && quantity !== 1) {
    throw new AppError(400, 'Each AI add-on checkout is limited to one fixed pack', 'FIXED_TOPUP_SKU');
  }
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

  if (params.razorpayPaymentId) {
    const existing = await prisma.aiCreditPurchase.findUnique({
      where: { razorpayPaymentId: params.razorpayPaymentId },
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

  return prisma.$transaction((tx) => grantTopUpInTransaction({ ...params, quantity }, tx));
}

export async function grantTopUpInTransaction(
  params: {
    organizationId: string;
    sku: AiTopupSku;
    quantity?: number;
    paymentOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySubscriptionId?: string;
  },
  tx: Tx
): Promise<{ creditsGranted: number; addonBalance: number }> {
  const quantity = Math.max(1, params.quantity ?? 1);
  if (params.sku.purchaseType === 'topup' && quantity !== 1) {
    throw new AppError(400, 'Each AI add-on checkout is limited to one fixed pack', 'FIXED_TOPUP_SKU');
  }
  const creditsGranted = params.sku.units * quantity;

  if (params.paymentOrderId) {
    const existing = await tx.aiCreditPurchase.findFirst({
      where: { paymentOrderId: params.paymentOrderId },
    });
    if (existing) {
      const row = await tx.orgAiCreditBalance.findUnique({
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

  if (params.razorpayPaymentId) {
    const existing = await tx.aiCreditPurchase.findUnique({
      where: { razorpayPaymentId: params.razorpayPaymentId },
    });
    if (existing) {
      const row = await tx.orgAiCreditBalance.findUnique({
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

  if (params.sku.pool === 'chat') {
    await tx.aiUsageLog.updateMany({
      where: {
        organizationId: params.organizationId,
        meteringStatus: 'FAILED',
        meteringError: { contains: 'exhausted', mode: 'insensitive' },
      },
      data: { meteringStatus: 'PENDING_RETRY', meteringAttempts: 0 },
    });
  }

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
      razorpayPaymentId: params.razorpayPaymentId,
      razorpayAddonId: params.razorpaySubscriptionId,
    },
  });

  return { creditsGranted, addonBalance: row.addonBalance };
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
