import prisma from '../../../config/database';
import { AppError } from '../../../utils/response';
import {
  AI_RECURRING_ADDON_SKUS,
  getAiTopupSku,
  inclGstPaise,
  type AiTopupSku,
} from './catalog';
import { grantTopUp } from './service';
import {
  cancelRazorpaySubscription,
  createRazorpayPlan,
  createRazorpaySubscription,
  fetchRazorpaySubscription,
} from '../razorpay.service';

export type RecurringAddonStatus = 'CREATED' | 'ACTIVE' | 'CANCELLED' | 'HALTED' | 'COMPLETED';

export type ActiveRecurringAddonView = {
  skuId: string;
  pool: 'chat' | 'calling';
  label: string;
  units: number;
  inclGstPaise: number;
  status: RecurringAddonStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

function periodEndFromUnix(seconds?: number | null): Date | null {
  if (!seconds || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

export async function listActiveRecurringAddons(
  organizationId: string
): Promise<ActiveRecurringAddonView[]> {
  const rows = await prisma.orgAiRecurringAddon.findMany({
    where: {
      organizationId,
      status: { in: ['CREATED', 'ACTIVE', 'CANCELLED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => {
    const sku = getAiTopupSku(row.skuId);
    return {
      skuId: row.skuId,
      pool: row.pool as 'chat' | 'calling',
      label: sku?.label ?? row.skuId,
      units: sku?.units ?? 0,
      inclGstPaise: sku ? inclGstPaise(sku.pricePaise) : 0,
      status: row.status as RecurringAddonStatus,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row.status === 'CANCELLED' && !row.cancelledAt,
    };
  });
}

async function ensureRazorpayPlanForSku(sku: AiTopupSku): Promise<string> {
  const amountPaise = inclGstPaise(sku.pricePaise);
  const cached = await prisma.razorpayPlanCache.findUnique({ where: { skuId: sku.id } });
  if (cached && cached.amountPaise === amountPaise) {
    return cached.razorpayPlanId;
  }

  const plan = await createRazorpayPlan({
    name: `Samyoj ${sku.label}`,
    amountPaise,
    description: sku.description,
    notes: { skuId: sku.id, type: 'ai_recurring_addon' },
  });

  await prisma.razorpayPlanCache.upsert({
    where: { skuId: sku.id },
    create: { skuId: sku.id, razorpayPlanId: plan.id, amountPaise },
    update: { razorpayPlanId: plan.id, amountPaise },
  });

  return plan.id;
}

export async function createRecurringAddonSubscription(params: {
  organizationId: string;
  skuId: string;
}): Promise<{
  subscriptionId: string;
  keyId: string;
  skuId: string;
  label: string;
  amountPaise: number;
}> {
  const sku = getAiTopupSku(params.skuId);
  if (!sku || sku.purchaseType !== 'recurring_addon') {
    throw new AppError(400, 'Invalid recurring AI add-on SKU');
  }

  const existing = await prisma.orgAiRecurringAddon.findUnique({
    where: {
      organizationId_skuId: {
        organizationId: params.organizationId,
        skuId: sku.id,
      },
    },
  });
  if (existing && ['CREATED', 'ACTIVE'].includes(existing.status)) {
    throw new AppError(409, 'This monthly add-on is already active or pending checkout.');
  }

  const planId = await ensureRazorpayPlanForSku(sku);
  const subscription = await createRazorpaySubscription({
    planId,
    notes: {
      organizationId: params.organizationId,
      skuId: sku.id,
      type: 'ai_recurring_addon',
    },
  });

  await prisma.orgAiRecurringAddon.upsert({
    where: {
      organizationId_skuId: {
        organizationId: params.organizationId,
        skuId: sku.id,
      },
    },
    create: {
      organizationId: params.organizationId,
      skuId: sku.id,
      pool: sku.pool,
      razorpaySubscriptionId: subscription.id,
      razorpayPlanId: planId,
      status: 'CREATED',
    },
    update: {
      razorpaySubscriptionId: subscription.id,
      razorpayPlanId: planId,
      status: 'CREATED',
      cancelledAt: null,
      currentPeriodEnd: null,
    },
  });

  const { config } = await import('../../../config');

  return {
    subscriptionId: subscription.id,
    keyId: config.razorpay.keyId,
    skuId: sku.id,
    label: sku.label,
    amountPaise: inclGstPaise(sku.pricePaise),
  };
}

export async function grantRecurringAddonCharge(params: {
  organizationId: string;
  skuId: string;
  razorpayPaymentId: string;
  razorpaySubscriptionId?: string;
  currentPeriodEnd?: Date | null;
}): Promise<{ creditsGranted: number; alreadyGranted: boolean }> {
  const sku = getAiTopupSku(params.skuId);
  if (!sku || sku.purchaseType !== 'recurring_addon') {
    throw new AppError(400, 'Unknown recurring add-on SKU');
  }

  const existing = await prisma.aiCreditPurchase.findUnique({
    where: { razorpayPaymentId: params.razorpayPaymentId },
  });
  if (existing) {
    return { creditsGranted: existing.creditsGranted, alreadyGranted: true };
  }

  const grant = await grantTopUp({
    organizationId: params.organizationId,
    sku,
    quantity: 1,
    paymentOrderId: undefined,
    razorpayPaymentId: params.razorpayPaymentId,
    razorpaySubscriptionId: params.razorpaySubscriptionId,
  });

  if (params.razorpaySubscriptionId) {
    await prisma.orgAiRecurringAddon.updateMany({
      where: {
        organizationId: params.organizationId,
        razorpaySubscriptionId: params.razorpaySubscriptionId,
      },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: params.currentPeriodEnd ?? undefined,
      },
    });
  }

  return { creditsGranted: grant.creditsGranted, alreadyGranted: false };
}

export async function verifyAndGrantRecurringCheckout(params: {
  organizationId: string;
  subscriptionId: string;
  paymentId: string;
}): Promise<{ creditsGranted: number; alreadyGranted: boolean }> {
  const row = await prisma.orgAiRecurringAddon.findFirst({
    where: {
      organizationId: params.organizationId,
      razorpaySubscriptionId: params.subscriptionId,
    },
  });
  if (!row) throw new AppError(404, 'Recurring add-on subscription not found');

  const remote = await fetchRazorpaySubscription(params.subscriptionId);
  const periodEnd = periodEndFromUnix(remote.current_end);

  return grantRecurringAddonCharge({
    organizationId: params.organizationId,
    skuId: row.skuId,
    razorpayPaymentId: params.paymentId,
    razorpaySubscriptionId: params.subscriptionId,
    currentPeriodEnd: periodEnd,
  });
}

export async function cancelRecurringAddon(params: {
  organizationId: string;
  skuId: string;
}): Promise<{ status: string; currentPeriodEnd: string | null }> {
  const row = await prisma.orgAiRecurringAddon.findUnique({
    where: {
      organizationId_skuId: {
        organizationId: params.organizationId,
        skuId: params.skuId,
      },
    },
  });
  if (!row) throw new AppError(404, 'No active recurring add-on found');
  if (!['CREATED', 'ACTIVE'].includes(row.status)) {
    throw new AppError(400, 'Recurring add-on is not active');
  }

  await cancelRazorpaySubscription(row.razorpaySubscriptionId, true);

  const remote = await fetchRazorpaySubscription(row.razorpaySubscriptionId);
  const periodEnd = periodEndFromUnix(remote.current_end);

  const updated = await prisma.orgAiRecurringAddon.update({
    where: { id: row.id },
    data: {
      status: 'CANCELLED',
      currentPeriodEnd: periodEnd ?? row.currentPeriodEnd,
    },
  });

  return {
    status: updated.status,
    currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
  };
}

export async function handleRecurringSubscriptionWebhook(event: {
  event: string;
  payload?: {
    subscription?: { entity?: { id?: string; status?: string; current_end?: number; notes?: Record<string, string> } };
    payment?: { entity?: { id?: string } };
  };
}): Promise<void> {
  const subscription = event.payload?.subscription?.entity;
  if (!subscription?.id) return;

  const row = await prisma.orgAiRecurringAddon.findUnique({
    where: { razorpaySubscriptionId: subscription.id },
  });
  if (!row) return;

  const periodEnd = periodEndFromUnix(subscription.current_end);

  if (event.event === 'subscription.charged') {
    const paymentId = event.payload?.payment?.entity?.id;
    if (!paymentId) return;
    await grantRecurringAddonCharge({
      organizationId: row.organizationId,
      skuId: row.skuId,
      razorpayPaymentId: paymentId,
      razorpaySubscriptionId: subscription.id,
      currentPeriodEnd: periodEnd,
    });
    return;
  }

  if (event.event === 'subscription.activated' || event.event === 'subscription.authenticated') {
    await prisma.orgAiRecurringAddon.update({
      where: { id: row.id },
      data: { status: 'ACTIVE', currentPeriodEnd: periodEnd ?? undefined },
    });
    return;
  }

  if (event.event === 'subscription.cancelled' || event.event === 'subscription.completed') {
    await prisma.orgAiRecurringAddon.update({
      where: { id: row.id },
      data: {
        status: event.event === 'subscription.completed' ? 'COMPLETED' : 'CANCELLED',
        cancelledAt: new Date(),
        currentPeriodEnd: periodEnd ?? undefined,
      },
    });
    return;
  }

  if (event.event === 'subscription.halted') {
    await prisma.orgAiRecurringAddon.update({
      where: { id: row.id },
      data: { status: 'HALTED', currentPeriodEnd: periodEnd ?? undefined },
    });
  }
}

export const RECURRING_ADDON_SKU_COUNT = AI_RECURRING_ADDON_SKUS.length;
