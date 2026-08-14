import { beforeEach, describe, expect, it, vi } from 'vitest';
import getRedis from '../../config/redis';

vi.mock('../../config/redis', () => ({
  default: vi.fn(),
}));

import { consumeAccountThrottle } from './rate-limit';

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
