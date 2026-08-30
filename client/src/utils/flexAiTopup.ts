export const FLEX_TOPUP_MIN_INR = 10;
export const FLEX_TOPUP_MAX_INR = 1000;
export const FLEX_CHAT_PACK_UNITS = 1_000;
export const FLEX_CHAT_PACK_INR = 235;
export const FLEX_CALLING_PACK_UNITS = 30;
export const FLEX_CALLING_PACK_INR = 353;
export const AI_CHAT_FLEX_SKU_ID = 'ai_chat_flex';
export const AI_CALLING_FLEX_SKU_ID = 'ai_calling_flex';

export type FlexAiPool = 'chat' | 'calling';

export function clampFlexSpendInr(spendInr: number, minInr = FLEX_TOPUP_MIN_INR, maxInr = FLEX_TOPUP_MAX_INR): number {
  const rounded = Math.round(Number(spendInr));
  if (!Number.isFinite(rounded)) return minInr;
  return Math.min(maxInr, Math.max(minInr, rounded));
}

export function quoteFlexTopup(
  pool: FlexAiPool,
  spendInr: number,
  rates?: { packUnits: number; packInclGstInr: number; minInr?: number; maxInr?: number }
) {
  const minInr = rates?.minInr ?? FLEX_TOPUP_MIN_INR;
  const maxInr = rates?.maxInr ?? FLEX_TOPUP_MAX_INR;
  const inr = clampFlexSpendInr(spendInr, minInr, maxInr);
  const packUnits =
    rates?.packUnits ?? (pool === 'calling' ? FLEX_CALLING_PACK_UNITS : FLEX_CHAT_PACK_UNITS);
  const packInr =
    rates?.packInclGstInr ?? (pool === 'calling' ? FLEX_CALLING_PACK_INR : FLEX_CHAT_PACK_INR);
  const units = Math.max(1, Math.round((inr * packUnits) / packInr));
  return {
    pool,
    spendInr: inr,
    units,
    inclGstPaise: inr * 100,
    skuId: pool === 'calling' ? AI_CALLING_FLEX_SKU_ID : AI_CHAT_FLEX_SKU_ID,
  };
}
