import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ON_FLAGS,
  HELP_CENTER_FLAG,
  isFlagEnabled,
  parseHelpCenterDailyCap,
} from './feature-flags';

describe('feature flags', () => {
  it('treats help_center as on when no row exists', () => {
    expect(DEFAULT_ON_FLAGS.has(HELP_CENTER_FLAG)).toBe(true);
    expect(isFlagEnabled(HELP_CENTER_FLAG, undefined)).toBe(true);
    expect(isFlagEnabled('content_studio', undefined)).toBe(false);
  });

  it('honors an explicit help_center off row', () => {
    expect(isFlagEnabled(HELP_CENTER_FLAG, false)).toBe(false);
    expect(isFlagEnabled(HELP_CENTER_FLAG, true)).toBe(true);
  });

  it('parses a positive integer daily cap only', () => {
    expect(parseHelpCenterDailyCap({ dailyMessageCap: 40 })).toBe(40);
    expect(parseHelpCenterDailyCap({ dailyMessageCap: 0 })).toBeNull();
    expect(parseHelpCenterDailyCap({ dailyMessageCap: 1.5 })).toBeNull();
    expect(parseHelpCenterDailyCap(null)).toBeNull();
    expect(parseHelpCenterDailyCap({ dailyMessageCap: '40' })).toBeNull();
  });
});
