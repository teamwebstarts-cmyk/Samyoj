import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../../config/database';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { loadPermissions, requirePermission } from '../../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler } from '../../../utils/response';
import { config } from '../../../config';
import {
  AI_ADDON_PLAN_ID,
  AI_TOPUP_SKUS,
  getAiTopupSku,
  inclGstPaise,
} from './catalog';
import { getAiCreditBalances } from './service';
import {
  listActiveRecurringAddons,
} from './recurring.service';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifyCapturedPayment,
} from '../razorpay.service';
import {
  expireStaleCreatedOrders,
  findReusablePendingOrder,
  fulfillCapturedPayment,
  parseTopupQuantity,
} from '../fulfillment';
import { checkQuota } from '../entitlements.service';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
  loadPermissions,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const balances = await getAiCreditBalances(orgId);
    const activeRecurringAddons = await listActiveRecurringAddons(orgId);

    sendSuccess(res, {
      ...balances,
      topupSkus: AI_TOPUP_SKUS.map((sku) => ({
        id: sku.id,
        pool: sku.pool,
        label: sku.label,
        units: sku.units,
        pricePaise: sku.pricePaise,
        inclGstPaise: inclGstPaise(sku.pricePaise),
        description: sku.description,
        purchaseType: sku.purchaseType,
      })),
      recurringAddonSkus: [],
      activeRecurringAddons,
    });
  })
);

router.post(
  '/purchase',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!isRazorpayConfigured()) {
      throw new AppError(503, 'Payment gateway is not configured');
    }

    const { skuId, quantity, checkoutIntentKey } = z
      .object({
        skuId: z.string(),
        quantity: z.literal(1).default(1),
        checkoutIntentKey: z.string().trim().min(8).max(120).optional(),
      })
      .parse(req.body);

    const sku = getAiTopupSku(skuId);
    if (!sku || sku.purchaseType !== 'topup') {
      throw new AppError(400, 'Invalid or unavailable AI add-on SKU');
    }

    const orgId = req.user!.organizationId!;
    const entitlement =
      sku.pool === 'calling' ? await checkQuota(orgId, 'calling') : await checkQuota(orgId, 'ai');
    if (!entitlement.allowed) {
      throw new AppError(
        403,
        entitlement.reason || 'Upgrade your plan before purchasing this add-on.',
        entitlement.code
      );
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError(404, 'Organization not found');

    const chargePaise = inclGstPaise(sku.pricePaise * quantity);
    const intentKey =
      checkoutIntentKey ||
      (typeof req.header('Idempotency-Key') === 'string'
        ? req.header('Idempotency-Key')!.trim()
        : undefined);
    const reusable = await findReusablePendingOrder(
      orgId,
      AI_ADDON_PLAN_ID,
      skuId,
      30 * 60 * 1000,
      intentKey
    );
    if (reusable) {
      return sendSuccess(res, {
        orderId: reusable.razorpayOrderId,
        amount: reusable.amountPaise,
        currency: reusable.currency,
        keyId: config.razorpay.keyId,
        skuId: sku.id,
        quantity: parseTopupQuantity(reusable.cadence),
        label: sku.label,
        reusedPendingOrder: true,
        checkoutIntentKey: reusable.checkoutIntentKey,
      });
    }

    await expireStaleCreatedOrders(orgId, AI_ADDON_PLAN_ID);

    const receipt = `ai_${sku.id}_${orgId.slice(0, 8)}_${Date.now()}`;
    const order = await createRazorpayOrder({
      amountPaise: chargePaise,
      receipt,
      notes: {
        organizationId: orgId,
        planId: AI_ADDON_PLAN_ID,
        skuId: sku.id,
        quantity: String(quantity),
        companyName: org.companyName,
      },
    });

    try {
      await prisma.paymentOrder.create({
        data: {
          organizationId: orgId,
          razorpayOrderId: order.id,
          planId: AI_ADDON_PLAN_ID,
          skuId: sku.id,
          cadence: `topup:${quantity}`,
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
          AI_ADDON_PLAN_ID,
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
            skuId: sku.id,
            quantity: parseTopupQuantity(raceWinner.cadence),
            label: sku.label,
            reusedPendingOrder: true,
            checkoutIntentKey: raceWinner.checkoutIntentKey,
          });
        }
      }
      throw err;
    }

    sendSuccess(res, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.razorpay.keyId,
      skuId: sku.id,
      quantity,
      label: sku.label,
      units: sku.units * quantity,
      pool: sku.pool,
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
    if (paymentOrder.planId !== AI_ADDON_PLAN_ID) {
      throw new AppError(400, 'Not an AI add-on order');
    }

    const provider = await verifyCapturedPayment({
      orderId: paymentOrder.razorpayOrderId,
      paymentId: data.razorpay_payment_id,
      amountPaise: paymentOrder.amountPaise,
      currency: paymentOrder.currency,
    });
    const result = await fulfillCapturedPayment({
      paymentOrderId: paymentOrder.id,
      paymentId: data.razorpay_payment_id,
      providerPayment: {
        orderId: provider.order.id,
        paymentId: provider.payment.id,
        amountPaise: provider.payment.amount,
        currency: provider.payment.currency,
        status: provider.payment.status,
        orderStatus: provider.order.status,
      },
    });

    const balances = await getAiCreditBalances(orgId);

    sendSuccess(res, {
      message: result.alreadyCaptured
        ? 'Add-on already applied.'
        : 'AI add-on purchased successfully.',
      creditsGranted: result.creditsGranted,
      balances,
    });
  })
);

router.post(
  '/recurring/subscribe',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    throw new AppError(
      410,
      'Recurring AI add-ons are unavailable; purchase one fixed top-up pack instead.',
      'RECURRING_ADDONS_UNAVAILABLE'
    );
  })
);

router.post(
  '/recurring/verify',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    throw new AppError(
      410,
      'Recurring AI add-ons are unavailable.',
      'RECURRING_ADDONS_UNAVAILABLE'
    );
  })
);

router.post(
  '/recurring/cancel',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    throw new AppError(
      410,
      'Recurring AI add-ons are unavailable.',
      'RECURRING_ADDONS_UNAVAILABLE'
    );
  })
);

export default router;
