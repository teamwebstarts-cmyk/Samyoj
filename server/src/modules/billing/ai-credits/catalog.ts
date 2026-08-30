import type { PlanTier } from '../plans';

/** User-facing credit pools. */
export type AiCreditPool = 'chat' | 'calling';

export type AiAddonPurchaseType = 'topup' | 'recurring_addon';

export interface AiTopupSku {
  id: string;
  pool: AiCreditPool;
  purchaseType: AiAddonPurchaseType;
  label: string;
  units: number;
  /** Paise exclusive of GST */
  pricePaise: number;
  description: string;
}

/** Sarvam Aug 2026 rate weights — internal only, not shown to users. */
export const SARVAM_IN_WEIGHT = 29.28;
export const SARVAM_OUT_WEIGHT = 73.2;

/** ~1 average chat reply (200 in + 50 out tokens) ≈ 1 credit. */
export const CHAT_CREDITS_PER_UNIT =
  200 * SARVAM_IN_WEIGHT + 50 * SARVAM_OUT_WEIGHT;

export const AI_ADDON_PLAN_ID = 'ai_addon';

export const INCLUDED_ALLOWANCES: Record<
  PlanTier,
  { chatCreditsIncluded: number | 'custom'; callingMinutesIncluded: number | 'custom' }
> = {
  launch: { chatCreditsIncluded: 0, callingMinutesIncluded: 0 },
  starter: { chatCreditsIncluded: 0, callingMinutesIncluded: 0 },
  growth: { chatCreditsIncluded: 5_000, callingMinutesIncluded: 0 },
  pro: { chatCreditsIncluded: 25_000, callingMinutesIncluded: 120 },
  enterprise: { chatCreditsIncluded: 'custom', callingMinutesIncluded: 'custom' },
};

/** Inclusive-GST rupee slider. Rates match the Boost / Starter packs. */
export const FLEX_TOPUP_MIN_INR = 10;
export const FLEX_TOPUP_MAX_INR = 1000;
export const FLEX_CHAT_PACK_UNITS = 1_000;
export const FLEX_CHAT_PACK_INR = 235;
export const FLEX_CALLING_PACK_UNITS = 30;
export const FLEX_CALLING_PACK_INR = 353;

export const AI_CHAT_FLEX_SKU_ID = 'ai_chat_flex';
export const AI_CALLING_FLEX_SKU_ID = 'ai_calling_flex';

export function clampFlexSpendInr(spendInr: number): number {
  const rounded = Math.round(Number(spendInr));
  if (!Number.isFinite(rounded)) return FLEX_TOPUP_MIN_INR;
  return Math.min(FLEX_TOPUP_MAX_INR, Math.max(FLEX_TOPUP_MIN_INR, rounded));
}

export function quoteFlexTopup(pool: AiCreditPool, spendInr: number) {
  const inr = clampFlexSpendInr(spendInr);
  const packUnits = pool === 'calling' ? FLEX_CALLING_PACK_UNITS : FLEX_CHAT_PACK_UNITS;
  const packInr = pool === 'calling' ? FLEX_CALLING_PACK_INR : FLEX_CHAT_PACK_INR;
  const units = Math.max(1, Math.round((inr * packUnits) / packInr));
  const inclGst = inr * 100;
  return {
    pool,
    spendInr: inr,
    units,
    inclGstPaise: inclGst,
    exclPaise: Math.round(inclGst / 1.18),
    skuId: pool === 'calling' ? AI_CALLING_FLEX_SKU_ID : AI_CHAT_FLEX_SKU_ID,
    cadence: `topup:1:u:${units}:r:${inr}`,
  };
}

export function isFlexTopupSkuId(skuId: string): boolean {
  return skuId === AI_CHAT_FLEX_SKU_ID || skuId === AI_CALLING_FLEX_SKU_ID;
}

export function flexSkuForPool(pool: AiCreditPool): AiTopupSku {
  const quote = quoteFlexTopup(pool, FLEX_TOPUP_MIN_INR);
  return {
    id: quote.skuId,
    pool,
    purchaseType: 'topup',
    label: pool === 'calling' ? 'AI Calling' : 'AI Chat Agent',
    units: quote.units,
    pricePaise: quote.exclPaise,
    description:
      pool === 'calling'
        ? 'Pay ₹10–₹1,000 for extra AI calling minutes'
        : 'Pay ₹10–₹1,000 for extra AI chat credits',
  };
}

export const AI_TOPUP_SKUS: AiTopupSku[] = [
  flexSkuForPool('chat'),
  flexSkuForPool('calling'),
  {
    id: 'ai_chat_topup_1k',
    pool: 'chat',
    purchaseType: 'topup',
    label: 'Boost',
    units: 1_000,
    pricePaise: 19_900,
    description: '1,000 extra AI chat credits',
  },
  {
    id: 'ai_chat_topup_5k',
    pool: 'chat',
    purchaseType: 'topup',
    label: 'Standard',
    units: 5_000,
    pricePaise: 79_900,
    description: '5,000 extra AI chat credits',
  },
  {
    id: 'ai_chat_topup_25k',
    pool: 'chat',
    purchaseType: 'topup',
    label: 'Power',
    units: 25_000,
    pricePaise: 299_900,
    description: '25,000 extra AI chat credits',
  },
  {
    id: 'ai_calling_topup_30',
    pool: 'calling',
    purchaseType: 'topup',
    label: 'Starter',
    units: 30,
    pricePaise: 29_900,
    description: '30 extra AI calling minutes',
  },
  {
    id: 'ai_calling_topup_120',
    pool: 'calling',
    purchaseType: 'topup',
    label: 'Growth',
    units: 120,
    pricePaise: 99_900,
    description: '120 extra AI calling minutes',
  },
  {
    id: 'ai_calling_topup_500',
    pool: 'calling',
    purchaseType: 'topup',
    label: 'Scale',
    units: 500,
    pricePaise: 349_900,
    description: '500 extra AI calling minutes',
  },
];

export const AI_RECURRING_ADDON_SKUS: AiTopupSku[] = [
  {
    id: 'ai_chat_addon_monthly_5k',
    pool: 'chat',
    purchaseType: 'recurring_addon',
    label: 'Monthly +5K chat',
    units: 5_000,
    pricePaise: 79_900,
    description: '+5,000 chat credits each billing cycle',
  },
  {
    id: 'ai_calling_addon_monthly_60',
    pool: 'calling',
    purchaseType: 'recurring_addon',
    label: 'Monthly +60 min',
    units: 60,
    pricePaise: 49_900,
    description: '+60 calling minutes each billing cycle',
  },
];

export function getAiTopupSku(skuId: string): AiTopupSku | undefined {
  return [...AI_TOPUP_SKUS, ...AI_RECURRING_ADDON_SKUS].find((s) => s.id === skuId);
}

export function inclGstPaise(exclPaise: number): number {
  return Math.round(exclPaise * 1.18);
}

export function tokensToChatCredits(promptTokens: number, completionTokens: number): number {
  const weighted =
    Math.max(0, promptTokens) * SARVAM_IN_WEIGHT +
    Math.max(0, completionTokens) * SARVAM_OUT_WEIGHT;
  if (weighted <= 0) return 0;
  return Math.max(1, Math.ceil(weighted / CHAT_CREDITS_PER_UNIT));
}

export function callingSecondsToMinutes(durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.max(1, Math.ceil(durationSeconds / 60));
}
