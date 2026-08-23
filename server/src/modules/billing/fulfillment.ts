import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { activatePlan } from './razorpay.service';
import { resolveSkuForPaymentOrder } from './catalog';

type TxClient = Prisma.TransactionClient;

export async function fulfillCapturedPayment(params: {
  paymentOrderId: string;
  paymentId: string;
}): Promise<{ organizationId: string; plan: string; planExpiresAt: Date | null; alreadyCaptured: boolean }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.paymentOrder.findUnique({ where: { id: params.paymentOrderId } });
    if (!order) throw new AppError(404, 'Payment order not found');

    const org = await tx.organization.findUnique({ where: { id: order.organizationId } });
    if (!org) throw new AppError(404, 'Organization not found');

    if (order.status === 'CAPTURED') {
      return {
        organizationId: order.organizationId,
        plan: org.plan,
        planExpiresAt: org.planExpiresAt,
        alreadyCaptured: true,
      };
    }

    const sku = resolveSkuForPaymentOrder(order);

    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'CAPTURED',
        paymentId: params.paymentId,
        paidAt: new Date(),
      },
    });

    const updatedOrg = await activatePlan(order.organizationId, order.planId, sku?.periodDays, tx);

    return {
      organizationId: order.organizationId,
      plan: updatedOrg.plan,
      planExpiresAt: updatedOrg.planExpiresAt,
      alreadyCaptured: false,
    };
  });
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
