import { GST_RATE, BILLING_SKUS, getSku, type BillingSkuDef, type Cadence, type PlanTier, getSkusByTier } from './plans';

export interface ClientSkuPricing {
  skuId: string;
  cadence: Cadence;
  effectiveMonthlyLabel: string;
  exclGstPaise: number;
  inclGstPaise: number;
  gstPaise: number;
  billingLabel: string;
  upiAutopayAllowed: boolean;
  periodDays: number;
}

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function skuToClientPricing(sku: BillingSkuDef): ClientSkuPricing {
  const gstPaise = sku.inclGstPaise - sku.pricePaise;
  const cadenceWord =
    sku.cadence === 'yearly' ? 'yearly' : sku.cadence === 'quarterly' ? 'quarterly' : 'monthly';
  return {
    skuId: sku.id,
    cadence: sku.cadence,
    effectiveMonthlyLabel: sku.effectiveMonthlyLabel,
    exclGstPaise: sku.pricePaise,
    inclGstPaise: sku.inclGstPaise,
    gstPaise,
    billingLabel: `Billed ${formatInr(sku.inclGstPaise)} ${cadenceWord} (incl. ${Math.round(GST_RATE * 100)}% GST)`,
    upiAutopayAllowed: sku.upiAutopayAllowed,
    periodDays: sku.periodDays,
  };
}

export function pricingByCadenceForTier(tier: PlanTier): Partial<Record<Cadence, ClientSkuPricing>> {
  const skus = getSkusByTier(tier).filter((s) => s.pricePaise > 0);
  const out: Partial<Record<Cadence, ClientSkuPricing>> = {};
  for (const sku of skus) {
    out[sku.cadence] = skuToClientPricing(sku);
  }
  return out;
}

export function resolveSkuForPaymentOrder(order: {
  planId: string;
  amountPaise: number;
  skuId?: string | null;
}): BillingSkuDef | undefined {
  if (order.skuId) {
    const byId = getSku(order.skuId);
    if (byId) return byId;
  }
  return BILLING_SKUS.find(
    (s) =>
      s.planTier === order.planId &&
      (s.inclGstPaise === order.amountPaise || s.pricePaise === order.amountPaise)
  );
}

export function paymentAmountBreakdown(amountPaise: number, sku?: BillingSkuDef) {
  if (sku) {
    const total = sku.inclGstPaise === amountPaise || sku.pricePaise === amountPaise
      ? sku.inclGstPaise
      : amountPaise;
    return {
      totalAmountPaise: total,
      exclGstPaise: sku.pricePaise,
      gstAmountPaise: sku.inclGstPaise - sku.pricePaise,
    };
  }
  const exclGuess = Math.round(amountPaise / (1 + GST_RATE));
  if (Math.abs(exclGuess * (1 + GST_RATE) - amountPaise) < 2) {
    return {
      totalAmountPaise: amountPaise,
      exclGstPaise: exclGuess,
      gstAmountPaise: amountPaise - exclGuess,
    };
  }
  const gstAmountPaise = Math.round(amountPaise * GST_RATE);
  return {
    totalAmountPaise: amountPaise + gstAmountPaise,
    exclGstPaise: amountPaise,
    gstAmountPaise,
  };
}
