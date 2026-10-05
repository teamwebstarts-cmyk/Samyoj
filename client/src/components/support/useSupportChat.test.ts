import { describe, expect, it } from 'vitest';
import { applySupportStatusPayload, statusCopy } from './useSupportChat';

describe('statusCopy', () => {
  it('shows daily usage when capped and ready', () => {
    expect(statusCopy('ready', true, { dailyCap: 50, dailyUsed: 12 })).toBe('Ready · 12/50 today');
  });

  it('stays generic when uncapped', () => {
    expect(statusCopy('ready', true, { dailyCap: null, dailyUsed: 0 })).toBe('Ready to help');
  });
});

describe('applySupportStatusPayload', () => {
  it('normalizes daily fields from API', () => {
    expect(
      applySupportStatusPayload({
        assistantOnline: true,
        reason: 'ready',
        dailyCap: 10,
        dailyUsed: 3,
      })
    ).toMatchObject({ dailyCap: 10, dailyUsed: 3, reason: 'ready' });
  });
});
