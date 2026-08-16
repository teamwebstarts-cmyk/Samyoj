import { beforeEach, describe, expect, it, vi } from 'vitest';
import getRedis from '../../config/redis';

vi.mock('../../config/redis', () => ({
  default: vi.fn(),
}));

import {
  consumeAccountThrottle,
  createPlatformAccountThrottle,
  createPlatformRedisAuthStore,
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

  it('fails open if Redis errors', async () => {
    redis.incr.mockRejectedValueOnce(new Error('redis down'));
    await expect(consumeAccountThrottle('login:a@b.c', 10, 900)).resolves.toBe(true);
  });
});

describe('platform auth Redis outage fallback', () => {
  const unavailableRedis = () => {
    throw new Error('redis down');
  };

  it('keeps customer account throttling fail-open', async () => {
    redis.incr.mockRejectedValueOnce(new Error('redis down'));
    await expect(
      consumeAccountThrottle('login:customer@example.com', 1, 900)
    ).resolves.toBe(true);
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
