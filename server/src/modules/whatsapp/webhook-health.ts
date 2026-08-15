import { getRedis } from '../../config/redis';
import prisma from '../../config/database';

const REDIS_PREFIX = 'samyoj:webhook:health:';
const REDIS_KEYS = {
  totalReceived: `${REDIS_PREFIX}totalReceived`,
  totalQueued: `${REDIS_PREFIX}totalQueued`,
  totalProcessed: `${REDIS_PREFIX}totalProcessed`,
  totalFailed: `${REDIS_PREFIX}totalFailed`,
  lastReceivedAt: `${REDIS_PREFIX}lastReceivedAt`,
};

export interface WebhookHealthState {
  totalReceived: number;
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalErrors: number;
  lastReceivedAt: string | null;
  lastError: string | null;
  lastFbTraceId: string | null;
}

export const webhookHealth: WebhookHealthState = {
  totalReceived: 0,
  totalQueued: 0,
  totalProcessed: 0,
  totalFailed: 0,
  totalErrors: 0,
  lastReceivedAt: null,
  lastError: null,
  lastFbTraceId: null,
};

function persistIncr(key: string): void {
  void getRedis()
    .incr(key)
    .catch(() => undefined);
}

export function trackWebhookReceived(): void {
  webhookHealth.totalReceived += 1;
  webhookHealth.lastReceivedAt = new Date().toISOString();
  persistIncr(REDIS_KEYS.totalReceived);
  void getRedis()
    .set(REDIS_KEYS.lastReceivedAt, webhookHealth.lastReceivedAt)
    .catch(() => undefined);
}

export function trackWebhookQueued(): void {
  webhookHealth.totalQueued += 1;
  persistIncr(REDIS_KEYS.totalQueued);
}

export function trackWebhookProcessed(): void {
  webhookHealth.totalProcessed += 1;
  persistIncr(REDIS_KEYS.totalProcessed);
}

export function trackWebhookFailed(error: unknown): void {
  webhookHealth.totalFailed += 1;
  webhookHealth.totalErrors += 1;
  webhookHealth.lastError = error instanceof Error ? error.message : String(error);
  persistIncr(REDIS_KEYS.totalFailed);
}

/** Load durable counters so a PM2 restart does not show totalReceived: 0 / lastReceivedAt null. */
export async function hydrateWebhookHealth(): Promise<void> {
  try {
    const redis = getRedis();
    const [received, queued, processed, failed, last] = await redis.mget(
      REDIS_KEYS.totalReceived,
      REDIS_KEYS.totalQueued,
      REDIS_KEYS.totalProcessed,
      REDIS_KEYS.totalFailed,
      REDIS_KEYS.lastReceivedAt
    );
    webhookHealth.totalReceived = Math.max(webhookHealth.totalReceived, Number(received) || 0);
    webhookHealth.totalQueued = Math.max(webhookHealth.totalQueued, Number(queued) || 0);
    webhookHealth.totalProcessed = Math.max(webhookHealth.totalProcessed, Number(processed) || 0);
    webhookHealth.totalFailed = Math.max(webhookHealth.totalFailed, Number(failed) || 0);
    if (last && (!webhookHealth.lastReceivedAt || last > webhookHealth.lastReceivedAt)) {
      webhookHealth.lastReceivedAt = last;
    }
  } catch {
    // Redis optional for health display
  }

  if (webhookHealth.lastReceivedAt) return;

  try {
    const lastEvent = await prisma.providerWebhookEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastEvent) {
      webhookHealth.lastReceivedAt = lastEvent.createdAt.toISOString();
    }
  } catch {
    // DB optional for health display
  }
}

export interface PublicWebhookHealth {
  totalReceived: number;
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalErrors: number;
  lastReceivedAt: string | null;
  queueDepth: number;
  webhookConfigured: boolean;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
}

/** Unauthenticated health JSON — never include the live tunnel URL or error text. */
export function toPublicWebhookHealth(flags: {
  queueDepth: number;
  webhookConfigured: boolean;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
}): PublicWebhookHealth {
  return {
    totalReceived: webhookHealth.totalReceived,
    totalQueued: webhookHealth.totalQueued,
    totalProcessed: webhookHealth.totalProcessed,
    totalFailed: webhookHealth.totalFailed,
    totalErrors: webhookHealth.totalErrors,
    lastReceivedAt: webhookHealth.lastReceivedAt,
    queueDepth: flags.queueDepth,
    webhookConfigured: flags.webhookConfigured,
    verifyTokenConfigured: flags.verifyTokenConfigured,
    appSecretConfigured: flags.appSecretConfigured,
  };
}
