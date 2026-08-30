import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import getRedis from '../../../config/redis';
import {
  acquireCoexistenceSendSlot,
  COEXISTENCE_SEND_RATE_PER_SEC,
  COEXISTENCE_THROTTLE_REDIS_PREFIX,
  resetCoexistenceSendThrottleForTests,
} from './send-throttle';

vi.mock('../../../config/redis', () => ({
  default: vi.fn(),
}));

const getRedisMock = vi.mocked(getRedis);

describe('coexistence-send-throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCoexistenceSendThrottleForTests();
    vi.clearAllMocks();
    getRedisMock.mockImplementation(() => {
      throw new Error('redis down');
    });
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

  it('uses a Redis token bucket keyed by whatsappNumberId', async () => {
    const evalMock = vi.fn().mockResolvedValue(0);
    getRedisMock.mockReturnValue({ eval: evalMock } as never);

    await acquireCoexistenceSendSlot('wn-redis');

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('hmget'"),
      1,
      `${COEXISTENCE_THROTTLE_REDIS_PREFIX}wn-redis`,
      String(COEXISTENCE_SEND_RATE_PER_SEC),
      expect.any(String),
      expect.any(String)
    );
  });

  it('waits the Redis-returned delay then proceeds', async () => {
    const evalMock = vi.fn().mockResolvedValue(80);
    getRedisMock.mockReturnValue({ eval: evalMock } as never);

    const pending = acquireCoexistenceSendSlot('wn-redis-wait');
    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(80);
    await pending;
    expect(settled).toBe(true);
  });

  it('falls back to in-memory when Redis eval fails', async () => {
    const evalMock = vi.fn().mockRejectedValue(new Error('eval failed'));
    getRedisMock.mockReturnValue({ eval: evalMock } as never);

    const waits: Promise<void>[] = [];
    for (let i = 0; i < COEXISTENCE_SEND_RATE_PER_SEC; i += 1) {
      waits.push(acquireCoexistenceSendSlot('wn-fallback'));
    }
    await Promise.all(waits);

    const pending = acquireCoexistenceSendSlot('wn-fallback');
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
