import { describe, expect, it } from 'vitest';
import { helpCenterDayKey, helpCenterStatusReason, secondsUntilUtcMidnight } from './help-center';

describe('help center policy', () => {
  it('keys usage by UTC day', () => {
    expect(helpCenterDayKey('org-1', new Date('2026-10-05T23:00:00.000Z'))).toBe(
      'help-center:org-1:2026-10-05'
    );
  });

  it('computes seconds until the next UTC midnight', () => {
    expect(secondsUntilUtcMidnight(new Date('2026-10-05T23:59:01.000Z'))).toBe(59);
  });

  it('maps disabled, cap, unconfigured, and ready without using a plan', () => {
    expect(
      helpCenterStatusReason({ enabled: false, aiConfigured: true, dailyCap: null, dailyUsed: 0 })
    ).toBe('disabled');
    expect(
      helpCenterStatusReason({ enabled: true, aiConfigured: true, dailyCap: 10, dailyUsed: 10 })
    ).toBe('daily_cap');
    expect(
      helpCenterStatusReason({ enabled: true, aiConfigured: false, dailyCap: null, dailyUsed: 0 })
    ).toBe('ai_unconfigured');
    expect(
      helpCenterStatusReason({ enabled: true, aiConfigured: true, dailyCap: 10, dailyUsed: 2 })
    ).toBe('ready');
  });
});
