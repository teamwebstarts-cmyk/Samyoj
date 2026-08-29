/**
 * Graph `whatsapp_business_manager_messaging_limit` is a tier enum, not remaining quota.
 * https://developers.facebook.com/docs/whatsapp/messaging-limits/
 */
const TIER_CAPS: Record<string, string> = {
  TIER_50: '50',
  TIER_250: '250',
  TIER_1K: '1,000',
  TIER_2K: '2,000',
  TIER_10K: '10,000',
  TIER_100K: '100,000',
  TIER_UNLIMITED: 'Unlimited',
  UNTIERED: '—',
};

export type MessagingLimitDisplay = {
  cap: string;
  known: boolean;
  unlimited: boolean;
};

export function formatMessagingLimitTier(raw: string | null | undefined): MessagingLimitDisplay {
  const key = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!key) return { cap: '—', known: false, unlimited: false };
  if (key === 'TIER_UNLIMITED') return { cap: 'Unlimited', known: true, unlimited: true };
  if (TIER_CAPS[key]) {
    return { cap: TIER_CAPS[key], known: TIER_CAPS[key] !== '—', unlimited: false };
  }
  const thousands = key.match(/^TIER_(\d+)K$/);
  if (thousands) {
    return { cap: Number(thousands[1] + '000').toLocaleString(), known: true, unlimited: false };
  }
  const digits = key.match(/^TIER_(\d+)$/);
  if (digits) {
    return { cap: Number(digits[1]).toLocaleString(), known: true, unlimited: false };
  }
  return { cap: '—', known: false, unlimited: false };
}
