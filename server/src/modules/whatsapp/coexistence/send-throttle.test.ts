import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  acquireCoexistenceSendSlot,
  COEXISTENCE_SEND_RATE_PER_SEC,
  resetCoexistenceSendThrottleForTests,
} from './send-throttle';

describe('coexistence-send-throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCoexistenceSendThrottleForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows bursts up to the coexistence rate per second', async () => {
    const waits: Promise<void>[] = [];
    for (let i = 0; i < COEXISTENCE_SEND_RATE_PER_SEC; i += 1) {
      waits.push(acquireCoexistenceSendSlot('wn1'));
    }
    await Promise.all(waits);
    expect(waits).toHaveLength(COEXISTENCE_SEND_RATE_PER_SEC);
  });

  it('waits when exceeding 20 msg/sec for the same number', async () => {
    for (let i = 0; i < COEXISTENCE_SEND_RATE_PER_SEC; i += 1) {
      await acquireCoexistenceSendSlot('wn-throttle');
    }

    const pending = acquireCoexistenceSendSlot('wn-throttle');
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(60);
    await pending;
    expect(settled).toBe(true);
  });
});
