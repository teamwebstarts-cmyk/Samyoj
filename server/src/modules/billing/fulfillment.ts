import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { activatePlan } from './razorpay.service';
import { resolveSkuForPaymentOrder } from './catalog';
import { AI_ADDON_PLAN_ID, getAiTopupSku } from './ai-credits/catalog';
import { grantTopUpBySkuId, resetIncludedOnRenewal } from './ai-credits/service';

export function parseTopupQuantity(cadence: string | null | undefined): number {
  if (!cadence?.startsWith('topup:')) return 1;
  const n = parseInt(cadence.split(':')[1], 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 99);
}

async function fulfillAiAddonOrder(params: {
  paymentOrderId: string;
  paymentId: string;
}): Promise<{
  organizationId: string;
  plan: string;
  planExpiresAt: Date | null;
  alreadyCaptured: boolean;
  creditsGranted?: number;
}> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: params.paymentOrderId } });
  if (!order) throw new AppError(404, 'Payment order not found');

  const org = await prisma.organization.findUnique({ where: { id: order.organizationId } });
  if (!org) throw new AppError(404, 'Organization not found');

  const existingGrant = await prisma.aiCreditPurchase.findFirst({
    where: { paymentOrderId: order.id },
  });
  if (order.status === 'CAPTURED' || existingGrant) {
    return {
      organizationId: order.organizationId,
      plan: org.plan,
      planExpiresAt: org.planExpiresAt,
      alreadyCaptured: true,
      creditsGranted: existingGrant?.creditsGranted,
    };
  }

  const sku = getAiTopupSku(order.skuId || '');
  if (!sku || sku.purchaseType !== 'topup') {
    throw new AppError(400, 'Invalid AI add-on order');
  }

  const quantity = parseTopupQuantity(order.cadence);

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: 'CAPTURED',
      paymentId: params.paymentId,
      paidAt: new Date(),
    },
  });

  const grant = await grantTopUpBySkuId({
    organizationId: order.organizationId,
    skuId: sku.id,
    quantity,
    paymentOrderId: order.id,
  });

  return {
    organizationId: order.organizationId,
    plan: org.plan,
    planExpiresAt: org.planExpiresAt,
    alreadyCaptured: false,
    creditsGranted: grant.creditsGranted,
  };
}

export async function fulfillCapturedPayment(params: {
  paymentOrderId: string;
  paymentId: string;
}): Promise<{
  organizationId: string;
  plan: string;
  planExpiresAt: Date | null;
  alreadyCaptured: boolean;
  creditsGranted?: number;
}> {
  const order = await prisma.paymentOrder.findUnique({ where: { id: params.paymentOrderId } });
  if (!order) throw new AppError(404, 'Payment order not found');

  if (order.planId === AI_ADDON_PLAN_ID) {
    return fulfillAiAddonOrder(params);
  }

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.paymentOrder.findUnique({ where: { id: params.paymentOrderId } });
    if (!locked) throw new AppError(404, 'Payment order not found');

    const org = await tx.organization.findUnique({ where: { id: locked.organizationId } });
    if (!org) throw new AppError(404, 'Organization not found');

    if (locked.status === 'CAPTURED') {
      return {
        organizationId: locked.organizationId,
        plan: org.plan,
        planExpiresAt: org.planExpiresAt,
        alreadyCaptured: true,
      };
    }

    const sku = resolveSkuForPaymentOrder(locked);

    await tx.paymentOrder.update({
      where: { id: locked.id },
      data: {
        status: 'CAPTURED',
        paymentId: params.paymentId,
        paidAt: new Date(),
      },
    });

    const updatedOrg = await activatePlan(locked.organizationId, locked.planId, sku?.periodDays, tx);

    return {
      organizationId: locked.organizationId,
      plan: updatedOrg.plan,
      planExpiresAt: updatedOrg.planExpiresAt,
      alreadyCaptured: false,
    };
  });

  if (!result.alreadyCaptured) {
    await resetIncludedOnRenewal(result.organizationId);
  }

  return result;
}

export async function markPaymentOrderFailed(paymentOrderId: string): Promise<void> {
  await prisma.paymentOrder.updateMany({
    where: { id: paymentOrderId, status: { not: 'CAPTURED' } },
    data: { status: 'FAILED' },
  });
}

export async function findReusablePendingOrder(
  organizationId: string,
  planId: string,
  skuId: string,
  maxAgeMs = 30 * 60 * 1000
) {
  const since = new Date(Date.now() - maxAgeMs);
  return prisma.paymentOrder.findFirst({
    where: {
      organizationId,
      planId,
      skuId,
      status: 'CREATED',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function expireStaleCreatedOrders(organizationId: string, planId: string) {
  await prisma.paymentOrder.updateMany({
    where: { organizationId, planId, status: 'CREATED' },
    data: { status: 'FAILED' },
  });
}
