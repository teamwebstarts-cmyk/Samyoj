import prisma from '../../config/database';
import type { Prisma } from '@prisma/client';
import { legacyPlanToTier, type PlanTier } from './plans';

type Db = typeof prisma | Prisma.TransactionClient;

export type CurrentPlanPeriod = {
  id: string;
  organizationId: string;
  planTier: string;
  skuId: string | null;
  cadence: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
  sourcePaymentOrderId: string | null;
  amountPaise: number;
  currency: string;
  taxAmountPaise: number;
  supersedesId: string | null;
};

/**
 * The ledger is authoritative when a period exists. The cache fallback is
 * intentionally kept for organizations created before the ledger migration.
 */
export async function getCurrentPlanPeriod(
  organizationId: string,
  db: Db = prisma
): Promise<CurrentPlanPeriod | null> {
  return db.planPeriod.findFirst({
    where: {
      organizationId,
      status: 'ACTIVE',
      startsAt: { lte: new Date() },
      endsAt: { gt: new Date() },
    },
    orderBy: { startsAt: 'desc' },
  });
}

export function tierFromPeriodOrCache(
  period: Pick<CurrentPlanPeriod, 'planTier'> | null,
  legacyPlan: string
): PlanTier {
  return period ? legacyPlanToTier(period.planTier) : legacyPlanToTier(legacyPlan);
}

export function periodIsExpired(period: Pick<CurrentPlanPeriod, 'endsAt'> | null): boolean {
  return Boolean(period && period.endsAt.getTime() <= Date.now());
}

export function periodSnapshot(period: {
  planTier: string;
  skuId?: string | null;
  cadence?: string | null;
  startsAt: Date;
  endsAt: Date;
  amountPaise: number;
  currency: string;
  taxAmountPaise: number;
  sourcePaymentOrderId?: string | null;
  status?: string;
  supersedesId?: string | null;
}) {
  return {
    planTier: period.planTier,
    skuId: period.skuId ?? null,
    cadence: period.cadence ?? null,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    amountPaise: period.amountPaise,
    currency: period.currency,
    taxAmountPaise: period.taxAmountPaise,
    sourcePaymentOrderId: period.sourcePaymentOrderId ?? null,
    status: period.status ?? 'ACTIVE',
    supersedesId: period.supersedesId ?? null,
  };
}
