import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { getSeatLimit, type TeamSettings } from '../team/types';
import { BILLING_PLANS, getPlan } from './plans';
import {
  activatePlan,
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay.service';
import { config } from '../../config';
import logger from '../../utils/logger';
import { getOrgUsage, estimateCampaignCost } from './usage.service';
import paymentLinksRoutes from './payment-links.routes';

const router = Router();

router.use(paymentLinksRoutes);

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
        take: 5,
      }),
    ]);

    if (!org) throw new AppError(404, 'Organization not found');

    const teamSettings = (org.settings as { team?: TeamSettings } | null)?.team;
    const seatLimit = getSeatLimit(org.plan, teamSettings);
    const currentPlan = getPlan(org.plan) || BILLING_PLANS[0];

    sendSuccess(res, {
      plan: org.plan,
      currentPlan,
      plans: BILLING_PLANS,
      seatsUsed: memberCount,
      seatLimit,
      canManageBilling: req.permissions?.manageSettings ?? false,
      razorpayConfigured: isRazorpayConfigured(),
      razorpayKeyId: isRazorpayConfigured() ? config.razorpay.keyId : null,
      planExpiresAt: org.planExpiresAt,
      subscriptionStatus: org.subscriptionStatus,
      recentPayments: recentPayments.map((p) => ({
        planId: p.planId,
        amountPaise: p.amountPaise,
        paidAt: p.paidAt,
      })),
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
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { planId } = z.object({ planId: z.enum(['growth', 'business']) }).parse(req.body);
    const orgId = req.user!.organizationId!;

    const plan = getPlan(planId);
    if (!plan || plan.pricePaise <= 0) {
      throw new AppError(400, 'Invalid plan for payment');
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError(404, 'Organization not found');

    const receipt = `plan_${planId}_${orgId.slice(0, 8)}_${Date.now()}`;
    const order = await createRazorpayOrder({
      amountPaise: plan.pricePaise,
      receipt,
      notes: { organizationId: orgId, planId, companyName: org.companyName },
    });

    await prisma.paymentOrder.create({
      data: {
        organizationId: orgId,
        razorpayOrderId: order.id,
        planId,
        amountPaise: plan.pricePaise,
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
      planName: plan.name,
    });
  })
);

router.post(
  '/verify',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        razorpay_order_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
        planId: z.enum(['growth', 'business']),
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

    await prisma.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: 'CAPTURED',
        paymentId: data.razorpay_payment_id,
        paidAt: new Date(),
      },
    });

    const org = await activatePlan(orgId, data.planId);

    if (paymentOrder.status !== 'CAPTURED') {
      const { emitProductEvent } = await import('../platform/events');
      emitProductEvent({
        organizationId: orgId,
        name: 'PAYMENT_OK',
      });
    }

    sendSuccess(res, {
      plan: org.plan,
      planExpiresAt: org.planExpiresAt,
      message: 'Payment successful. Plan upgraded.',
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
      event: string;
      payload?: {
        payment?: { entity?: { order_id?: string; id?: string; notes?: Record<string, string> } };
      };
    };
    try {
      event = (typeof req.body === 'object' && req.body !== null && 'event' in req.body)
        ? (req.body as typeof event)
        : (JSON.parse(rawBody) as typeof event);
    } catch {
      throw new AppError(400, 'Invalid webhook payload JSON');
    }

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const paymentId = payment?.id;
      const planId = payment?.notes?.planId;
      const organizationId = payment?.notes?.organizationId;

      if (orderId && organizationId && planId) {
        const existing = await prisma.paymentOrder.findUnique({
          where: { razorpayOrderId: orderId },
        });
        if (existing && existing.status !== 'CAPTURED') {
          await prisma.paymentOrder.update({
            where: { id: existing.id },
            data: { status: 'CAPTURED', paymentId, paidAt: new Date() },
          });
          await activatePlan(organizationId, planId);
          logger.info('Plan activated via Razorpay webhook', {
            source: 'razorpay',
            organizationId,
            planId,
          });
          const { emitProductEvent } = await import('../platform/events');
          emitProductEvent({ organizationId, name: 'PAYMENT_OK' });
        }
      }
    }
    if (event.event === 'payment.failed') {
      const orderId = event.payload?.payment?.entity?.order_id;
      if (orderId) {
        const failedOrder = await prisma.paymentOrder.findUnique({
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

    res.json({ status: 'ok' });
  })
);

router.patch(
  '/plan',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageSettings'),
  asyncHandler(async (req: Request, res: Response) => {
    const { plan } = z
      .object({ plan: z.enum(['starter', 'growth', 'business', 'enterprise']) })
      .parse(req.body);
    const orgId = req.user!.organizationId!;

    if (plan === 'enterprise') {
      throw new AppError(400, 'Contact sales to upgrade to Enterprise');
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
      data: { plan, planExpiresAt: null },
    });

    sendSuccess(res, { plan: org.plan });
  })
);

export default router;
