/** Customer-facing reason when Meta will not turn WhatsApp calls on. No raw Graph codes. */

export interface CallingBlockNotice {
  code: 'META_CALLING_LIMIT' | 'META_CALLING_OFF';
  title: string;
  message: string;
}

const DAILY_LIMIT: Record<string, number> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1_000,
  TIER_2K: 2_000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
  TIER_UNLIMITED: Number.POSITIVE_INFINITY,
};

/** Meta refuses Calling API enable below this daily unique-recipient limit. */
export const CALLING_MIN_DAILY_LIMIT = 2_000;

export function callingBlockNotice(tier: string | null | undefined): CallingBlockNotice {
  const limit = DAILY_LIMIT[(tier || '').trim().toUpperCase()];
  if (limit != null && limit < CALLING_MIN_DAILY_LIMIT) {
    const current = limit.toLocaleString('en-IN');
    return {
      code: 'META_CALLING_LIMIT',
      title: 'WhatsApp calls are off on this number',
      message: `Meta allows calls only after this number can message 2,000 people in a day. This number is at ${current}. Raise the messaging limit in WhatsApp Manager, then try calling again.`,
    };
  }
  if (limit != null) {
    return {
      code: 'META_CALLING_OFF',
      title: 'WhatsApp calls are off on this number',
      message:
        'Meta has not turned on calls for this number yet. Open WhatsApp Manager, turn calling on for this number, then try again.',
    };
  }
  return {
    code: 'META_CALLING_OFF',
    title: 'WhatsApp calls are off on this number',
    message:
      'Meta has not turned on calls for this number yet. Calls stay off until this number can message at least 2,000 people in a day. Check the messaging limit in WhatsApp Manager, then try again.',
  };
}
