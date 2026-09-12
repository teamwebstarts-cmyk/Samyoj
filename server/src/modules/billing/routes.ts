import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { getSeatLimit, type TeamSettings } from '../team/types';
import { BILLING_SKUS, PLAN_TIERS, legacyPlanToTier, getPlan } from './plans';
import type { PlanTier } from './plans';
import {
  createRazorpayOrder,
  fetchRazorpayOrder,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  isRazorpayConfigured,
  verifyCapturedPayment,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay.service';
import { config } from '../../config';
import logger from '../../utils/logger';
import { getOrgUsage, estimateCampaignCost } from './usage.service';
import paymentLinksRoutes from './payment-links.routes';
import {
  paymentAmountBreakdown,
  pricingByCadenceForTier,
  resolveSkuForPaymentOrder,
} from './catalog';
import { AI_ADDON_PLAN_ID } from './ai-credits/catalog';
import {
  expireStaleCreatedOrders,
  findReusablePendingOrder,
  fulfillCapturedPayment,
  markPaymentOrderFailed,
  markPaymentOrderProviderTerminal,
} from './fulfillment';
import { TIER_ORDER, getOrgEntitlements } from './entitlements.service';
import aiCreditsRoutes from './ai-credits/routes';

const router = Router();

router.use('/ai-credits', aiCreditsRoutes);
router.use(paymentLinksRoutes);

/** Client-facing plan shape built from PLAN_TIERS + SKU pricing catalog. */
function tierToClientPlan(tier: PlanTier) {
  const def = PLAN_TIERS[tier];
  const monthlySku = BILLING_SKUS.find((s) => s.planTier === tier && s.cadence === 'monthly');
  const pricing = pricingByCadenceForTier(tier);
  return {
    id: def.tier,
    name: def.name,
    pricePaise: monthlySku?.inclGstPaise ?? 0,
    priceLabel: monthlySku?.effectiveMonthlyLabel ?? 'Custom',
    seats: def.seats,
    waNumbers: def.waNumbers,
    contacts: def.contacts,
    publishedWorkflows: def.publishedWorkflows,
    aiIncluded: def.aiIncluded,
    callingIncluded: def.callingIncluded,
    chatCreditsIncluded: def.chatCreditsIncluded,
    callingMinutesIncluded: def.callingMinutesIncluded,
    features: def.features,
    isMostPopular: monthlySku?.isMostPopular,
    pricing,
  };
}

function orderExpiryDate(paidAt: Date, order: { planId: string; amountPaise: number; skuId?: string | null }) {
  const sku = resolveSkuForPaymentOrder(order);
  const periodDays = sku?.periodDays || 30;
  return new Date(paidAt.getTime() + periodDays * 24 * 60 * 60 * 1000);
}

function webhookEventId(rawBody: string, headerId?: string): string {
  return headerId?.trim() || `body:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
}

async function claimBillingEvent(params: {
  providerEventId: string;
  eventType: string;
  payloadHash: string;
}) {
  try {
    return await prisma.billingEvent.create({
      data: {
        providerEventId: params.providerEventId,
        eventType: params.eventType,
        status: 'PROCESSING',
        processingAt: new Date(),
        payloadHash: params.payloadHash,
      },
    });
  } catch (err) {
    if (!(err instanceof Error) || !('code' in err) || (err as { code?: string }).code !== 'P2002') {
      throw err;
    }
    const existing = await prisma.billingEvent.findUnique({
      where: { providerEventId: params.providerEventId },
    });
    if (!existing) throw err;
    if (existing.status === 'COMPLETED') return existing;
    if (existing.status === 'PROCESSING') {
      const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
      const reclaimed = await prisma.billingEvent.updateMany({
        where: {
          id: existing.id,
          status: 'PROCESSING',
          processingAt: { lt: staleBefore },
        },
        data: { processingAt: new Date() },
      });
      if (reclaimed.count !== 1) {
        throw new AppError(409, 'Billing event is already being processed', 'BILLING_EVENT_IN_PROGRESS');
      }
      return prisma.billingEvent.findUniqueOrThrow({ where: { id: existing.id } });
    }
    return prisma.billingEvent.update({
      where: { id: existing.id },
      data: {
        status: 'PROCESSING',
        processingAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
    });
  }
}

function paymentEvidence(
  order: Awaited<ReturnType<typeof fetchRazorpayOrder>>,
  payment: Awaited<ReturnType<typeof fetchRazorpayPayment>>
) {
  return {
    orderId: order.id,
    paymentId: payment.id,
    amountPaise: payment.amount,
    currency: payment.currency,
    status: payment.status,
    orderStatus: order.status,
  };
}

router.get(
  '/',
  authenticate,
  requireOrg,
  loadPermissions,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;

    const [org, memberCount, recentPayments, periods] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.organizationUser.count({ where: { organizationId: orgId } }),
      prisma.paymentOrder.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.planPeriod.findMany({
        where: { organizationId: orgId },
        orderBy: { startsAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!org) throw new AppError(404, 'Organization not found');

    const entitlements = await getOrgEntitlements(orgId);
    const teamSettings = (org.settings as { team?: TeamSettings } | null)?.team;
    const seatLimit = entitlements.quotas.seats.limit === 'custom'
      ? getSeatLimit(entitlements.planTier, teamSettings)
      : entitlements.quotas.seats.limit;
    const planTier = entitlements.planTier;
    const currentPlan = tierToClientPlan(planTier);

    const lastPaid = recentPayments.find((payment) => payment.status === 'CAPTURED');
    const lastSku = lastPaid ? resolveSkuForPaymentOrder(lastPaid) : undefined;

    const now = new Date();
    const activePayment = recentPayments.find(
      (p) =>
        p.planId !== AI_ADDON_PLAN_ID &&
        Boolean(p.paidAt && orderExpiryDate(p.paidAt, p) > now)
    );
    const activePaidPlan = entitlements.isLocked ? null : planTier;
    const activePaidSku = activePayment ? resolveSkuForPaymentOrder(activePayment) : undefined;
    const activePaidExpiresAt = entitlements.isLocked
      ? null
      : entitlements.planExpiresAt?.toISOString() ?? null;

    sendSuccess(res, {
      plan: planTier,
      planTier,
      currentPlan,
      plans: (Object.keys(PLAN_TIERS) as PlanTier[]).map(tierToClientPlan),
      seatsUsed: memberCount,
      seatLimit,
      canManageBilling: req.permissions?.manageBilling ?? false,
      razorpayConfigured: isRazorpayConfigured(),
      razorpayKeyId: isRazorpayConfigured() ? config.razorpay.keyId : null,
      planExpiresAt: entitlements.planExpiresAt,
      subscriptionStatus: org.subscriptionStatus,
      cadence:
        org.subscriptionStatus === 'trial'
          ? 'trial'
          : (periods[0]?.cadence ?? activePaidSku?.cadence ?? lastSku?.cadence ?? null),
      trialEndsAt: org.subscriptionStatus === 'trial' ? entitlements.planExpiresAt : null,
      currentPeriodEnd: entitlements.planExpiresAt,
      activePaidPlan,
      activePaidExpiresAt,
      isLocked: entitlements.isLocked,
      entitlements,
      planPeriods: periods.map((period) => ({
        id: period.id,
        planTier: period.planTier,
        skuId: period.skuId,
        cadence: period.cadence,
        startsAt: period.startsAt,
        endsAt: period.endsAt,
        status: period.status,
        amountPaise: period.amountPaise,
        currency: period.currency,
      })),
      recentPayments: recentPayments.map((p) => {
        const sku = resolveSkuForPaymentOrder(p);
        const breakdown = paymentAmountBreakdown(p.amountPaise, sku);
        return {
          planId: p.planId,
          orderId: p.razorpayOrderId,
          status: p.status,
          cadence: p.cadence ?? sku?.cadence ?? null,
          paidAt: p.paidAt,
          totalAmountPaise: breakdown.totalAmountPaise,
          exclGstPaise: breakdown.exclGstPaise,
          gstAmountPaise: breakdown.gstAmountPaise,
        };
      }),
    });
  })
);

router.get(
  '/usage',
  authenticate,
  requireOrg,
  loadPermissions,
  asyncHandler(async (req: Request, res: Response) => {
    const usage = await getOrgUsage(req.user!.organizationId!);
    sendSuccess(res, usage);
  })
);

router.post(
  '/estimate',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { recipientCount, category } = z
      .object({
        recipientCount: z.number().int().positive(),
        category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).default('MARKETING'),
      })
      .parse(req.body);
    sendSuccess(res, estimateCampaignCost(recipientCount, category));
  })
);

router.post(
  '/create-order',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!isRazorpayConfigured()) {
      throw new AppError(503, 'Payment gateway is not configured');
    }

    const { planId, cadence, checkoutIntentKey } = z
      .object({
        planId: z.enum(['starter', 'growth', 'pro']),
        cadence: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
        checkoutIntentKey: z.string().trim().min(8).max(120).optional(),
      })
      .parse(req.body);
    const orgId = req.user!.organizationId!;

    const sku = BILLING_SKUS.find((s) => s.planTier === planId && s.cadence === cadence);
    if (!sku || sku.pricePaise <= 0) {
      throw new AppError(400, 'Invalid plan for payment');
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError(404, 'Organization not found');

    const entitlements = await getOrgEntitlements(orgId);
    const requestedTier = legacyPlanToTier(planId);
    const currentTier = entitlements.planTier;
    const currentPaidActive =
      !entitlements.isLocked &&
      entitlements.planExpiresAt !== null &&
      entitlements.planExpiresAt > new Date() &&
      currentTier !== 'launch';


    if (currentPaidActive && TIER_ORDER[requestedTier] < TIER_ORDER[currentTier]) {
      throw new AppError(
        409,
        'A lower plan cannot be purchased while the current paid period is active',
        'PLAN_DOWNGRADE_NOT_ALLOWED_ACTIVE'
      );
    }

    const intentKey =
      checkoutIntentKey ||
      (typeof req.header('Idempotency-Key') === 'string'
        ? req.header('Idempotency-Key')!.trim()
        : undefined);
    const reusable = await findReusablePendingOrder(
      orgId,
      planId,
      sku.id,
      30 * 60 * 1000,
      intentKey
    );
    if (reusable) {
      return sendSuccess(res, {
        orderId: reusable.razorpayOrderId,
        amount: reusable.amountPaise,
        currency: reusable.currency,
        keyId: config.razorpay.keyId,
        planName: sku.name,
        skuId: sku.id,
        cadence: sku.cadence,
        amountLabel: sku.effectiveMonthlyLabel,
        reusedPendingOrder: true,
        checkoutIntentKey: reusable.checkoutIntentKey,
      });
    }

    await expireStaleCreatedOrders(orgId, planId);

    const chargePaise = sku.inclGstPaise;
    const receipt = `plan_${sku.id}_${orgId.slice(0, 8)}_${Date.now()}`;
    const order = await createRazorpayOrder({
      amountPaise: chargePaise,
      receipt,
      notes: { organizationId: orgId, planId, skuId: sku.id, companyName: org.companyName },
    });

    try {
      await prisma.paymentOrder.create({
        data: {
          organizationId: orgId,
          razorpayOrderId: order.id,
          planId,
          skuId: sku.id,
          cadence: sku.cadence,
          amountPaise: chargePaise,
          currency: order.currency,
          status: 'CREATED',
          amountSnapshotPaise: order.amount,
          currencySnapshot: order.currency,
          checkoutIntentKey: intentKey,
        },
      });
    } catch (err) {
      if (intentKey && (err as { code?: string })?.code === 'P2002') {
        const raceWinner = await findReusablePendingOrder(
          orgId,
          planId,
          sku.id,
          30 * 60 * 1000,
          intentKey
        );
        if (raceWinner) {
          return sendSuccess(res, {
            orderId: raceWinner.razorpayOrderId,
            amount: raceWinner.amountPaise,
            currency: raceWinner.currency,
            keyId: config.razorpay.keyId,
            planName: sku.name,
            skuId: sku.id,
            cadence: sku.cadence,
            amountLabel: sku.effectiveMonthlyLabel,
            reusedPendingOrder: true,
            checkoutIntentKey: raceWinner.checkoutIntentKey,
          });
        }
      }
      throw err;
    }

    const { emitProductEvent } = await import('../platform/events');
    emitProductEvent({
      organizationId: orgId,
      name: 'CHECKOUT_START',
    });

    sendSuccess(res, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
      planName: sku.name,
      skuId: sku.id,
      cadence: sku.cadence,
      amountLabel: sku.effectiveMonthlyLabel,
      inclGstPaise: chargePaise,
      exclGstPaise: sku.pricePaise,
      gstPaise: sku.inclGstPaise - sku.pricePaise,
      checkoutIntentKey: intentKey,
    });
  })
);

router.post(
  '/verify',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
      })
      .parse(req.body);

    const orgId = req.user!.organizationId!;

    if (
      !verifyPaymentSignature(
        data.razorpay_order_id,
        data.razorpay_payment_id,
        data.razorpay_signature
      )
    ) {
      throw new AppError(400, 'Invalid payment signature');
    }

    const paymentOrder = await prisma.paymentOrder.findFirst({
      where: { razorpayOrderId: data.razorpay_order_id, organizationId: orgId },
    });
    if (!paymentOrder) throw new AppError(404, 'Payment order not found');

    const verifyEvent = await claimBillingEvent({
      providerEventId: `verify:${paymentOrder.id}:${data.razorpay_payment_id}`,
      eventType: 'verify',
      payloadHash: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    });
    if (verifyEvent.status === 'COMPLETED') {
      const paidPeriod = await prisma.planPeriod.findFirst({
        where: { sourcePaymentOrderId: paymentOrder.id },
        select: { endsAt: true },
      });
      return sendSuccess(res, {
        plan: paymentOrder.planId,
        planExpiresAt: paidPeriod?.endsAt ?? null,
        status: paymentOrder.status,
        alreadyCaptured: true,
        message: 'Payment already reconciled.',
      });
    }

    let result: Awaited<ReturnType<typeof fulfillCapturedPayment>>;
    try {
      const provider = await verifyCapturedPayment({
        orderId: paymentOrder.razorpayOrderId,
        paymentId: data.razorpay_payment_id,
        amountPaise: paymentOrder.amountPaise,
        currency: paymentOrder.currency,
      });
      result = await fulfillCapturedPayment({
        paymentOrderId: paymentOrder.id,
        paymentId: data.razorpay_payment_id,
        providerPayment: paymentEvidence(provider.order, provider.payment),
      });
      await prisma.billingEvent.update({
        where: { id: verifyEvent.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          paymentOrderId: paymentOrder.id,
          organizationId: orgId,
        },
      });
    } catch (err) {
      const code = err instanceof AppError ? err.code : undefined;
      if (code === 'PAYMENT_FAILED') {
        await markPaymentOrderFailed(paymentOrder.id, {
          code,
          message: err instanceof Error ? err.message : 'Provider reported payment failure',
        });
        await prisma.billingEvent.update({
          where: { id: verifyEvent.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            failureCode: code,
            failureMessage: err instanceof Error ? err.message : 'Provider reported payment failure',
            paymentOrderId: paymentOrder.id,
            organizationId: orgId,
          },
        });
        return sendSuccess(res, {
          plan: paymentOrder.planId,
          planExpiresAt: null,
          status: 'FAILED',
          alreadyCaptured: false,
          message: 'Payment failed at the provider.',
        });
      }
      if (code === 'PAYMENT_REFUNDED' || code === 'PAYMENT_REVERSED') {
        const terminalStatus = code === 'PAYMENT_REFUNDED' ? 'REFUNDED' : 'REVERSED';
        await markPaymentOrderProviderTerminal(paymentOrder.id, terminalStatus, {
          code,
          message: err instanceof Error ? err.message : 'Provider reported a terminal payment state',
        });
        await prisma.billingEvent.update({
          where: { id: verifyEvent.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            failureCode: code,
            failureMessage: err instanceof Error ? err.message : 'Provider reported a terminal payment state',
            paymentOrderId: paymentOrder.id,
            organizationId: orgId,
          },
        });
        return sendSuccess(res, {
          plan: paymentOrder.planId,
          planExpiresAt: null,
          status: terminalStatus,
          alreadyCaptured: false,
          message: `Payment ${terminalStatus.toLowerCase()} by the provider.`,
        });
      }
      // Pending provider confirmation must be retryable. Leaving this row in
      // PROCESSING would make the next identical browser callback look like a
      // duplicate in-flight event forever.
      await prisma.billingEvent.update({
        where: { id: verifyEvent.id },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
          failureCode: code,
          failureMessage: err instanceof Error ? err.message : 'Payment reconciliation failed',
          paymentOrderId: paymentOrder.id,
          organizationId: orgId,
        },
      });
      throw err;
    }

    if (!result.alreadyCaptured) {
      const { emitProductEvent } = await import('../platform/events');
      emitProductEvent({
        organizationId: orgId,
        name: 'PAYMENT_OK',
      });
    }

    sendSuccess(res, {
      plan: result.plan,
      planExpiresAt: result.planExpiresAt,
      status: 'CAPTURED',
      alreadyCaptured: result.alreadyCaptured,
      message: result.alreadyCaptured
        ? 'Plan already active.'
        : 'Payment successful. Plan upgraded.',
    });
  })
);

router.get(
  '/order/:orderId/status',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const order = await prisma.paymentOrder.findFirst({
      where: { id: req.params.orderId as string, organizationId: orgId },
    });
    if (!order) throw new AppError(404, 'Payment order not found');

    if (order.status === 'CAPTURED' || order.status === 'FAILED') {
      const paidPeriod = order.status === 'CAPTURED'
        ? await prisma.planPeriod.findFirst({
            where: { sourcePaymentOrderId: order.id },
            select: { endsAt: true },
          })
        : null;
      return sendSuccess(res, {
        orderId: order.razorpayOrderId,
        status: order.status,
        verificationPending: false,
        paymentId: order.paymentId,
        planId: order.planId,
        planExpiresAt:
          paidPeriod?.endsAt ??
          (order.planId === AI_ADDON_PLAN_ID && !paidPeriod
            ? null
            : order.paidAt
              ? orderExpiryDate(order.paidAt, order)
              : null),
      });
    }

    // A status poll is allowed to reconcile a browser timeout. Network/API
    // errors remain pending; an explicit provider failure is terminal.
    try {
      const [providerOrder, providerPayments] = await Promise.all([
        fetchRazorpayOrder(order.razorpayOrderId),
        fetchRazorpayOrderPayments(order.razorpayOrderId),
      ]);
      const providerPayment = providerPayments.find((payment) => payment.status === 'captured');
      if (providerPayment) {
        const verified = await verifyCapturedPayment({
          orderId: order.razorpayOrderId,
          paymentId: providerPayment.id,
          amountPaise: order.amountPaise,
          currency: order.currency,
        });
        const result = await fulfillCapturedPayment({
          paymentOrderId: order.id,
          paymentId: providerPayment.id,
          providerPayment: paymentEvidence(verified.order, verified.payment),
        });
        return sendSuccess(res, {
          orderId: order.razorpayOrderId,
          status: 'CAPTURED',
          verificationPending: false,
          paymentId: providerPayment.id,
          planId: result.plan,
          planExpiresAt: result.planExpiresAt,
          alreadyCaptured: result.alreadyCaptured,
        });
      }

      const terminalPayment = providerPayments.find(
        (payment) => payment.status === 'refunded' || payment.status === 'reversed'
      );
      if (terminalPayment) {
        if (
          terminalPayment.order_id !== order.razorpayOrderId ||
          terminalPayment.amount !== order.amountPaise ||
          terminalPayment.currency !== order.currency
        ) {
          throw new AppError(409, 'Payment amount, currency, or order does not match', 'PAYMENT_MISMATCH');
        }
        const terminalStatus = terminalPayment.status === 'refunded' ? 'REFUNDED' : 'REVERSED';
        await markPaymentOrderProviderTerminal(order.id, terminalStatus, {
          code: terminalStatus === 'REFUNDED' ? 'PAYMENT_REFUNDED' : 'PAYMENT_REVERSED',
          message: `Provider reported payment ${terminalPayment.status}`,
        });
        return sendSuccess(res, {
          orderId: order.razorpayOrderId,
          status: terminalStatus,
          verificationPending: false,
          paymentId: terminalPayment.id,
          planId: order.planId,
        });
      }

      const failedPayment = providerPayments.find((payment) => payment.status === 'failed');
      if (failedPayment) {
        if (
          failedPayment.order_id !== order.razorpayOrderId ||
          failedPayment.amount !== order.amountPaise ||
          failedPayment.currency !== order.currency
        ) {
          throw new AppError(409, 'Payment amount, currency, or order does not match', 'PAYMENT_MISMATCH');
        }
        await markPaymentOrderFailed(order.id, {
          code: failedPayment.error_code || 'PAYMENT_FAILED',
          message: failedPayment.error_description || 'Provider reported payment failure',
        });
        return sendSuccess(res, {
          orderId: order.razorpayOrderId,
          status: 'FAILED',
          verificationPending: false,
          paymentId: failedPayment.id,
          planId: order.planId,
        });
      }

      const authorized = providerPayments.find((payment) => payment.status === 'authorized');
      if (authorized && order.status === 'CREATED') {
        await prisma.paymentOrder.updateMany({
          where: { id: order.id, status: 'CREATED' },
          data: {
            status: 'AUTHORIZED',
            paymentId: authorized.id,
            verificationAt: new Date(),
            providerOrderStatus: providerOrder.status,
            providerPaymentStatus: authorized.status,
          },
        });
      }
    } catch (err) {
      if (err instanceof AppError && err.code === 'PAYMENT_MISMATCH') {
        throw err;
      }
      logger.warn('Payment status provider poll pending', {
        organizationId: orgId,
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const latest = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
    return sendSuccess(res, {
      orderId: order.razorpayOrderId,
      status: latest?.status || order.status,
      verificationPending: true,
      paymentId: latest?.paymentId || order.paymentId,
      planId: order.planId,
    });
  })
);

router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      throw new AppError(400, 'Invalid webhook signature');
    }

    let event: {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            order_id?: string;
            id?: string;
            amount?: number;
            currency?: string;
            status?: string;
            error_code?: string;
            error_description?: string;
          };
        };
        subscription?: {
          entity?: {
            id?: string;
            status?: string;
            current_end?: number;
            notes?: Record<string, string>;
          };
        };
      };
    };
    try {
      event =
        typeof req.body === 'object' && req.body !== null && 'event' in req.body
          ? (req.body as typeof event)
          : (JSON.parse(rawBody) as typeof event);
    } catch {
      throw new AppError(400, 'Invalid webhook payload JSON');
    }

    const eventType = event.event;
    if (!eventType) throw new AppError(400, 'Webhook event type is required');
    const eventId = webhookEventId(
      rawBody,
      req.headers['x-razorpay-event-id'] as string | undefined
    );
    const billingEvent = await claimBillingEvent({
      providerEventId: eventId,
      eventType,
      payloadHash: crypto.createHash('sha256').update(rawBody).digest('hex'),
    });
    if (billingEvent.status === 'COMPLETED') {
      return res.json({ status: 'ok', duplicate: true });
    }

    let paymentOrderId: string | undefined;
    let organizationId: string | undefined;
    try {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;

      if (eventType === 'payment.captured') {
        if (!orderId || !paymentId) {
          throw new AppError(400, 'Captured webhook is missing payment identifiers');
        }
        const existing = await prisma.paymentOrder.findFirst({
          where: { razorpayOrderId: orderId },
        });
        // A valid event for an order created outside this application is
        // retained in the journal but must not mutate any tenant.
        if (existing) {
          paymentOrderId = existing.id;
          organizationId = existing.organizationId;
          const provider = await verifyCapturedPayment({
            orderId: existing.razorpayOrderId,
            paymentId,
            amountPaise: existing.amountPaise,
            currency: existing.currency,
          });
          const result = await fulfillCapturedPayment({
            paymentOrderId: existing.id,
            paymentId,
            providerPayment: paymentEvidence(provider.order, provider.payment),
          });
          if (!result.alreadyCaptured) {
            logger.info('Plan activated via Razorpay webhook', {
              source: 'razorpay',
              organizationId: result.organizationId,
              planId: result.plan,
            });
            const { emitProductEvent } = await import('../platform/events');
            emitProductEvent({ organizationId: result.organizationId, name: 'PAYMENT_OK' });
          }
        }
      } else if (eventType === 'payment.authorized') {
        if (orderId && paymentId) {
          const existing = await prisma.paymentOrder.findFirst({
            where: { razorpayOrderId: orderId },
          });
          if (existing && existing.status !== 'CAPTURED') {
            const provider = await fetchRazorpayPayment(paymentId);
            if (
              provider.order_id !== existing.razorpayOrderId ||
              provider.amount !== existing.amountPaise ||
              provider.currency !== existing.currency ||
              provider.status !== 'authorized'
            ) {
              throw new AppError(409, 'Authorized payment does not match order', 'PAYMENT_MISMATCH');
            }
            paymentOrderId = existing.id;
            organizationId = existing.organizationId;
            await prisma.paymentOrder.updateMany({
              where: { id: existing.id, status: 'CREATED' },
              data: {
                status: 'AUTHORIZED',
                paymentId,
                verificationAt: new Date(),
                providerPaymentStatus: provider.status,
              },
            });
          }
        }
      } else if (eventType === 'payment.failed') {
        if (orderId && paymentId) {
          const failedOrder = await prisma.paymentOrder.findFirst({
            where: { razorpayOrderId: orderId },
            select: { id: true, organizationId: true, status: true, amountPaise: true, currency: true },
          });
          if (failedOrder) {
            const provider = await fetchRazorpayPayment(paymentId);
            if (
              provider.id !== paymentId ||
              provider.order_id !== orderId ||
              provider.amount !== failedOrder.amountPaise ||
              provider.currency !== failedOrder.currency ||
              provider.status !== 'failed'
            ) {
              throw new AppError(409, 'Failed payment does not match order', 'PAYMENT_MISMATCH');
            }
            paymentOrderId = failedOrder.id;
            organizationId = failedOrder.organizationId;
            await markPaymentOrderFailed(failedOrder.id, {
              code: payment?.error_code,
              message: payment?.error_description,
            });
            if (failedOrder.status !== 'CAPTURED') {
              const { emitProductEvent } = await import('../platform/events');
              emitProductEvent({ organizationId: failedOrder.organizationId, name: 'PAYMENT_FAIL' });
            }
          }
        } else if (orderId) {
          throw new AppError(400, 'Failed webhook is missing payment identifiers');
        }
      } else if (eventType === 'payment.refunded' || eventType === 'payment.reversed') {
        if (!orderId || !paymentId) {
          throw new AppError(400, 'Terminal payment webhook is missing payment identifiers');
        }
        const existing = await prisma.paymentOrder.findFirst({
          where: { razorpayOrderId: orderId },
        });
        if (existing) {
          const provider = await fetchRazorpayPayment(paymentId);
          const expectedStatus = eventType === 'payment.refunded' ? 'refunded' : 'reversed';
          if (
            provider.id !== paymentId ||
            provider.order_id !== existing.razorpayOrderId ||
            provider.amount !== existing.amountPaise ||
            provider.currency !== existing.currency ||
            provider.status !== expectedStatus
          ) {
            throw new AppError(409, 'Terminal payment does not match order', 'PAYMENT_MISMATCH');
          }
          paymentOrderId = existing.id;
          organizationId = existing.organizationId;
          await markPaymentOrderProviderTerminal(
            existing.id,
            eventType === 'payment.refunded' ? 'REFUNDED' : 'REVERSED',
            {
              code: eventType.toUpperCase().replace('.', '_'),
              message: `Provider reported payment ${expectedStatus}`,
            }
          );
        }
      }

      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          paymentOrderId,
          organizationId,
          redactedMetadata: {
            source: 'razorpay-webhook',
            eventType,
            paymentId: paymentId || undefined,
            orderId: orderId || undefined,
          },
        },
      });
      return res.json({ status: 'ok' });
    } catch (err) {
      const code = err instanceof AppError ? err.code : undefined;
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
          paymentOrderId,
          organizationId,
          failureCode: code,
          failureMessage: err instanceof Error ? err.message : 'Webhook processing failed',
        },
      });
      throw err;
    }
  })
);

router.patch(
  '/plan',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const { plan } = z
      .object({ plan: z.enum(['launch', 'starter', 'growth', 'pro', 'enterprise']) })
      .parse(req.body);
    const orgId = req.user!.organizationId!;

    if (plan === 'enterprise') {
      throw new AppError(400, 'Contact sales at hello@samyoj.com to upgrade to Enterprise');
    }

    const entitlements = await getOrgEntitlements(orgId);
    const requestedTier = legacyPlanToTier(plan);
    if (
      !entitlements.isLocked &&
      entitlements.planExpiresAt &&
      entitlements.planExpiresAt > new Date() &&
      requestedTier === entitlements.planTier
    ) {
      return sendSuccess(res, {
        plan: entitlements.planTier,
        planExpiresAt: entitlements.planExpiresAt,
        code: 'PLAN_ALREADY_ACTIVE',
        message: 'The selected plan is already active.',
      });
    }
    if (
      !entitlements.isLocked &&
      entitlements.planExpiresAt &&
      entitlements.planExpiresAt > new Date() &&
      TIER_ORDER[requestedTier] < TIER_ORDER[entitlements.planTier]
    ) {
      throw new AppError(
        409,
        'A lower plan cannot be selected while the current paid period is active',
        'PLAN_DOWNGRADE_NOT_ALLOWED_ACTIVE'
      );
    }
    throw new AppError(400, 'Use the one-time checkout flow to change plans', 'CHECKOUT_REQUIRED');
  })
);

router.get(
  '/current',
  authenticate,
  requireOrg,
  loadPermissions,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError(404, 'Organization not found');

    const entitlements = await getOrgEntitlements(orgId);
    sendSuccess(res, {
      plan: entitlements.planTier,
      subscriptionStatus: org.subscriptionStatus,
      planExpiresAt: entitlements.planExpiresAt,
      entitlements,
    });
  })
);

export default router;
