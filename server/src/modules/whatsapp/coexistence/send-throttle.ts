import getRedis from '../../../config/redis';
import { createModuleLogger } from '../../../utils/logger';

/** Coexistence numbers are capped at 20 msg/sec (standard Cloud API default is 80/sec). */

export const COEXISTENCE_SEND_RATE_PER_SEC = 20;
export const COEXISTENCE_THROTTLE_REDIS_PREFIX = 'coex:send-throttle:';

const log = createModuleLogger('coexistence-throttle');

type Bucket = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, Bucket>();

const CONSUME_SCRIPT = `
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local ttlMs = tonumber(ARGV[3])
local data = redis.call('hmget', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = rate
  ts = now
end
local elapsed = (now - ts) / 1000.0
if elapsed > 0 then
  tokens = math.min(rate, tokens + elapsed * rate)
  ts = now
end
local waitMs = 0
if tokens >= 1 then
  tokens = tokens - 1
else
  waitMs = math.ceil(((1 - tokens) / rate) * 1000)
  tokens = tokens - 1
end
redis.call('hmset', key, 'tokens', tostring(tokens), 'ts', tostring(ts))
redis.call('pexpire', key, ttlMs)
return waitMs
`;

const REDIS_BUCKET_TTL_MS = 10_000;
const REDIS_FALLBACK_WARN_MS = 60_000;
let lastRedisFallbackWarnAt = 0;

function refillBucket(bucket: Bucket, ratePerSec: number, now: number): void {
  const elapsedSec = (now - bucket.lastRefillMs) / 1000;
  if (elapsedSec <= 0) return;
  bucket.tokens = Math.min(ratePerSec, bucket.tokens + elapsedSec * ratePerSec);
  bucket.lastRefillMs = now;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireMemorySlot(
  whatsappNumberId: string,
  ratePerSec: number
): Promise<void> {
  const now = Date.now();
  let bucket = buckets.get(whatsappNumberId);
  if (!bucket) {
    bucket = { tokens: ratePerSec, lastRefillMs: now };
    buckets.set(whatsappNumberId, bucket);
  }

  refillBucket(bucket, ratePerSec, now);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return;
  }

  const deficit = 1 - bucket.tokens;
  const waitMs = Math.ceil((deficit / ratePerSec) * 1000);
  bucket.tokens -= 1;
  await sleep(waitMs);
}

function warnRedisFallback(error: unknown): void {
  const now = Date.now();
  if (now - lastRedisFallbackWarnAt < REDIS_FALLBACK_WARN_MS) return;
  lastRedisFallbackWarnAt = now;
  log.warn('Coexistence send throttle falling back to in-memory', {
    error: error instanceof Error ? error.message : String(error),
  });
}

async function acquireRedisSlot(
  whatsappNumberId: string,
  ratePerSec: number
): Promise<number> {
  const redis = getRedis();
  const result = await redis.eval(
    CONSUME_SCRIPT,
    1,
    `${COEXISTENCE_THROTTLE_REDIS_PREFIX}${whatsappNumberId}`,
    String(ratePerSec),
    String(Date.now()),
    String(REDIS_BUCKET_TTL_MS)
  );
  const waitMs = Number(result);
  if (!Number.isFinite(waitMs) || waitMs < 0) {
    throw new Error('invalid coexistence throttle redis result');
  }
  return waitMs;
}

/**
 * Token-bucket throttle for outbound sends on coexistence (Business app + API) numbers.
 * Redis is primary so multiple API processes share the 20/sec cap; in-memory is used
 * when Redis is unavailable (per-process, does not crash sends).
 */
export async function acquireCoexistenceSendSlot(
  whatsappNumberId: string,
  ratePerSec = COEXISTENCE_SEND_RATE_PER_SEC
): Promise<void> {
  try {
    const waitMs = await acquireRedisSlot(whatsappNumberId, ratePerSec);
    if (waitMs > 0) await sleep(waitMs);
    return;
  } catch (error) {
    warnRedisFallback(error);
    await acquireMemorySlot(whatsappNumberId, ratePerSec);
  }
}

/** Test helper — reset in-memory buckets between unit tests. */
export function resetCoexistenceSendThrottleForTests(): void {
  buckets.clear();
  lastRedisFallbackWarnAt = 0;
}
