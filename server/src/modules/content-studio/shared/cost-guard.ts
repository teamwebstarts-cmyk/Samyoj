import { GenerationCreditKind, GenerationJobKind } from '@prisma/client';
import prisma from '../../../config/database';
import { AppError } from '../../../utils/response';
import { emitToOrg } from '../../../realtime';
import { getPlan } from '../../billing/plans';
import { ledgerKindForJob } from './policy-guard';

const PLAN_LIMITS: Record<string, Record<GenerationCreditKind, bigint>> = {
  launch: {
    TEXT_TOKENS: 20_000n,
    IMAGES: 2n,
    VIDEO_SECONDS: 0n,
    VOICE_MINUTES: 0n,
    STT_MINUTES: 0n,
  },
  starter: {
    TEXT_TOKENS: 100_000n,
    IMAGES: 10n,
    VIDEO_SECONDS: 30n,
    VOICE_MINUTES: 5n,
    STT_MINUTES: 10n,
  },
  growth: {
    TEXT_TOKENS: 500_000n,
    IMAGES: 100n,
    VIDEO_SECONDS: 300n,
    VOICE_MINUTES: 50n,
    STT_MINUTES: 120n,
  },
  pro: {
    TEXT_TOKENS: 5_000_000n,
    IMAGES: 1_000n,
    VIDEO_SECONDS: 1_800n,
    VOICE_MINUTES: 300n,
    STT_MINUTES: 600n,
  },
  enterprise: {
    TEXT_TOKENS: 50_000_000n,
    IMAGES: 10_000n,
    VIDEO_SECONDS: 18_000n,
    VOICE_MINUTES: 3_000n,
    STT_MINUTES: 6_000n,
  },
};

/** Map legacy plan ids (`business`) onto the current catalog. */
export function resolveContentStudioPlan(planId: string | null | undefined): string {
  if (!planId) return 'starter';
  if (planId === 'business') return 'pro';
  return planId in PLAN_LIMITS ? planId : 'starter';
}

function limitsForPlan(planId: string | null | undefined) {
  return PLAN_LIMITS[resolveContentStudioPlan(planId)];
}

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function getOrCreateLedger(organizationId: string, kind: GenerationCreditKind) {
  const periodStart = startOfDay();
  const periodEnd = endOfDay();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  const planId = resolveContentStudioPlan(org?.plan);
  const limits = limitsForPlan(planId);
  const hardLimit = limits[kind];
  const softLimit = (hardLimit * 80n) / 100n;

  return prisma.generationCreditLedger.upsert({
    where: {
      organizationId_periodStart_kind: {
        organizationId,
        periodStart,
        kind,
      },
    },
    create: {
      organizationId,
      periodStart,
      periodEnd,
      kind,
      usedUnits: 0n,
      softLimitUnits: softLimit,
      hardLimitUnits: hardLimit,
    },
    update: {},
  });
}

export async function assertBudget(
  organizationId: string,
  kind: GenerationJobKind,
  estimatedUnits: number
): Promise<void> {
  const creditKind = ledgerKindForJob(kind);
  const ledger = await getOrCreateLedger(organizationId, creditKind);
  const projected = ledger.usedUnits + BigInt(Math.ceil(estimatedUnits));

  if (projected > ledger.hardLimitUnits) {
    throw new AppError(
      429,
      'Daily generation budget exceeded. Upgrade your plan or wait until tomorrow.'
    );
  }

  if (projected > ledger.softLimitUnits) {
    emitToOrg(organizationId, 'content:budget:warning', {
      kind: creditKind,
      projected: Number(projected),
      softLimit: Number(ledger.softLimitUnits),
      plan: getPlan((await prisma.organization.findUnique({ where: { id: organizationId }, select: { plan: true } }))?.plan || 'starter')?.name,
    });
  }
}

export async function recordUsage(
  organizationId: string,
  kind: GenerationJobKind,
  units: number
): Promise<void> {
  const creditKind = ledgerKindForJob(kind);
  const ledger = await getOrCreateLedger(organizationId, creditKind);

  await prisma.generationCreditLedger.update({
    where: { id: ledger.id },
    data: { usedUnits: { increment: BigInt(Math.ceil(units)) } },
  });
}

export async function getCreditSummary(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  const planId = resolveContentStudioPlan(org?.plan);
  const limits = limitsForPlan(planId);
  const periodStart = startOfDay();

  const ledgers = await prisma.generationCreditLedger.findMany({
    where: { organizationId, periodStart },
  });

  const byKind = Object.keys(limits).reduce(
    (acc, key) => {
      const kind = key as GenerationCreditKind;
      const ledger = ledgers.find((l) => l.kind === kind);
      acc[kind] = {
        used: Number(ledger?.usedUnits || 0n),
        softLimit: Number(ledger?.softLimitUnits || (limits[kind] * 80n) / 100n),
        hardLimit: Number(ledger?.hardLimitUnits || limits[kind]),
      };
      return acc;
    },
    {} as Record<string, { used: number; softLimit: number; hardLimit: number }>
  );

  return { plan: planId, periodStart, credits: byKind };
}
