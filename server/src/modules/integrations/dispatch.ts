import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { webhookDispatchQueue } from '../../config/queues';
import { createModuleLogger } from '../../utils/logger';
import { fetchPinnedWebhook } from '../../utils/safe-webhook-url';

const log = createModuleLogger('integrations');
const MAX_FAILURES_BEFORE_DISABLE = 10;

function deliveryIdFor(endpointId: string, event: string, payload: Record<string, unknown>): string {
  const source = typeof payload.messageId === 'string' ? payload.messageId : null;
  if (!source) return crypto.randomUUID();
  const digest = crypto.createHash('sha256').update(`${endpointId}:${event}:${source}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
}

export async function dispatchOrgWebhook(
  organizationId: string,
  event: string,
  payload: Record<string, unknown>
) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      organizationId,
      enabled: true,
      events: { has: event },
    },
  });

  if (!endpoints.length) return;

  const body = { event, data: payload, timestamp: new Date().toISOString() };

  for (const endpoint of endpoints) {
    const id = deliveryIdFor(endpoint.id, event, payload);
    let created = false;
    try {
      await prisma.webhookDelivery.create({
        data: {
          id,
          endpointId: endpoint.id,
          organizationId,
          event,
          status: 'PENDING',
          requestBody: body as object,
        },
      });
      created = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }
    if (!created) continue;

    await webhookDispatchQueue.add(
      'dispatch',
      { deliveryId: id },
      { attempts: 4, backoff: { type: 'custom' } }
    );
  }
}

export async function executeWebhookDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });

  if (!delivery || !delivery.endpoint.enabled) return;

  const body = JSON.stringify(delivery.requestBody);
  const signature = crypto
    .createHmac('sha256', delivery.endpoint.secret)
    .update(body)
    .digest('hex');

  try {
    const res = await fetchPinnedWebhook(delivery.endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': delivery.event,
        'X-Webhook-Signature': signature,
      },
      body,
      timeoutMs: 30_000,
    });

    if (res.ok) {
      await prisma.$transaction([
        prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'SUCCESS',
            attempts: { increment: 1 },
            lastStatusCode: res.status,
            deliveredAt: new Date(),
          },
        }),
        prisma.webhookEndpoint.update({
          where: { id: delivery.endpointId },
          data: { failureCount: 0 },
        }),
      ]);
      return;
    }

    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const newFailureCount = delivery.endpoint.failureCount + 1;
    const shouldDisable = newFailureCount >= MAX_FAILURES_BEFORE_DISABLE;

    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: shouldDisable ? 'DISABLED' : 'FAILED',
          attempts: { increment: 1 },
          lastError: errorMessage,
        },
      }),
      prisma.webhookEndpoint.update({
        where: { id: delivery.endpointId },
        data: {
          failureCount: newFailureCount,
          ...(shouldDisable ? { enabled: false } : {}),
        },
      }),
    ]);

    if (shouldDisable) {
      log.warn('Webhook endpoint auto-disabled after consecutive failures', {
        endpointId: delivery.endpointId,
      });
    }

    throw err;
  }
}
