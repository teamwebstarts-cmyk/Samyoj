import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../../config/database';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { loadPermissions, requirePermission } from '../../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler } from '../../../utils/response';
import { config } from '../../../config';
import {
  AI_ADDON_PLAN_ID,
  AI_CALLING_FLEX_SKU_ID,
  AI_CHAT_FLEX_SKU_ID,
  FLEX_CALLING_PACK_INR,
  FLEX_CALLING_PACK_UNITS,
  FLEX_CHAT_PACK_INR,
  FLEX_CHAT_PACK_UNITS,
  FLEX_TOPUP_MAX_INR,
  FLEX_TOPUP_MIN_INR,
  getAiTopupSku,
  inclGstPaise,
  isFlexTopupSkuId,
  quoteFlexTopup,
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
  parseFlexTopupUnits,
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

    const flexSkus = [AI_CHAT_FLEX_SKU_ID, AI_CALLING_FLEX_SKU_ID]
      .map((id) => getAiTopupSku(id))
      .filter((sku): sku is NonNullable<typeof sku> => Boolean(sku));

    sendSuccess(res, {
      ...balances,
      topupSkus: flexSkus.map((sku) => ({
        id: sku.id,
        pool: sku.pool,
        label: sku.label,
        units: sku.units,
        pricePaise: sku.pricePaise,
        inclGstPaise: inclGstPaise(sku.pricePaise),
        description: sku.description,
        purchaseType: sku.purchaseType,
      })),
      flexTopup: {
        minInr: FLEX_TOPUP_MIN_INR,
        maxInr: FLEX_TOPUP_MAX_INR,
        chat: {
          skuId: AI_CHAT_FLEX_SKU_ID,
          packUnits: FLEX_CHAT_PACK_UNITS,
          packInclGstInr: FLEX_CHAT_PACK_INR,
        },
        calling: {
          skuId: AI_CALLING_FLEX_SKU_ID,
          packUnits: FLEX_CALLING_PACK_UNITS,
          packInclGstInr: FLEX_CALLING_PACK_INR,
        },
      },
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

    const { skuId, spendInr, checkoutIntentKey } = z
      .object({
        skuId: z.string(),
        spendInr: z.number().int().min(FLEX_TOPUP_MIN_INR).max(FLEX_TOPUP_MAX_INR).optional(),
        checkoutIntentKey: z.string().trim().min(8).max(120).optional(),
      })
      .parse(req.body);

    const sku = getAiTopupSku(skuId);
    if (!sku || sku.purchaseType !== 'topup') {
      throw new AppError(400, 'Invalid or unavailable AI add-on SKU');
    }

    const flex = isFlexTopupSkuId(sku.id);
    if (flex && spendInr == null) {
      throw new AppError(400, `Choose an amount between ₹${FLEX_TOPUP_MIN_INR} and ₹${FLEX_TOPUP_MAX_INR}`);
    }
    const quote = flex ? quoteFlexTopup(sku.pool, spendInr!) : null;
    if (quote && quote.skuId !== sku.id) {
      throw new AppError(400, 'Invalid AI add-on SKU for this pool');
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

    const chargePaise = quote ? quote.inclGstPaise : inclGstPaise(sku.pricePaise);
    const cadence = quote ? quote.cadence : 'topup:1';
    const unitsGranted = quote ? quote.units : sku.units;
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
      intentKey,
      cadence
    );
    if (reusable) {
      return sendSuccess(res, {
        orderId: reusable.razorpayOrderId,
        amount: reusable.amountPaise,
        currency: reusable.currency,
        keyId: config.razorpay.keyId,
        skuId: sku.id,
        label: sku.label,
        units: parseFlexTopupUnits(reusable.cadence) ?? sku.units,
        pool: sku.pool,
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
        spendInr: String(quote?.spendInr ?? Math.round(chargePaise / 100)),
        units: String(unitsGranted),
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
          cadence,
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
          intentKey,
          cadence
        );
        if (raceWinner) {
          return sendSuccess(res, {
            orderId: raceWinner.razorpayOrderId,
            amount: raceWinner.amountPaise,
            currency: raceWinner.currency,
            keyId: config.razorpay.keyId,
            skuId: sku.id,
            label: sku.label,
            units: parseFlexTopupUnits(raceWinner.cadence) ?? sku.units,
            pool: sku.pool,
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
      label: sku.label,
      units: unitsGranted,
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
