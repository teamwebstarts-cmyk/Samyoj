import { getRedis } from '../../config/redis';
import prisma from '../../config/database';

const REDIS_PREFIX = 'samyoj:webhook:health:';
const REDIS_KEYS = {
  totalReceived: `${REDIS_PREFIX}totalReceived`,
  totalQueued: `${REDIS_PREFIX}totalQueued`,
  totalProcessed: `${REDIS_PREFIX}totalProcessed`,
  totalFailed: `${REDIS_PREFIX}totalFailed`,
  lastReceivedAt: `${REDIS_PREFIX}lastReceivedAt`,
  channel: {
    whatsappReceived: `${REDIS_PREFIX}whatsapp:received`,
    whatsappQueued: `${REDIS_PREFIX}whatsapp:queued`,
    pageReceived: `${REDIS_PREFIX}page:received`,
    pageQueued: `${REDIS_PREFIX}page:queued`,
    instagramReceived: `${REDIS_PREFIX}instagram:received`,
    instagramQueued: `${REDIS_PREFIX}instagram:queued`,
  },
};

export type WebhookChannel = 'whatsapp' | 'page' | 'instagram';
type ChannelHealth = { received: number; queued: number };

export interface WebhookHealthState {
  totalReceived: number;
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalErrors: number;
  lastReceivedAt: string | null;
  lastError: string | null;
  lastFbTraceId: string | null;
  byChannel: Record<WebhookChannel, ChannelHealth>;
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
  byChannel: {
    whatsapp: { received: 0, queued: 0 },
    page: { received: 0, queued: 0 },
    instagram: { received: 0, queued: 0 },
  },
};

function persistIncr(key: string): void {
  void getRedis()
    .incr(key)
    .catch(() => undefined);
}

function channelKey(channel: WebhookChannel, metric: 'received' | 'queued'): string {
  const suffix = metric === 'received' ? 'Received' : 'Queued';
  return REDIS_KEYS.channel[`${channel}${suffix}` as keyof typeof REDIS_KEYS.channel] as string;
}

export function trackWebhookReceived(channel: WebhookChannel = 'whatsapp'): void {
  webhookHealth.totalReceived += 1;
  webhookHealth.byChannel[channel].received += 1;
  webhookHealth.lastReceivedAt = new Date().toISOString();
  persistIncr(REDIS_KEYS.totalReceived);
  persistIncr(channelKey(channel, 'received'));
  void getRedis()
    .set(REDIS_KEYS.lastReceivedAt, webhookHealth.lastReceivedAt)
    .catch(() => undefined);
}

export function trackWebhookQueued(channel: WebhookChannel = 'whatsapp'): void {
  webhookHealth.totalQueued += 1;
  webhookHealth.byChannel[channel].queued += 1;
  persistIncr(REDIS_KEYS.totalQueued);
  persistIncr(channelKey(channel, 'queued'));
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
    const [
      received,
      queued,
      processed,
      failed,
      last,
      whatsappReceived,
      whatsappQueued,
      pageReceived,
      pageQueued,
      instagramReceived,
      instagramQueued,
    ] = await redis.mget(
      REDIS_KEYS.totalReceived,
      REDIS_KEYS.totalQueued,
      REDIS_KEYS.totalProcessed,
      REDIS_KEYS.totalFailed,
      REDIS_KEYS.lastReceivedAt,
      REDIS_KEYS.channel.whatsappReceived,
      REDIS_KEYS.channel.whatsappQueued,
      REDIS_KEYS.channel.pageReceived,
      REDIS_KEYS.channel.pageQueued,
      REDIS_KEYS.channel.instagramReceived,
      REDIS_KEYS.channel.instagramQueued,
    );
    webhookHealth.totalReceived = Math.max(webhookHealth.totalReceived, Number(received) || 0);
    webhookHealth.totalQueued = Math.max(webhookHealth.totalQueued, Number(queued) || 0);
    webhookHealth.totalProcessed = Math.max(webhookHealth.totalProcessed, Number(processed) || 0);
    webhookHealth.totalFailed = Math.max(webhookHealth.totalFailed, Number(failed) || 0);
    webhookHealth.byChannel.whatsapp.received = Math.max(
      webhookHealth.byChannel.whatsapp.received,
      Number(whatsappReceived) || 0,
    );
    webhookHealth.byChannel.whatsapp.queued = Math.max(
      webhookHealth.byChannel.whatsapp.queued,
      Number(whatsappQueued) || 0,
    );
    webhookHealth.byChannel.page.received = Math.max(
      webhookHealth.byChannel.page.received,
      Number(pageReceived) || 0,
    );
    webhookHealth.byChannel.page.queued = Math.max(
      webhookHealth.byChannel.page.queued,
      Number(pageQueued) || 0,
    );
    webhookHealth.byChannel.instagram.received = Math.max(
      webhookHealth.byChannel.instagram.received,
      Number(instagramReceived) || 0,
    );
    webhookHealth.byChannel.instagram.queued = Math.max(
      webhookHealth.byChannel.instagram.queued,
      Number(instagramQueued) || 0,
    );
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
  oldestWaitingMs: number | null;
  webhookConfigured: boolean;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
  byChannel: Record<WebhookChannel, ChannelHealth>;
}

/** Unauthenticated health JSON — never include the live tunnel URL or error text. */
export function toPublicWebhookHealth(flags: {
  queueDepth: number;
  oldestWaitingMs?: number | null;
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
    oldestWaitingMs: flags.oldestWaitingMs ?? null,
    webhookConfigured: flags.webhookConfigured,
    verifyTokenConfigured: flags.verifyTokenConfigured,
    appSecretConfigured: flags.appSecretConfigured,
    byChannel: webhookHealth.byChannel,
  };
}
