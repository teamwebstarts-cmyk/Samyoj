import { describe, expect, it } from 'vitest';
import { formatMessagingLimitTier } from './messagingLimitTier';

describe('formatMessagingLimitTier', () => {
  it('maps Graph business-manager tiers to unique-user caps', () => {
    expect(formatMessagingLimitTier('TIER_50').cap).toBe('50');
    expect(formatMessagingLimitTier('TIER_250').cap).toBe('250');
    expect(formatMessagingLimitTier('TIER_2K').cap).toBe('2,000');
    expect(formatMessagingLimitTier('TIER_10K').cap).toBe('10,000');
    expect(formatMessagingLimitTier('TIER_100K').cap).toBe('100,000');
    expect(formatMessagingLimitTier('TIER_UNLIMITED')).toEqual({
      cap: 'Unlimited',
      known: true,
      unlimited: true,
    });
  });

  it('does not invent remaining quota when Meta has not sent a tier', () => {
    expect(formatMessagingLimitTier(null)).toEqual({ cap: '—', known: false, unlimited: false });
    expect(formatMessagingLimitTier('UNTIERED').known).toBe(false);
  });
});
