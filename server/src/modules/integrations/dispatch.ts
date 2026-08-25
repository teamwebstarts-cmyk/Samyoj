import crypto from 'crypto';
import prisma from '../../config/database';
import { webhookDispatchQueue } from '../../config/queues';
import { createModuleLogger } from '../../utils/logger';
import { fetchPinnedWebhook } from '../../utils/safe-webhook-url';

const log = createModuleLogger('integrations');
const MAX_FAILURES_BEFORE_DISABLE = 10;

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
    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        organizationId,
        event,
        status: 'PENDING',
        requestBody: body as object,
      },
    });

    await webhookDispatchQueue.add(
      'dispatch',
      { deliveryId: delivery.id },
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
