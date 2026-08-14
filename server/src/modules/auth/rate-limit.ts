import rateLimit, { type Store } from 'express-rate-limit';
import getRedis from '../../config/redis';
import logger from '../../utils/logger';

function redisAuthStore(prefix: string): Store {
  let windowMs = 15 * 60 * 1000;
  const keyPrefix = `auth-rl:${prefix}:`;

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
        logger.warn('Auth rate-limit Redis unavailable — failing open for this hit', {
          source: 'auth',
          prefix,
          error: err instanceof Error ? err.message : String(err),
        });
        return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
      }
    },
    async decrement(key) {
      try {
        await getRedis().decr(`${keyPrefix}${key}`);
      } catch {
        /* fail open */
      }
    },
    async resetKey(key) {
      try {
        await getRedis().del(`${keyPrefix}${key}`);
      } catch {
        /* fail open */
      }
    },
  };
}

const sharedLimiterOptions = {
  standardHeaders: true as const,
  legacyHeaders: false,
  passOnStoreError: true,
};

/** Login / password reset attempts */
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  ...sharedLimiterOptions,
  store: redisAuthStore('login'),
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
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

/**
 * Per-email/account throttle on Redis (same pattern as AI bot rate-limit.service).
 * Fail-open if Redis is down — IP limiter still applies.
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
    logger.warn('Auth account throttle Redis unavailable — failing open', {
      source: 'auth',
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}
