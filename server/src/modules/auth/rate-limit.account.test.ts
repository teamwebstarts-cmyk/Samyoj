import { beforeEach, describe, expect, it, vi } from 'vitest';
import getRedis from '../../config/redis';

vi.mock('../../config/redis', () => ({
  default: vi.fn(),
}));

import {
  BoundedMemoryCounter,
  consumeAccountThrottle,
  createPlatformAccountThrottle,
  createPlatformRedisAuthStore,
  redisAuthStore,
} from './rate-limit';

const redis = {
  incr: vi.fn(),
  expire: vi.fn(),
};

const getRedisMock = vi.mocked(getRedis);

describe('auth account throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRedisMock.mockReturnValue(redis as never);
  });

  it('allows the first hits under the max', async () => {
    redis.incr.mockResolvedValueOnce(1);
    await expect(consumeAccountThrottle('login:a@b.c', 10, 900)).resolves.toBe(true);
    expect(redis.expire).toHaveBeenCalledWith('auth-acct:login:a@b.c', 900);
  });

  it('blocks when the counter exceeds max', async () => {
    redis.incr.mockResolvedValueOnce(11);
    await expect(consumeAccountThrottle('login:a@b.c', 10, 900)).resolves.toBe(false);
  });

  it('fails closed with bounded fallback when Redis errors', async () => {
    redis.incr.mockRejectedValueOnce(new Error('redis down'));
    await expect(consumeAccountThrottle('login:a@b.c', 10, 900)).resolves.toBe(true);
  });
});

describe('BoundedMemoryCounter', () => {
  it('increments count within a window', () => {
    const counter = new BoundedMemoryCounter(100);
    const entry = counter.increment('key', 60_000);
    expect(entry).toEqual({ count: 1, resetAt: expect.any(Number) });

    const entry2 = counter.increment('key', 60_000);
    expect(entry2).toEqual({ count: 2, resetAt: expect.any(Number) });
  });

  it('resets expired entries', () => {
    const counter = new BoundedMemoryCounter(100);
    const now = Date.now();
    // Create an entry that's already expired
    counter.increment('key', 60_000, now - 120_000);
    // New increment should start fresh at count 1
    const entry = counter.increment('key', 60_000, now);
    expect(entry).toEqual({ count: 1, resetAt: now + 60_000 });
  });

  it('returns null when capacity is exhausted', () => {
    const counter = new BoundedMemoryCounter(1);
    counter.increment('first', 60_000);
    const entry = counter.increment('second', 60_000);
    expect(entry).toBeNull();
  });

  it('evicts expired entries before rejecting', () => {
    const now = Date.now();
    const counter = new BoundedMemoryCounter(1);
    counter.increment('stale', 60_000, now - 120_000);
    const entry = counter.increment('fresh', 60_000, now);
    expect(entry).not.toBeNull();
    expect(entry!.count).toBe(1);
  });

  it('decrements count', () => {
    const counter = new BoundedMemoryCounter(100);
    counter.increment('key', 60_000);
    counter.increment('key', 60_000);
    counter.decrement('key');
    const entry = counter.increment('key', 60_000);
    expect(entry!.count).toBe(2); // 1 → 2 → 1(decrement) → 2
  });

  it('resets a key', () => {
    const counter = new BoundedMemoryCounter(100);
    counter.increment('key', 60_000);
    counter.reset('key');
    const entry = counter.increment('key', 60_000);
    expect(entry!.count).toBe(1);
  });
});

describe('customer auth Redis outage fallback', () => {
  const unavailableRedis = () => {
    throw new Error('redis down');
  };

  beforeEach(() => {
    getRedisMock.mockImplementation(unavailableRedis as never);
  });

  it('counts attempts in memory when Redis is down', async () => {
    const store = redisAuthStore('login-test');
    store.init?.({ windowMs: 15 * 60_000 } as never);

    const first = await store.increment('1.2.3.4');
    expect(first.totalHits).toBe(1);

    const second = await store.increment('1.2.3.4');
    expect(second.totalHits).toBe(2);

    const third = await store.increment('1.2.3.4');
    expect(third.totalHits).toBe(3);
  });

  it('blocks after max attempts when Redis is down (login limit = 20)', async () => {
    const store = redisAuthStore('login-test');
    store.init?.({ windowMs: 15 * 60_000 } as never);

    for (let i = 1; i <= 20; i++) {
      const result = await store.increment('attacker-ip');
      expect(result.totalHits).toBe(i);
    }

    const overLimit = await store.increment('attacker-ip');
    expect(overLimit.totalHits).toBe(21);
    // express-rate-limit compares totalHits (21) > max (20) → blocked
  });

  it('returns MAX_SAFE_INTEGER when fallback capacity is exhausted', async () => {
    const store = redisAuthStore('login-test', 1);
    store.init?.({ windowMs: 15 * 60_000 } as never);

    await store.increment('ip-one');
    const exhausted = await store.increment('ip-two');
    expect(exhausted.totalHits).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('tracks different keys independently', async () => {
    const store = redisAuthStore('login-test');
    store.init?.({ windowMs: 15 * 60_000 } as never);

    await store.increment('ip-a');
    await store.increment('ip-a');
    const bFirst = await store.increment('ip-b');
    expect(bFirst.totalHits).toBe(1);

    const aThird = await store.increment('ip-a');
    expect(aThird.totalHits).toBe(3);
  });
});

describe('platform auth Redis outage fallback', () => {
  const unavailableRedis = () => {
    throw new Error('redis down');
  };

  it('fails closed with bounded fallback for customer account throttle', async () => {
    redis.incr.mockRejectedValue(new Error('redis down'));
    const result1 = await consumeAccountThrottle('login:customer@example.com', 2, 900);
    const result2 = await consumeAccountThrottle('login:customer@example.com', 2, 900);
    const result3 = await consumeAccountThrottle('login:customer@example.com', 2, 900);
    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(false);
  });

  it('enforces the account limit with a bounded in-memory fallback', async () => {
    const throttle = createPlatformAccountThrottle(unavailableRedis, 10);

    await expect(throttle('platform:a@example.com', 2, 900)).resolves.toBe(true);
    await expect(throttle('platform:a@example.com', 2, 900)).resolves.toBe(true);
    await expect(throttle('platform:a@example.com', 2, 900)).resolves.toBe(false);
  });

  it('fails closed when the fallback key capacity is exhausted', async () => {
    const throttle = createPlatformAccountThrottle(unavailableRedis, 1);

    await expect(throttle('platform:first@example.com', 10, 900)).resolves.toBe(
      true
    );
    await expect(throttle('platform:second@example.com', 10, 900)).resolves.toBe(
      false
    );
  });

  it('provides bounded fallback counts to the platform IP limiter store', async () => {
    const store = createPlatformRedisAuthStore(
      'platform-test',
      unavailableRedis,
      1
    );
    store.init?.({ windowMs: 60_000 } as never);

    await expect(store.increment('ip-one')).resolves.toMatchObject({
      totalHits: 1,
    });
    await expect(store.increment('ip-one')).resolves.toMatchObject({
      totalHits: 2,
    });
    await expect(store.increment('ip-two')).resolves.toMatchObject({
      totalHits: Number.MAX_SAFE_INTEGER,
    });
  });
});
