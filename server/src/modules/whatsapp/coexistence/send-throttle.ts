/** Coexistence numbers are capped at 20 msg/sec (standard Cloud API default is 80/sec). */

export const COEXISTENCE_SEND_RATE_PER_SEC = 20;

type Bucket = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, Bucket>();

function refillBucket(bucket: Bucket, ratePerSec: number, now: number): void {
  const elapsedSec = (now - bucket.lastRefillMs) / 1000;
  if (elapsedSec <= 0) return;
  bucket.tokens = Math.min(ratePerSec, bucket.tokens + elapsedSec * ratePerSec);
  bucket.lastRefillMs = now;
}

/**
 * Token-bucket throttle for outbound sends on coexistence (Business app + API) numbers.
 * Resolves when a send slot is available.
 */
export async function acquireCoexistenceSendSlot(
  whatsappNumberId: string,
  ratePerSec = COEXISTENCE_SEND_RATE_PER_SEC
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
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const afterWait = Date.now();
  refillBucket(bucket, ratePerSec, afterWait);
  bucket.tokens = Math.max(0, bucket.tokens - 1);
}

/** Test helper — reset in-memory buckets between unit tests. */
export function resetCoexistenceSendThrottleForTests(): void {
  buckets.clear();
}
