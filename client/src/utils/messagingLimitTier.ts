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
  capNumber: number | null;
  known: boolean;
  unlimited: boolean;
};

function display(
  cap: string,
  capNumber: number | null,
  known: boolean,
  unlimited = false
): MessagingLimitDisplay {
  return { cap, capNumber, known, unlimited };
}

export function formatMessagingLimitTier(raw: string | null | undefined): MessagingLimitDisplay {
  const key = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!key) return display('—', null, false);
  if (key === 'TIER_UNLIMITED') return display('Unlimited', null, true, true);
  if (TIER_CAPS[key]) {
    const known = TIER_CAPS[key] !== '—';
    const capNumber = known ? Number(TIER_CAPS[key].replace(/,/g, '')) : null;
    return display(TIER_CAPS[key], Number.isFinite(capNumber) ? capNumber : null, known);
  }
  const thousands = key.match(/^TIER_(\d+)K$/);
  if (thousands) {
    const capNumber = Number(thousands[1] + '000');
    return display(capNumber.toLocaleString(), capNumber, true);
  }
  const digits = key.match(/^TIER_(\d+)$/);
  if (digits) {
    const capNumber = Number(digits[1]);
    return display(capNumber.toLocaleString(), capNumber, true);
  }
  return display('—', null, false);
}
