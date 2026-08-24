import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { getSeatLimit, type TeamSettings } from '../team/types';
import { BILLING_SKUS, PLAN_TIERS, legacyPlanToTier, getPlan } from './plans';
import { getOrgEntitlements } from './entitlements.service';
import type { PlanTier } from './plans';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
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
import {
  expireStaleCreatedOrders,
  findReusablePendingOrder,
  fulfillCapturedPayment,
} from './fulfillment';
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
    seats: def.seats === 'custom' ? 999 : def.seats,
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

router.get(
  '/',
  authenticate,
  requireOrg,
  loadPermissions,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;

    const [org, memberCount, recentPayments] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.organizationUser.count({ where: { organizationId: orgId } }),
      prisma.paymentOrder.findMany({
        where: { organizationId: orgId, status: 'CAPTURED' },
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!org) throw new AppError(404, 'Organization not found');

    const teamSettings = (org.settings as { team?: TeamSettings } | null)?.team;
    const seatLimit = getSeatLimit(org.plan, teamSettings);
    const planTier = legacyPlanToTier(org.plan);
    const currentPlan = tierToClientPlan(planTier);

    const lastPaid = recentPayments[0];
    const lastSku = lastPaid ? resolveSkuForPaymentOrder(lastPaid) : undefined;

    const now = new Date();
    const activePayment = recentPayments.find((p) => {
      if (!p.paidAt) return false;
      return orderExpiryDate(p.paidAt, p) > now;
    });

    const activePaidPlan = activePayment ? activePayment.planId : null;
    const activePaidSku = activePayment ? resolveSkuForPaymentOrder(activePayment) : undefined;
    const activePaidExpiresAt =
      activePayment && activePayment.paidAt
        ? orderExpiryDate(activePayment.paidAt, activePayment).toISOString()
        : null;

    sendSuccess(res, {
      plan: org.plan,
      planTier,
      currentPlan,
      plans: (Object.keys(PLAN_TIERS) as PlanTier[]).map(tierToClientPlan),
      seatsUsed: memberCount,
      seatLimit,
      canManageBilling: req.permissions?.manageBilling ?? false,
      razorpayConfigured: isRazorpayConfigured(),
      razorpayKeyId: isRazorpayConfigured() ? config.razorpay.keyId : null,
      planExpiresAt: org.planExpiresAt,
      subscriptionStatus: org.subscriptionStatus,
      cadence:
        org.subscriptionStatus === 'trial'
          ? 'trial'
          : (activePaidSku?.cadence ?? lastSku?.cadence ?? null),
      trialEndsAt: org.subscriptionStatus === 'trial' ? org.planExpiresAt : null,
      currentPeriodEnd: org.planExpiresAt,
      activePaidPlan,
      activePaidExpiresAt,
      recentPayments: recentPayments.map((p) => {
        const sku = resolveSkuForPaymentOrder(p);
        const breakdown = paymentAmountBreakdown(p.amountPaise, sku);
        return {
          planId: p.planId,
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

    const { planId, cadence } = z
      .object({
        planId: z.enum(['starter', 'growth', 'pro']),
        cadence: z.enum(['monthly', 'quarterly', 'yearly']).default('monthly'),
      })
      .parse(req.body);
    const orgId = req.user!.organizationId!;

    const sku = BILLING_SKUS.find((s) => s.planTier === planId && s.cadence === cadence);
    if (!sku || sku.pricePaise <= 0) {
      throw new AppError(400, 'Invalid plan for payment');
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError(404, 'Organization not found');

    const capturedOrders = await prisma.paymentOrder.findMany({
      where: { organizationId: orgId, planId, status: 'CAPTURED' },
      orderBy: { paidAt: 'desc' },
      take: 5,
    });

    const now = new Date();
    const activeOrder = capturedOrders.find((p) => {
      if (!p.paidAt) return false;
      return orderExpiryDate(p.paidAt, p) > now;
    });

    if (activeOrder && activeOrder.paidAt) {
      const orderSku = resolveSkuForPaymentOrder(activeOrder);
      const expiresAt = orderExpiryDate(activeOrder.paidAt, activeOrder);
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          plan: planId,
          planExpiresAt: expiresAt,
          subscriptionStatus: 'active',
        },
      });
      return sendSuccess(res, {
        alreadyActive: true,
        orderId: null,
        amount: 0,
        currency: 'INR',
        keyId: config.razorpay.keyId,
        planName: orderSku?.name || sku.name,
        skuId: sku.id,
        cadence: sku.cadence,
        amountLabel: sku.effectiveMonthlyLabel,
        planExpiresAt: expiresAt,
        message: `Your ${orderSku?.name || sku.name} plan is already active.`,
      });
    }

    const reusable = await findReusablePendingOrder(orgId, planId, sku.id);
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
      },
    });

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

    const result = await fulfillCapturedPayment({
      paymentOrderId: paymentOrder.id,
      paymentId: data.razorpay_payment_id,
    });

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
      message: result.alreadyCaptured
        ? 'Plan already active.'
        : 'Payment successful. Plan upgraded.',
    });
  })
);

router.post(
  '/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const eventId = req.headers['x-razorpay-event-id'] as string | undefined;
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      throw new AppError(400, 'Invalid webhook signature');
    }

    if (eventId) {
      const seen = await prisma.razorpayWebhookEvent.findUnique({ where: { eventId } });
      if (seen) {
        return res.json({ status: 'ok', duplicate: true });
      }
    }

    let event: {
      event: string;
      payload?: {
        payment?: { entity?: { order_id?: string; id?: string; notes?: Record<string, string> } };
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

    if (event.event?.startsWith('subscription.')) {
      const { handleRecurringSubscriptionWebhook } = await import(
        './ai-credits/recurring.service'
      );
      await handleRecurringSubscriptionWebhook(event);
    }

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;

      if (orderId && paymentId) {
        const existing = await prisma.paymentOrder.findFirst({
          where: { razorpayOrderId: orderId },
        });
        if (existing) {
          const result = await fulfillCapturedPayment({
            paymentOrderId: existing.id,
            paymentId,
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
      }
    }

    if (event.event === 'payment.failed') {
      const orderId = event.payload?.payment?.entity?.order_id;
      if (orderId) {
        const failedOrder = await prisma.paymentOrder.findFirst({
          where: { razorpayOrderId: orderId },
          select: { id: true, organizationId: true, status: true },
        });
        if (failedOrder && failedOrder.status !== 'CAPTURED') {
          await prisma.paymentOrder.update({
            where: { id: failedOrder.id },
            data: { status: 'FAILED' },
          });
          const { emitProductEvent } = await import('../platform/events');
          emitProductEvent({
            organizationId: failedOrder.organizationId,
            name: 'PAYMENT_FAIL',
          });
        }
      }
    }

    if (eventId) {
      await prisma.razorpayWebhookEvent.create({
        data: { eventId, eventType: event.event },
      });
    }

    res.json({ status: 'ok' });
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

    const capturedOrders = await prisma.paymentOrder.findMany({
      where: { organizationId: orgId, planId: plan, status: 'CAPTURED' },
      orderBy: { paidAt: 'desc' },
      take: 5,
    });

    const now = new Date();
    const activeOrder = capturedOrders.find((p) => {
      if (!p.paidAt) return false;
      return orderExpiryDate(p.paidAt, p) > now;
    });

    if (activeOrder && activeOrder.paidAt) {
      const orderSku = resolveSkuForPaymentOrder(activeOrder);
      const expiresAt = orderExpiryDate(activeOrder.paidAt, activeOrder);
      const org = await prisma.organization.update({
        where: { id: orgId },
        data: {
          plan,
          planExpiresAt: expiresAt,
          subscriptionStatus: 'active',
        },
      });
      return sendSuccess(res, {
        plan: org.plan,
        planExpiresAt: org.planExpiresAt,
        message: `Your ${orderSku?.name || plan} plan has been restored.`,
      });
    }

    const planDef = getPlan(plan);
    if (planDef && planDef.pricePaise > 0 && !isRazorpayConfigured()) {
      throw new AppError(400, 'Paid plans require Razorpay — use checkout');
    }
    if (planDef && planDef.pricePaise > 0) {
      throw new AppError(400, 'Use Razorpay checkout for paid plans');
    }

    const org = await prisma.organization.update({
      where: { id: orgId },
      data: { plan },
    });

    sendSuccess(res, { plan: org.plan });
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
      plan: org.plan,
      subscriptionStatus: org.subscriptionStatus,
      planExpiresAt: org.planExpiresAt,
      entitlements,
    });
  })
);

export default router;
