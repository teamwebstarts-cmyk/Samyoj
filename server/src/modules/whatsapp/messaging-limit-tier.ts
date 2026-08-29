/**
 * Graph `whatsapp_business_manager_messaging_limit` is a unique-people / 24h
 * ceiling, not remaining quota. Keep in sync with client/src/utils/messagingLimitTier.ts.
 */
const TIER_CAPS: Record<string, number | null> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1_000,
  TIER_2K: 2_000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
  TIER_UNLIMITED: null,
  UNTIERED: null,
};

export function parseMessagingLimitCap(raw: string | null | undefined): {
  cap: number | null;
  known: boolean;
  unlimited: boolean;
} {
  const key = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!key) return { cap: null, known: false, unlimited: false };
  if (key === 'TIER_UNLIMITED') return { cap: null, known: true, unlimited: true };
  if (key === 'UNTIERED') return { cap: null, known: false, unlimited: false };
  if (key in TIER_CAPS) {
    const cap = TIER_CAPS[key];
    return { cap: cap ?? null, known: cap != null, unlimited: false };
  }
  const thousands = key.match(/^TIER_(\d+)K$/);
  if (thousands) {
    const cap = Number(thousands[1]) * 1_000;
    return { cap, known: true, unlimited: false };
  }
  const digits = key.match(/^TIER_(\d+)$/);
  if (digits) {
    const cap = Number(digits[1]);
    return { cap, known: Number.isFinite(cap), unlimited: false };
  }
  return { cap: null, known: false, unlimited: false };
}
