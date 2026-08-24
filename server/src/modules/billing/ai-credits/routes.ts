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
  AI_RECURRING_ADDON_SKUS,
  getAiTopupSku,
  inclGstPaise,
} from './catalog';
import { getAiCreditBalances } from './service';
import {
  createRecurringAddonSubscription,
  cancelRecurringAddon,
  verifyAndGrantRecurringCheckout,
  listActiveRecurringAddons,
} from './recurring.service';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifySubscriptionPaymentSignature,
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
    const activeSkuIds = new Set(activeRecurringAddons.map((a) => a.skuId));

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
      recurringAddonSkus: AI_RECURRING_ADDON_SKUS.map((sku) => ({
        id: sku.id,
        pool: sku.pool,
        label: sku.label,
        units: sku.units,
        pricePaise: sku.pricePaise,
        inclGstPaise: inclGstPaise(sku.pricePaise),
        description: sku.description,
        purchaseType: sku.purchaseType,
        available: isRazorpayConfigured(),
        active: activeSkuIds.has(sku.id),
      })),
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

    const { skuId, quantity } = z
      .object({
        skuId: z.string(),
        quantity: z.number().int().min(1).max(99).default(1),
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
    const reusable = await findReusablePendingOrder(orgId, AI_ADDON_PLAN_ID, skuId);
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
      },
    });

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

    const result = await fulfillCapturedPayment({
      paymentOrderId: paymentOrder.id,
      paymentId: data.razorpay_payment_id,
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
    if (!isRazorpayConfigured()) {
      throw new AppError(503, 'Payment gateway is not configured');
    }

    const { skuId } = z.object({ skuId: z.string() }).parse(req.body);
    const orgId = req.user!.organizationId!;

    const sku = getAiTopupSku(skuId);
    if (!sku || sku.purchaseType !== 'recurring_addon') {
      throw new AppError(400, 'Invalid recurring AI add-on SKU');
    }

    const entitlement =
      sku.pool === 'calling' ? await checkQuota(orgId, 'calling') : await checkQuota(orgId, 'ai');
    if (!entitlement.allowed) {
      throw new AppError(
        403,
        entitlement.reason || 'Upgrade your plan before subscribing to this add-on.',
        entitlement.code
      );
    }

    const checkout = await createRecurringAddonSubscription({ organizationId: orgId, skuId });

    sendSuccess(res, {
      subscriptionId: checkout.subscriptionId,
      keyId: checkout.keyId,
      skuId: checkout.skuId,
      label: checkout.label,
      amountPaise: checkout.amountPaise,
      currency: 'INR',
    });
  })
);

router.post(
  '/recurring/verify',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        razorpay_subscription_id: z.string(),
        razorpay_payment_id: z.string(),
        razorpay_signature: z.string(),
      })
      .parse(req.body);

    const orgId = req.user!.organizationId!;

    if (
      !verifySubscriptionPaymentSignature(
        data.razorpay_subscription_id,
        data.razorpay_payment_id,
        data.razorpay_signature
      )
    ) {
      throw new AppError(400, 'Invalid subscription payment signature');
    }

    const grant = await verifyAndGrantRecurringCheckout({
      organizationId: orgId,
      subscriptionId: data.razorpay_subscription_id,
      paymentId: data.razorpay_payment_id,
    });

    const balances = await getAiCreditBalances(orgId);
    const activeRecurringAddons = await listActiveRecurringAddons(orgId);

    sendSuccess(res, {
      message: grant.alreadyGranted
        ? 'Monthly add-on already applied.'
        : 'Monthly AI add-on activated.',
      creditsGranted: grant.creditsGranted,
      balances,
      activeRecurringAddons,
    });
  })
);

router.post(
  '/recurring/cancel',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageBilling'),
  asyncHandler(async (req: Request, res: Response) => {
    const { skuId } = z.object({ skuId: z.string() }).parse(req.body);
    const orgId = req.user!.organizationId!;

    const result = await cancelRecurringAddon({ organizationId: orgId, skuId });
    const balances = await getAiCreditBalances(orgId);
    const activeRecurringAddons = await listActiveRecurringAddons(orgId);

    sendSuccess(res, {
      message: 'Monthly add-on will cancel at the end of this billing period.',
      ...result,
      balances,
      activeRecurringAddons,
    });
  })
);

export default router;
