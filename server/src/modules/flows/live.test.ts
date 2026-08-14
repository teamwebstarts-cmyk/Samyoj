import { describe, expect, it } from 'vitest';
import { isBotPaused, isLiveFlow, LIVE_FLOW_WHERE } from './live';

describe('isLiveFlow', () => {
  it('is live only when published and enabled', () => {
    expect(isLiveFlow({ enabled: true, status: 'PUBLISHED' })).toBe(true);
    expect(isLiveFlow({ enabled: true, status: 'DRAFT' })).toBe(false);
    expect(isLiveFlow({ enabled: false, status: 'PUBLISHED' })).toBe(false);
    expect(LIVE_FLOW_WHERE).toEqual({ enabled: true, status: 'PUBLISHED' });
  });
});

describe('isBotPaused', () => {
  it('treats botActive false as paused', () => {
    expect(isBotPaused({ botActive: false })).toBe(true);
    expect(isBotPaused({ botActive: true })).toBe(false);
    expect(isBotPaused(null)).toBe(false);
  });
});
