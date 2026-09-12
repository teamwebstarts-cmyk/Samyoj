import crypto from 'node:crypto';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { getSku, getSkusByTier, legacyPlanToTier, type BillingSkuDef, type PlanTier } from './plans';
import { getOrgEntitlements, TIER_ORDER } from './entitlements.service';
import {
  cancelRazorpaySubscription,
  createRazorpayPlan,
  createRazorpaySubscription,
  fetchRazorpayPayment,
  fetchRazorpaySubscription,
  pauseRazorpaySubscription,
  resumeRazorpaySubscription,
  updateRazorpaySubscription,
} from './razorpay.service';
import { issueCreditNote, issueInvoiceForCharge } from './invoice.service';
import { config } from '../../config';

const DAY_MS = 24 * 60 * 60 * 1000;

function periodEndFromUnix(seconds?: number | null): Date | null {
  return seconds && seconds > 0 ? new Date(seconds * 1000) : null;
}

function subscriptionPeriod(sku: BillingSkuDef, start = new Date()) {
  return {
    startsAt: start,
    endsAt: new Date(start.getTime() + sku.periodDays * DAY_MS),
  };
}

export function calculateUpgradeProration(params: {
  remainingDays: number;
  currentPeriodDays: number;
  currentAmountPaise: number;
  newPeriodDays: number;
  newAmountPaise: number;
}) {
  const remainingDays = Math.max(0, Math.floor(params.remainingDays));
  const unusedCredit = Math.floor(
    (remainingDays / Math.max(1, params.currentPeriodDays)) * params.currentAmountPaise
  );
  const newDebit = Math.floor(
    (remainingDays / Math.max(1, params.newPeriodDays)) * params.newAmountPaise
  );
  return { remainingDays, unusedCredit, newDebit, netPaise: Math.max(0, newDebit - unusedCredit) };
}

async function ensureRazorpayPlanForSku(sku: BillingSkuDef): Promise<string> {
  const amountPaise = sku.inclGstPaise;
  const cached = await prisma.razorpayPlanCache.findUnique({ where: { skuId: sku.id } });
  if (cached?.amountPaise === amountPaise) return cached.razorpayPlanId;
  const plan = await createRazorpayPlan({
    name: `Samyoj ${sku.name} ${sku.cadenceLabel}`,
    amountPaise,
    description: sku.invoiceLabel,
    period: sku.cadence === 'yearly' ? 'yearly' : 'monthly',
    interval: sku.cadence === 'quarterly' ? 3 : 1,
    notes: { skuId: sku.id, type: 'saas_subscription' },
  });
  await prisma.razorpayPlanCache.upsert({
    where: { skuId: sku.id },
    create: { skuId: sku.id, razorpayPlanId: plan.id, amountPaise },
    update: { razorpayPlanId: plan.id, amountPaise },
  });
  return plan.id;
}

export async function createSubscriptionCheckout(params: {
  organizationId: string;
  skuId: string;
  idempotencyKey?: string;
}) {
  const sku = getSku(params.skuId);
  if (!sku || sku.pricePaise <= 0 || sku.cadence === 'trial') {
    throw new AppError(400, 'Invalid paid subscription SKU', 'INVALID_SUBSCRIPTION_SKU');
  }
  const idempotencyKey = params.idempotencyKey?.trim() || crypto.randomUUID();
  const existingSession = await prisma.billingCheckoutSession.findUnique({
    where: { idempotencyKey },
    include: { billingSubscription: true },
  });
  if (existingSession) {
    return {
      sessionId: existingSession.id,
      subscriptionId: existingSession.billingSubscription?.razorpaySubscriptionId ?? null,
      planTier: existingSession.planTier,
      skuId: existingSession.skuId,
      cadence: existingSession.cadence,
      amountPaise: existingSession.amountPaise,
      currency: existingSession.currency,
      status: existingSession.status,
      keyId: config.razorpay.keyId,
    };
  }

  const entitlements = await getOrgEntitlements(params.organizationId);
  const current = await prisma.billingSubscription.findFirst({
    where: {
      organizationId: params.organizationId,
      status: { in: ['CREATED', 'AUTHENTICATED', 'ACTIVE', 'PAST_DUE', 'GRACE'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  const requestedTier = sku.planTier;
  if (
    current &&
    current.currentPeriodEnd &&
    current.currentPeriodEnd > new Date() &&
    TIER_ORDER[requestedTier] < TIER_ORDER[legacyPlanToTier(current.planTier)]
  ) {
    const updated = await prisma.billingSubscription.update({
      where: { id: current.id },
      data: {
        pendingSkuId: sku.id,
        pendingPlanTier: sku.planTier,
        pendingCadence: sku.cadence,
      },
    });
    return {
      sessionId: null,
      subscriptionId: updated.razorpaySubscriptionId,
      planTier: sku.planTier,
      skuId: sku.id,
      cadence: sku.cadence,
      amountPaise: sku.inclGstPaise,
      currency: 'INR',
      status: 'SCHEDULED',
      keyId: config.razorpay.keyId,
    };
  }
  if (
    current &&
    current.skuId === sku.id &&
    current.currentPeriodEnd &&
    current.currentPeriodEnd > new Date() &&
    !entitlements.isLocked
  ) {
    throw new AppError(409, 'This subscription is already active', 'SUBSCRIPTION_ALREADY_ACTIVE');
  }

  const planId = await ensureRazorpayPlanForSku(sku);
  const session = await prisma.billingCheckoutSession.create({
    data: {
      organizationId: params.organizationId,
      idempotencyKey,
      skuId: sku.id,
      planTier: sku.planTier,
      cadence: sku.cadence,
      amountPaise: sku.inclGstPaise,
    },
  });
  try {
    const remote = await createRazorpaySubscription({
      planId,
      notes: {
        organizationId: params.organizationId,
        checkoutSessionId: session.id,
        skuId: sku.id,
        type: 'saas_subscription',
      },
    });
    const subscription = await prisma.billingSubscription.create({
      data: {
        organizationId: params.organizationId,
        razorpaySubscriptionId: remote.id,
        razorpayPlanId: planId,
        skuId: sku.id,
        planTier: sku.planTier,
        cadence: sku.cadence,
        status: remote.status.toUpperCase(),
      },
    });
    await prisma.billingCheckoutSession.update({
      where: { id: session.id },
      data: { billingSubscriptionId: subscription.id },
    });
    return {
      sessionId: session.id,
      subscriptionId: remote.id,
      planTier: sku.planTier,
      skuId: sku.id,
      cadence: sku.cadence,
      amountPaise: sku.inclGstPaise,
      currency: 'INR',
      status: remote.status,
      shortUrl: remote.short_url,
      keyId: config.razorpay.keyId,
    };
  } catch (err) {
    await prisma.billingCheckoutSession.update({
      where: { id: session.id },
      data: { status: 'FAILED' },
    });
    throw err;
  }
}

export async function fulfillSubscriptionCharge(params: {
  subscriptionId: string;
  paymentId: string;
  amountPaise: number;
  providerEventId?: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}) {
  const subscription = await prisma.billingSubscription.findUnique({
    where: { razorpaySubscriptionId: params.subscriptionId },
  });
  if (!subscription) throw new AppError(404, 'Subscription not found', 'SUBSCRIPTION_NOT_FOUND');
  const sku = getSku(subscription.skuId);
  if (!sku) throw new AppError(500, 'Subscription SKU is no longer in the catalog', 'SKU_NOT_FOUND');
  if (params.amountPaise !== sku.inclGstPaise) {
    throw new AppError(409, 'Subscription amount does not match catalog', 'PAYMENT_MISMATCH');
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id FROM "billing_subscriptions"
      WHERE id = ${subscription.id}
      FOR UPDATE
    `;
    const duplicate = await tx.billingCharge.findUnique({
      where: { providerPaymentId: params.paymentId },
      include: { invoice: true },
    });
    if (duplicate) return { charge: duplicate, alreadyCaptured: true, invoice: duplicate.invoice };

    const current = await tx.billingSubscription.findUnique({ where: { id: subscription.id } });
    if (!current) throw new AppError(404, 'Subscription not found');
    const period = {
      startsAt: params.currentPeriodStart || current.currentPeriodEnd || new Date(),
      endsAt:
        params.currentPeriodEnd ||
        subscriptionPeriod(sku, params.currentPeriodStart || current.currentPeriodEnd || new Date()).endsAt,
    };
    const charge = await tx.billingCharge.create({
      data: {
        organizationId: current.organizationId,
        billingSubscriptionId: current.id,
        providerPaymentId: params.paymentId,
        providerEventId: params.providerEventId,
        amountPaise: params.amountPaise,
        periodStart: period.startsAt,
        periodEnd: period.endsAt,
        capturedAt: new Date(),
      },
    });
    const activePeriod = await tx.planPeriod.findFirst({
      where: {
        organizationId: current.organizationId,
        status: 'ACTIVE',
        endsAt: { gt: new Date() },
      },
      orderBy: { startsAt: 'desc' },
    });
    if (activePeriod) {
      await tx.planPeriod.update({
        where: { id: activePeriod.id },
        data: { status: 'SUPERSEDED', supersededAt: new Date() },
      });
    }
    await tx.planPeriod.create({
      data: {
        organizationId: current.organizationId,
        planTier: sku.planTier,
        skuId: sku.id,
        cadence: sku.cadence,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        status: 'ACTIVE',
        amountPaise: params.amountPaise,
        currency: 'INR',
        taxAmountPaise: params.amountPaise - sku.pricePaise,
      },
    });
    const invoice = await issueInvoiceForCharge(tx, {
      organizationId: current.organizationId,
      chargeId: charge.id,
      providerPaymentId: params.paymentId,
      sku,
      totalPaise: params.amountPaise,
    });
    await tx.billingSubscription.update({
      where: { id: current.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: period.startsAt,
        currentPeriodEnd: period.endsAt,
        pastDueAt: null,
        graceEndsAt: null,
      },
    });
    await tx.organization.update({
      where: { id: current.organizationId },
      data: {
        plan: sku.planTier,
        planExpiresAt: period.endsAt,
        subscriptionStatus: 'active',
      },
    });
    await tx.billingCheckoutSession.updateMany({
      where: { billingSubscriptionId: current.id, status: { in: ['CREATED', 'AUTHENTICATED'] } },
      data: {
        status: 'COMPLETED',
        providerPaymentId: params.paymentId,
        completedAt: new Date(),
        signatureVerifiedAt: new Date(),
      },
    });
    return { charge, alreadyCaptured: false, invoice };
  });
  if (!result.alreadyCaptured) {
    await retireSupersededSubscription(subscription.id, subscription.organizationId);
  }
  return result;
}

async function retireSupersededSubscription(currentId: string, organizationId: string) {
  const prior = await prisma.billingSubscription.findFirst({
    where: {
      organizationId,
      id: { not: currentId },
      status: 'ACTIVE',
      currentPeriodEnd: { gt: new Date() },
    },
    orderBy: { currentPeriodEnd: 'desc' },
  });
  if (!prior) return;
  const priorSku = getSku(prior.skuId);
  if (!priorSku) return;
  try {
    await cancelRazorpaySubscription(prior.razorpaySubscriptionId, false);
    await prisma.billingSubscription.update({
      where: { id: prior.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const oldInvoice = await prisma.invoice.findFirst({
      where: {
        billingCharge: { billingSubscriptionId: prior.id },
      },
      orderBy: { issuedAt: 'desc' },
    });
    if (oldInvoice) {
      const remainingDays = Math.max(
        0,
        Math.ceil((prior.currentPeriodEnd!.getTime() - Date.now()) / DAY_MS)
      );
      const credit = calculateUpgradeProration({
        remainingDays,
        currentPeriodDays: priorSku.periodDays,
        currentAmountPaise: priorSku.pricePaise,
        newPeriodDays: priorSku.periodDays,
        newAmountPaise: priorSku.pricePaise,
      }).unusedCredit;
      if (credit > 0) {
        await issueCreditNote({
          organizationId,
          invoiceId: oldInvoice.id,
          amountPaise: Math.min(oldInvoice.totalPaise, Math.round(credit * 1.18)),
          reason: 'Unused prepaid period credited after plan upgrade',
        });
      }
    }
  } catch {
    // The new paid subscription remains active; reconciliation retries old cancellation.
  }
}

export async function verifySubscriptionCheckout(params: {
  organizationId: string;
  sessionId: string;
  subscriptionId: string;
  paymentId: string;
}) {
  const session = await prisma.billingCheckoutSession.findFirst({
    where: {
      id: params.sessionId,
      organizationId: params.organizationId,
      billingSubscription: { razorpaySubscriptionId: params.subscriptionId },
    },
    include: { billingSubscription: true },
  });
  if (!session?.billingSubscription) throw new AppError(404, 'Subscription checkout not found');
  const [remoteSubscription, payment] = await Promise.all([
    fetchRazorpaySubscription(params.subscriptionId),
    fetchRazorpayPayment(params.paymentId),
  ]);
  if (
    payment.id !== params.paymentId ||
    (payment.subscription_id && payment.subscription_id !== params.subscriptionId) ||
    payment.amount !== session.amountPaise ||
    payment.currency !== session.currency ||
    payment.status !== 'captured'
  ) {
    throw new AppError(409, 'Subscription payment does not match checkout', 'PAYMENT_MISMATCH');
  }
  await prisma.billingCheckoutSession.update({
    where: { id: session.id },
    data: { status: 'AUTHENTICATED', providerPaymentId: payment.id, signatureVerifiedAt: new Date() },
  });
  return fulfillSubscriptionCharge({
    subscriptionId: params.subscriptionId,
    paymentId: params.paymentId,
    amountPaise: payment.amount,
    currentPeriodStart: periodEndFromUnix(remoteSubscription.current_start),
    currentPeriodEnd: periodEndFromUnix(remoteSubscription.current_end),
  });
}

export function mapSubscriptionEventStatus(event: string): string | null {
  if (event === 'subscription.halted') return 'HALTED';
  if (event === 'subscription.pending') return 'PAST_DUE';
  if (event === 'subscription.paused') return 'PAUSED';
  if (event === 'subscription.cancelled') return 'CANCELLED';
  if (event === 'subscription.completed') return 'COMPLETED';
  if (
    event === 'subscription.resumed' ||
    event === 'subscription.activated' ||
    event === 'subscription.authenticated'
  ) {
    return 'ACTIVE';
  }
  return null;
}

export async function handleSubscriptionWebhook(event: {
  event: string;
  payload?: {
    subscription?: {
      entity?: {
        id?: string;
        status?: string;
        plan_id?: string;
        current_start?: number;
        current_end?: number;
        notes?: Record<string, string>;
      };
    };
    payment?: { entity?: { id?: string; amount?: number; currency?: string; status?: string } };
  };
}) {
  const remote = event.payload?.subscription?.entity;
  if (!remote?.id) return;
  let subscription = await prisma.billingSubscription.findUnique({
    where: { razorpaySubscriptionId: remote.id },
  });
  if (!subscription && remote.notes?.organizationId && remote.notes.skuId) {
    const sku = getSku(remote.notes.skuId);
    if (!sku) return;
    subscription = await prisma.billingSubscription.create({
      data: {
        organizationId: remote.notes.organizationId,
        razorpaySubscriptionId: remote.id,
        razorpayPlanId: remote.plan_id || 'unknown',
        skuId: sku.id,
        planTier: sku.planTier,
        cadence: sku.cadence,
        status: (remote.status || 'CREATED').toUpperCase(),
      },
    });
  }
  if (!subscription) return;

  const payment = event.payload?.payment?.entity;
  if (event.event === 'subscription.charged' && payment?.id) {
    const providerPayment = await fetchRazorpayPayment(payment.id);
    await fulfillSubscriptionCharge({
      subscriptionId: remote.id,
      paymentId: payment.id,
      amountPaise: providerPayment.amount,
      providerEventId: `${event.event}:${payment.id}`,
      currentPeriodStart: periodEndFromUnix(remote.current_start),
      currentPeriodEnd: periodEndFromUnix(remote.current_end),
    });
    return;
  }

  const mappedStatus = mapSubscriptionEventStatus(event.event);
  if (!mappedStatus) return;
  const graceEndsAt =
    mappedStatus === 'PAST_DUE'
      ? new Date(Date.now() + config.billing.graceDays * DAY_MS)
      : null;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.billingSubscription.update({
      where: { id: subscription!.id },
      data: {
        status: mappedStatus,
        currentPeriodStart: periodEndFromUnix(remote.current_start) ?? undefined,
        currentPeriodEnd: periodEndFromUnix(remote.current_end) ?? undefined,
        pastDueAt: mappedStatus === 'PAST_DUE' ? new Date() : null,
        graceEndsAt,
        cancelledAt: mappedStatus === 'CANCELLED' || mappedStatus === 'COMPLETED' ? new Date() : null,
      },
    });
    const orgStatus =
      mappedStatus === 'PAST_DUE'
        ? 'past_due'
        : mappedStatus === 'HALTED'
          ? 'locked'
          : mappedStatus === 'PAUSED'
            ? 'locked'
            : mappedStatus === 'CANCELLED' || mappedStatus === 'COMPLETED'
              ? 'cancelled'
              : 'active';
    await tx.organization.update({
      where: { id: updated.organizationId },
      data: { subscriptionStatus: orgStatus },
    });
  });
}

export async function cancelSubscriptionAtPeriodEnd(organizationId: string) {
  const row = await prisma.billingSubscription.findFirst({
    where: { organizationId, status: { in: ['CREATED', 'AUTHENTICATED', 'ACTIVE', 'PAST_DUE', 'GRACE'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new AppError(404, 'No active subscription found');
  await cancelRazorpaySubscription(row.razorpaySubscriptionId, true);
  return prisma.billingSubscription.update({
    where: { id: row.id },
    data: { cancelAtPeriodEnd: true },
  });
}

export async function pauseSubscription(organizationId: string) {
  const row = await prisma.billingSubscription.findFirst({
    where: { organizationId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new AppError(404, 'No active subscription found');
  await pauseRazorpaySubscription(row.razorpaySubscriptionId);
  await prisma.$transaction([
    prisma.billingSubscription.update({ where: { id: row.id }, data: { status: 'PAUSED' } }),
    prisma.organization.update({ where: { id: organizationId }, data: { subscriptionStatus: 'paused' } }),
  ]);
  return { status: 'PAUSED' };
}

export async function resumeSubscription(organizationId: string) {
  const row = await prisma.billingSubscription.findFirst({
    where: { organizationId, status: 'PAUSED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new AppError(404, 'No paused subscription found');
  await resumeRazorpaySubscription(row.razorpaySubscriptionId);
  await prisma.$transaction([
    prisma.billingSubscription.update({ where: { id: row.id }, data: { status: 'ACTIVE' } }),
    prisma.organization.update({ where: { id: organizationId }, data: { subscriptionStatus: 'active' } }),
  ]);
  return { status: 'ACTIVE' };
}

export async function getSubscriptionPaymentMethodHandoff(organizationId: string) {
  const row = await prisma.billingSubscription.findFirst({
    where: {
      organizationId,
      status: { in: ['ACTIVE', 'PAST_DUE', 'GRACE', 'PAUSED'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new AppError(404, 'No subscription found');
  const remote = await fetchRazorpaySubscription(row.razorpaySubscriptionId);
  if (!remote.short_url) {
    throw new AppError(
      409,
      'Razorpay did not provide a payment-method update link for this subscription',
      'PAYMENT_METHOD_HANDOFF_UNAVAILABLE'
    );
  }
  return { url: remote.short_url, expiresAt: row.currentPeriodEnd };
}

export async function reconcileBillingSubscriptions() {
  const rows = await prisma.billingSubscription.findMany({
    where: { status: { in: ['CREATED', 'AUTHENTICATED', 'ACTIVE', 'PAST_DUE', 'GRACE'] } },
    take: 100,
  });
  for (const row of rows) {
    try {
      const remote = await fetchRazorpaySubscription(row.razorpaySubscriptionId);
      if (row.pendingSkuId && row.currentPeriodEnd && row.currentPeriodEnd <= new Date()) {
        const pendingSku = getSku(row.pendingSkuId);
        if (pendingSku) {
          const pendingPlanId = await ensureRazorpayPlanForSku(pendingSku);
          await updateRazorpaySubscription(row.razorpaySubscriptionId, pendingPlanId);
          await prisma.billingSubscription.update({
            where: { id: row.id },
            data: {
              skuId: pendingSku.id,
              planTier: pendingSku.planTier,
              cadence: pendingSku.cadence,
              razorpayPlanId: pendingPlanId,
              pendingSkuId: null,
              pendingPlanTier: null,
              pendingCadence: null,
            },
          });
        }
      }
      if (remote.status && remote.status.toUpperCase() !== row.status) {
        await handleSubscriptionWebhook({
          event: `subscription.${remote.status}`,
          payload: { subscription: { entity: remote } },
        });
      }
    } catch {
      // Provider outages must not lock tenants; the next reconciliation retries.
    }
  }
}

export function subscriptionCadencesForTier(tier: PlanTier) {
  return getSkusByTier(tier).filter((sku) => sku.pricePaise > 0);
}
