import rateLimit, { type Store } from 'express-rate-limit';
import getRedis from '../../config/redis';
import logger from '../../utils/logger';

export function redisAuthStore(prefix: string, fallbackCapacity = 5_000): Store {
  let windowMs = 15 * 60 * 1000;
  const keyPrefix = `auth-rl:${prefix}:`;
  const fallback = new BoundedMemoryCounter(fallbackCapacity);

  return {
    init(options) {
      windowMs = options.windowMs;
    },
    async increment(key) {
      try {
        const redis = getRedis();
        const redisKey = `${keyPrefix}${key}`;
        const hits = await redis.incr(redisKey);
        if (hits === 1) await redis.pexpire(redisKey, windowMs);
        const ttl = await redis.pttl(redisKey);
        return { totalHits: hits, resetTime: new Date(Date.now() + Math.max(ttl, 0)) };
      } catch (err) {
        const entry = fallback.increment(key, windowMs);
        logger.warn('Auth rate-limit Redis unavailable — using bounded fallback', {
          source: 'auth',
          prefix,
          fallbackCapacity,
          fallbackExhausted: entry === null,
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          totalHits: entry?.count ?? Number.MAX_SAFE_INTEGER,
          resetTime: new Date(entry?.resetAt ?? Date.now() + windowMs),
        };
      }
    },
    async decrement(key) {
      try {
        await getRedis().decr(`${keyPrefix}${key}`);
      } catch {
        fallback.decrement(key);
      }
    },
    async resetKey(key) {
      try {
        await getRedis().del(`${keyPrefix}${key}`);
      } catch {
        fallback.reset(key);
      }
    },
  };
}

interface MemoryCounterEntry {
  count: number;
  resetAt: number;
}

export class BoundedMemoryCounter {
  private readonly entries = new Map<string, MemoryCounterEntry>();

  constructor(private readonly capacity: number) {}

  increment(
    key: string,
    windowMs: number,
    now = Date.now()
  ): MemoryCounterEntry | null {
    const existing = this.entries.get(key);
    if (existing && existing.resetAt > now) {
      existing.count += 1;
      return { ...existing };
    }
    if (existing) this.entries.delete(key);

    if (this.entries.size >= this.capacity) {
      for (const [candidate, entry] of this.entries) {
        if (entry.resetAt <= now) this.entries.delete(candidate);
      }
    }
    if (this.entries.size >= this.capacity) return null;

    const created = { count: 1, resetAt: now + windowMs };
    this.entries.set(key, created);
    return { ...created };
  }

  decrement(key: string): void {
    const entry = this.entries.get(key);
    if (entry && entry.count > 0) entry.count -= 1;
  }

  reset(key: string): void {
    this.entries.delete(key);
  }
}

interface PlatformThrottleRedis {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  decr(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

type PlatformRedisGetter = () => PlatformThrottleRedis;

/**
 * Platform login cannot inherit customer auth's fail-open behavior. Redis
 * failures fall back to a bounded process-local counter; capacity exhaustion
 * is treated as over-limit.
 */
export function createPlatformRedisAuthStore(
  prefix: string,
  redisGetter: PlatformRedisGetter = getRedis,
  fallbackCapacity = 5_000
): Store {
  let windowMs = 15 * 60 * 1000;
  const keyPrefix = `auth-rl:${prefix}:`;
  const fallback = new BoundedMemoryCounter(fallbackCapacity);

  return {
    init(options) {
      windowMs = options.windowMs;
    },
    async increment(key) {
      try {
        const redis = redisGetter();
        const redisKey = `${keyPrefix}${key}`;
        const hits = await redis.incr(redisKey);
        if (hits === 1) await redis.pexpire(redisKey, windowMs);
        const ttl = await redis.pttl(redisKey);
        return {
          totalHits: hits,
          resetTime: new Date(Date.now() + Math.max(ttl, 0)),
        };
      } catch (err) {
        const entry = fallback.increment(key, windowMs);
        logger.warn('Platform auth rate-limit Redis unavailable — using bounded fallback', {
          source: 'platform-auth',
          prefix,
          fallbackCapacity,
          fallbackExhausted: entry === null,
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          totalHits: entry?.count ?? Number.MAX_SAFE_INTEGER,
          resetTime: new Date(entry?.resetAt ?? Date.now() + windowMs),
        };
      }
    },
    async decrement(key) {
      try {
        await redisGetter().decr(`${keyPrefix}${key}`);
      } catch {
        fallback.decrement(key);
      }
    },
    async resetKey(key) {
      try {
        await redisGetter().del(`${keyPrefix}${key}`);
      } catch {
        fallback.reset(key);
      }
    },
  };
}

const sharedLimiterOptions = {
  standardHeaders: true as const,
  legacyHeaders: false,
  passOnStoreError: false,
};

/** Login / password reset attempts */
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  ...sharedLimiterOptions,
  store: redisAuthStore('login'),
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
});

/** Platform operator login is isolated from customer login counters. */
export const platformAuthLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: false,
  store: createPlatformRedisAuthStore('platform-login'),
  message: {
    success: false,
    error: 'Too many platform login attempts. Try again in 15 minutes.',
  },
});

/** Registration */
export const authRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  ...sharedLimiterOptions,
  store: redisAuthStore('register'),
  message: { success: false, error: 'Too many accounts created from this IP. Try again later.' },
});

/** Forgot-password */
export const authForgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  ...sharedLimiterOptions,
  store: redisAuthStore('forgot'),
  message: { success: false, error: 'Too many reset requests. Try again later.' },
});

/** OAuth URL kickoff */
export const authOAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  ...sharedLimiterOptions,
  store: redisAuthStore('oauth'),
  message: { success: false, error: 'Too many OAuth attempts. Try again later.' },
});

const sharedAccountThrottleFallback = new BoundedMemoryCounter(5_000);

/**
 * Per-email/account throttle on Redis with bounded in-memory fallback.
 * Fails closed — capacity exhaustion is treated as over-limit.
 */
export async function consumeAccountThrottle(
  accountKey: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const redis = getRedis();
    const redisKey = `auth-acct:${accountKey}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSeconds);
    return count <= max;
  } catch (err) {
    const entry = sharedAccountThrottleFallback.increment(accountKey, windowSeconds * 1000);
    logger.warn('Auth account throttle Redis unavailable — using bounded fallback', {
      source: 'auth',
      fallbackExhausted: entry === null,
      error: err instanceof Error ? err.message : String(err),
    });
    return entry !== null && entry.count <= max;
  }
}

export function createPlatformAccountThrottle(
  redisGetter: PlatformRedisGetter = getRedis,
  fallbackCapacity = 5_000
) {
  const fallback = new BoundedMemoryCounter(fallbackCapacity);

  return async (
    accountKey: string,
    max: number,
    windowSeconds: number
  ): Promise<boolean> => {
    try {
      const redis = redisGetter();
      const redisKey = `auth-acct:${accountKey}`;
      const count = await redis.incr(redisKey);
      if (count === 1) await redis.expire(redisKey, windowSeconds);
      return count <= max;
    } catch (err) {
      const entry = fallback.increment(accountKey, windowSeconds * 1000);
      logger.warn('Platform account throttle Redis unavailable — using bounded fallback', {
        source: 'platform-auth',
        fallbackCapacity,
        fallbackExhausted: entry === null,
        error: err instanceof Error ? err.message : String(err),
      });
      return entry !== null && entry.count <= max;
    }
  };
}

export const consumePlatformAccountThrottle = createPlatformAccountThrottle();
