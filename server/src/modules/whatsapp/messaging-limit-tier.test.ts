import { describe, expect, it } from 'vitest';
import { parseMessagingLimitCap } from './messaging-limit-tier';

describe('parseMessagingLimitCap', () => {
  it('maps Graph tiers to unique-people caps', () => {
    expect(parseMessagingLimitCap('TIER_250')).toEqual({ cap: 250, known: true, unlimited: false });
    expect(parseMessagingLimitCap('TIER_1K')).toEqual({ cap: 1_000, known: true, unlimited: false });
    expect(parseMessagingLimitCap('TIER_UNLIMITED')).toEqual({ cap: null, known: true, unlimited: true });
  });

  it('does not invent a cap when Meta has not sent a tier', () => {
    expect(parseMessagingLimitCap(null)).toEqual({ cap: null, known: false, unlimited: false });
    expect(parseMessagingLimitCap('UNTIERED').known).toBe(false);
  });
});
