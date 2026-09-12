import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { resolveSkuForPaymentOrder } from './catalog';
import { AI_ADDON_PLAN_ID, getAiTopupSku } from './ai-credits/catalog';
import { grantTopUpInTransaction } from './ai-credits/service';
import { legacyPlanToTier } from './plans';
import { TIER_ORDER } from './entitlements.service';
import {
  fetchRazorpayOrderPayments,
  verifyCapturedPayment,
} from './razorpay.service';
import { issueInvoiceForCharge } from './invoice.service';

export function parseTopupQuantity(cadence: string | null | undefined): number {
  if (!cadence?.startsWith('topup:')) return 1;
  const n = parseInt(cadence.split(':')[1], 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 99);
}

/** Units snapshot on flex checkouts: `topup:1:u:425`. Legacy packs have no `:u:` segment. */
export function parseFlexTopupUnits(cadence: string | null | undefined): number | null {
  if (!cadence) return null;
  const match = cadence.match(/^topup:1:u:(\d+)(?::r:\d+)?$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

async function fulfillAiAddonOrder(params: {
  paymentOrderId: string;
  paymentId: string;
  providerOrderStatus: string;
}): Promise<{
  organizationId: string;
  plan: string;
  planExpiresAt: Date | null;
  alreadyCaptured: boolean;
  creditsGranted?: number;
}> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "payment_orders" WHERE id = ${params.paymentOrderId} FOR UPDATE
    `;
    const order = await tx.paymentOrder.findUnique({ where: { id: params.paymentOrderId } });
    if (!order) throw new AppError(404, 'Payment order not found');

    const org = await tx.organization.findUnique({
      where: { id: order.organizationId },
      select: { plan: true, planExpiresAt: true },
    });
    if (!org) throw new AppError(404, 'Organization not found');

    if (order.status === 'CAPTURED') {
      if (order.paymentId && order.paymentId !== params.paymentId) {
        throw new AppError(409, 'Payment order is already linked to another payment', 'DUPLICATE_PAYMENT');
      }
      const existingGrant = await tx.aiCreditPurchase.findFirst({
        where: { paymentOrderId: order.id },
      });
      return {
        organizationId: order.organizationId,
        plan: org.plan,
        planExpiresAt: org.planExpiresAt,
        alreadyCaptured: true,
        creditsGranted: existingGrant?.creditsGranted,
      };
    }
    if (['FAILED', 'REVERSED', 'REFUNDED'].includes(order.status)) {
      throw new AppError(409, 'Payment order is already in a terminal state', 'PAYMENT_ORDER_TERMINAL');
    }

    const sku = getAiTopupSku(order.skuId || '');
    if (!sku || sku.purchaseType !== 'topup') {
      throw new AppError(400, 'Invalid AI add-on order');
    }

    const quantity = parseTopupQuantity(order.cadence);
    if (quantity !== 1) {
      throw new AppError(400, 'AI add-on orders must contain one fixed pack', 'FIXED_TOPUP_SKU');
    }

    const flexUnits = parseFlexTopupUnits(order.cadence);
    const grantSku =
      flexUnits != null
        ? {
            ...sku,
            units: flexUnits,
            pricePaise: Math.round(order.amountPaise / 1.18),
          }
        : sku;

    const existingPayment = await tx.paymentOrder.findFirst({
      where: { paymentId: params.paymentId },
      select: { id: true },
    });
    if (existingPayment && existingPayment.id !== order.id) {
      throw new AppError(409, 'Payment is already linked to another order', 'DUPLICATE_PAYMENT');
    }

    const grant = await grantTopUpInTransaction(
      {
        organizationId: order.organizationId,
        sku: grantSku,
        quantity,
        paymentOrderId: order.id,
        razorpayPaymentId: params.paymentId,
      },
      tx
    );

    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'CAPTURED',
        paymentId: params.paymentId,
        amountSnapshotPaise: order.amountPaise,
        currencySnapshot: order.currency,
        providerOrderStatus: params.providerOrderStatus,
        providerPaymentStatus: 'captured',
        verificationAt: new Date(),
        capturedAt: new Date(),
        paidAt: new Date(),
      },
    });
    await tx.billingEvent.create({
      data: {
        organizationId: order.organizationId,
        paymentOrderId: order.id,
        providerEventId: `payment:${params.paymentId}`,
        eventType: 'payment.captured',
        status: 'COMPLETED',
        processedAt: new Date(),
        redactedMetadata: {
          source: 'payment-reconciliation',
          paymentId: params.paymentId,
          purchaseType: 'ai_topup',
        },
      },
    });

    return {
      organizationId: order.organizationId,
      plan: org.plan,
      planExpiresAt: org.planExpiresAt,
      alreadyCaptured: false,
      creditsGranted: grant.creditsGranted,
    };
  });
}

export async function fulfillCapturedPayment(params: {
  paymentOrderId: string;
  paymentId: string;
  providerPayment?: {
    orderId: string;
    paymentId: string;
    amountPaise: number;
    currency: string;
    status: string;
    orderStatus?: string;
  };
}): Promise<{
  organizationId: string;
  plan: string;
  planExpiresAt: Date | null;
  alreadyCaptured: boolean;
  creditsGranted?: number;
}> {
  if (
    !params.providerPayment ||
    params.providerPayment.paymentId !== params.paymentId ||
    params.providerPayment.status !== 'captured'
  ) {
    throw new AppError(
      202,
      'Payment verification is pending provider confirmation',
      'VERIFICATION_PENDING'
    );
  }
  const providerPayment = params.providerPayment;

  const order = await prisma.paymentOrder.findUnique({ where: { id: params.paymentOrderId } });
  if (!order) throw new AppError(404, 'Payment order not found');
  if (
    providerPayment.orderId !== order.razorpayOrderId ||
    providerPayment.amountPaise !== order.amountPaise ||
    providerPayment.currency !== order.currency ||
    providerPayment.orderStatus !== 'paid'
  ) {
    throw new AppError(409, 'Payment amount, currency, or order does not match', 'PAYMENT_MISMATCH');
  }

  if (order.planId === AI_ADDON_PLAN_ID) {
    return fulfillAiAddonOrder({
      paymentOrderId: params.paymentOrderId,
      paymentId: params.paymentId,
      providerOrderStatus: providerPayment.orderStatus,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "payment_orders" WHERE id = ${params.paymentOrderId} FOR UPDATE
    `;
    const locked = await tx.paymentOrder.findUnique({ where: { id: params.paymentOrderId } });
    if (!locked) throw new AppError(404, 'Payment order not found');

    const org = await tx.organization.findUnique({
      where: { id: locked.organizationId },
      select: { plan: true, planExpiresAt: true },
    });
    if (!org) throw new AppError(404, 'Organization not found');

    // Serialize plan transitions for an organization so two browser tabs
    // cannot both pass the active-plan check.
    await tx.$queryRaw`
      SELECT id FROM "organizations" WHERE id = ${locked.organizationId} FOR UPDATE
    `;

    if (locked.status === 'CAPTURED') {
      if (locked.paymentId && locked.paymentId !== params.paymentId) {
        throw new AppError(409, 'Payment order is already linked to another payment', 'DUPLICATE_PAYMENT');
      }
      const existingInvoice = await tx.invoice.findUnique({
        where: { paymentOrderId: locked.id },
      });
      if (!existingInvoice) {
        const capturedSku = resolveSkuForPaymentOrder(locked);
        if (capturedSku) {
          await issueInvoiceForCharge(tx, {
            organizationId: locked.organizationId,
            paymentOrderId: locked.id,
            providerPaymentId: params.paymentId,
            sku: capturedSku,
            totalPaise: locked.amountPaise,
          });
        }
      }
      return {
        organizationId: locked.organizationId,
        plan: org.plan,
        planExpiresAt: org.planExpiresAt,
        alreadyCaptured: true,
      };
    }
    if (['FAILED', 'REVERSED', 'REFUNDED'].includes(locked.status)) {
      throw new AppError(409, 'Payment order is already in a terminal state', 'PAYMENT_ORDER_TERMINAL');
    }

    const sku = resolveSkuForPaymentOrder(locked);
    if (!sku || sku.pricePaise <= 0 || locked.planId === AI_ADDON_PLAN_ID) {
      throw new AppError(400, 'Invalid plan payment order');
    }

    const duplicatePayment = await tx.paymentOrder.findFirst({
      where: { paymentId: params.paymentId },
      select: { id: true },
    });
    if (duplicatePayment && duplicatePayment.id !== locked.id) {
      throw new AppError(409, 'Payment is already linked to another order', 'DUPLICATE_PAYMENT');
    }

    const now = new Date();
    const currentPeriod = await tx.planPeriod.findFirst({
      where: {
        organizationId: locked.organizationId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: { startsAt: 'desc' },
    });
    const cachedTier = legacyPlanToTier(org.plan);
    const currentTier = currentPeriod
      ? legacyPlanToTier(currentPeriod.planTier)
      : cachedTier;
    const cachedPeriodActive =
      !currentPeriod &&
      org.planExpiresAt !== null &&
      org.planExpiresAt > now &&
      currentTier !== 'launch';
    const requestedTier = legacyPlanToTier(locked.planId);

    if (
      (currentPeriod || cachedPeriodActive) &&
      TIER_ORDER[requestedTier] < TIER_ORDER[currentTier]
    ) {
      throw new AppError(
        409,
        'A lower plan cannot be purchased while the current paid period is active',
        'PLAN_DOWNGRADE_NOT_ALLOWED_ACTIVE'
      );
    }

    if (currentPeriod) {
      await tx.planPeriod.update({
        where: { id: currentPeriod.id },
        data: { status: 'SUPERSEDED', supersededAt: now },
      });
    }

    const baseDate = (currentPeriod && currentPeriod.endsAt > now) ? currentPeriod.endsAt : now;
    const endsAt = new Date(baseDate.getTime() + sku.periodDays * 24 * 60 * 60 * 1000);

    await tx.paymentOrder.update({
      where: { id: locked.id },
      data: {
        status: 'CAPTURED',
        paymentId: params.paymentId,
        amountSnapshotPaise: locked.amountPaise,
        currencySnapshot: locked.currency,
        providerOrderStatus: providerPayment.orderStatus,
        providerPaymentStatus: 'captured',
        verificationAt: now,
        capturedAt: now,
        paidAt: now,
      },
    });

    const period = await tx.planPeriod.create({
      data: {
        organizationId: locked.organizationId,
        planTier: requestedTier,
        skuId: locked.skuId || sku.id,
        cadence: locked.cadence || sku.cadence,
        startsAt: now,
        endsAt,
        status: 'ACTIVE',
        sourcePaymentOrderId: locked.id,
        amountPaise: locked.amountPaise,
        currency: locked.currency,
        taxAmountPaise: Math.max(0, locked.amountPaise - sku.pricePaise),
        supersedesId: currentPeriod?.id ?? null,
      },
    });
    await issueInvoiceForCharge(tx, {
      organizationId: locked.organizationId,
      paymentOrderId: locked.id,
      providerPaymentId: params.paymentId,
      sku,
      totalPaise: locked.amountPaise,
    });

    const updatedOrg = await tx.organization.update({
      where: { id: locked.organizationId },
      data: {
        plan: requestedTier,
        planExpiresAt: period.endsAt,
        subscriptionStatus: 'active',
      },
    });

    await tx.billingEvent.create({
      data: {
        organizationId: locked.organizationId,
        paymentOrderId: locked.id,
        providerEventId: `payment:${params.paymentId}`,
        eventType: 'payment.captured',
        status: 'COMPLETED',
        processedAt: now,
        redactedMetadata: {
          source: 'payment-reconciliation',
          paymentId: params.paymentId,
          planTier: requestedTier,
        },
      },
    });

    return {
      organizationId: locked.organizationId,
      plan: updatedOrg.plan,
      planExpiresAt: updatedOrg.planExpiresAt,
      alreadyCaptured: false,
    };
  });

  return result;
}

export async function markPaymentOrderFailed(
  paymentOrderId: string,
  failure?: { code?: string; message?: string }
): Promise<void> {
  await prisma.paymentOrder.updateMany({
    where: { id: paymentOrderId, status: { in: ['CREATED', 'AUTHORIZED', 'VERIFICATION_PENDING'] } },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureCode: failure?.code,
      failureMessage: failure?.message,
      providerPaymentStatus: 'failed',
    },
  });
}

export async function markPaymentOrderProviderTerminal(
  paymentOrderId: string,
  status: 'REVERSED' | 'REFUNDED',
  failure?: { code?: string; message?: string }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "payment_orders" WHERE id = ${paymentOrderId} FOR UPDATE
    `;
    const order = await tx.paymentOrder.findUnique({ where: { id: paymentOrderId } });
    if (!order || ['FAILED', 'REVERSED', 'REFUNDED'].includes(order.status)) return;

    await tx.paymentOrder.update({
      where: { id: paymentOrderId },
      data: {
        status,
        failureCode: failure?.code,
        failureMessage: failure?.message,
        providerPaymentStatus: status.toLowerCase(),
      },
    });

    if (order.planId === AI_ADDON_PLAN_ID) return;

    // A refunded/reversed plan period cannot continue granting access. If a
    // later valid period exists, retain that period and its cached plan.
    const revokedPeriod = await tx.planPeriod.updateMany({
      where: { sourcePaymentOrderId: paymentOrderId, status: 'ACTIVE' },
      data: { status, supersededAt: new Date() },
    });
    if (revokedPeriod.count === 0) return;

    const now = new Date();
    const replacement = await tx.planPeriod.findFirst({
      where: {
        organizationId: order.organizationId,
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: { startsAt: 'desc' },
      select: { planTier: true, endsAt: true },
    });
    await tx.organization.update({
      where: { id: order.organizationId },
      data: replacement
        ? {
            plan: legacyPlanToTier(replacement.planTier),
            planExpiresAt: replacement.endsAt,
            subscriptionStatus: 'active',
          }
        : {
            subscriptionStatus: 'expired',
          },
    });
  });
}

export async function findReusablePendingOrder(
  organizationId: string,
  planId: string,
  skuId: string,
  maxAgeMs = 30 * 60 * 1000,
  checkoutIntentKey?: string,
  cadence?: string
) {
  const since = new Date(Date.now() - maxAgeMs);
  return prisma.paymentOrder.findFirst({
    where: {
      organizationId,
      planId,
      skuId,
      status: 'CREATED',
      createdAt: { gte: since },
      ...(checkoutIntentKey ? { checkoutIntentKey } : {}),
      ...(cadence ? { cadence } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function expireStaleCreatedOrders(
  organizationId: string,
  planId: string,
  maxAgeMs = 30 * 60 * 1000
) {
  const before = new Date(Date.now() - maxAgeMs);
  await prisma.paymentOrder.updateMany({
    where: {
      organizationId,
      planId,
      status: 'CREATED',
      createdAt: { lt: before },
    },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureCode: 'STALE_CHECKOUT',
      failureMessage: 'Checkout expired before payment confirmation',
    },
  });
}

export async function reconcileStalePaymentOrders(maxAgeMs = 30 * 60 * 1000) {
  const before = new Date(Date.now() - maxAgeMs);
  const orders = await prisma.paymentOrder.findMany({
    where: { status: { in: ['CREATED', 'AUTHORIZED'] }, createdAt: { lt: before } },
    take: 100,
  });
  for (const order of orders) {
    try {
      const payments = await fetchRazorpayOrderPayments(order.razorpayOrderId);
      const captured = payments.find((payment) => payment.status === 'captured');
      if (captured) {
        const verified = await verifyCapturedPayment({
          orderId: order.razorpayOrderId,
          paymentId: captured.id,
          amountPaise: order.amountPaise,
          currency: order.currency,
        });
        await fulfillCapturedPayment({
          paymentOrderId: order.id,
          paymentId: captured.id,
          providerPayment: {
            orderId: verified.order.id,
            paymentId: verified.payment.id,
            amountPaise: verified.payment.amount,
            currency: verified.payment.currency,
            status: verified.payment.status,
            orderStatus: verified.order.status,
          },
        });
        continue;
      }
      const failed = payments.find((payment) => payment.status === 'failed');
      if (failed) {
        await markPaymentOrderFailed(order.id, {
          code: failed.error_code || 'PAYMENT_FAILED',
          message: failed.error_description || 'Provider reported payment failure',
        });
      }
    } catch {
      // Keep pending on provider/network errors; the next pass retries safely.
    }
  }
}
