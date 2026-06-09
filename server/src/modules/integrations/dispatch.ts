import crypto from 'crypto';
import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('integrations');

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

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex');

      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Signature': signature,
          },
          body,
        });
        if (!res.ok) {
          log.warn('Outbound webhook failed', {
            url: endpoint.url,
            status: res.status,
            event,
          });
        }
      } catch (err) {
        log.warn('Outbound webhook error', { url: endpoint.url, event, error: String(err) });
      }
    })
  );
}
