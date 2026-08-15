import prisma from '../src/config/database';
import { MetaWhatsAppService } from '../src/modules/whatsapp/meta.service';
import { config } from '../src/config';
import logger from '../src/utils/logger';
import { logError } from '../src/errors';

async function waitForWebhookReachable(webhookUrl: string, maxAttempts = 60): Promise<void> {
  const verifyUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(config.meta.verifyToken)}&hub.challenge=ping`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(verifyUrl, { signal: AbortSignal.timeout(5000) });
      if (res.status === 200 && (await res.text()) === 'ping') {
        logger.info('Webhook endpoint reachable', { webhookUrl, attempt });
        return;
      }
    } catch {
      // tunnel not ready yet
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(
    `Webhook URL is not reachable: ${webhookUrl}. ` +
      'Ensure the dev server (npm run dev) and tunnel (npm run dev:tunnel) are both running, then retry.'
  );
}

async function main() {
  if (!config.meta.webhookUrl) {
    throw new Error('Set META_WEBHOOK_URL in server/.env first (HTTPS tunnel URL + /api/whatsapp/webhook)');
  }

  logger.info('Registering webhook', { webhookUrl: config.meta.webhookUrl });
  await waitForWebhookReachable(config.meta.webhookUrl);

  // Register the app callback first so Meta can verify it before WABA override.
  await MetaWhatsAppService.registerAppWebhook(config.meta.webhookUrl);

  const numbers = await prisma.whatsappNumber.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  if (numbers.length === 0) {
    throw new Error('No active WhatsApp number — connect WhatsApp in Settings first');
  }

  let subscribedCount = 0;
  const failures: Array<{ phoneNumber: string; wabaId: string; error: string }> = [];

  for (const number of numbers) {
    const token = MetaWhatsAppService.decryptToken(number.accessToken);
    try {
      await MetaWhatsAppService.ensureWabaSubscribed(number.wabaId, token);
      subscribedCount++;
      logger.info('WABA linked to app', {
        phoneNumber: number.phoneNumber,
        wabaId: number.wabaId,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failures.push({ phoneNumber: number.phoneNumber, wabaId: number.wabaId, error });
      logger.warn('WABA subscription skipped', {
        phoneNumber: number.phoneNumber,
        wabaId: number.wabaId,
        error,
      });
    }
  }

  if (subscribedCount === 0) {
    throw new Error(
      'Could not link any WhatsApp Business Account to this app. ' +
        'Disconnect and reconnect WhatsApp in Settings for each number, ' +
        'and ensure your Meta user is an admin on the WABA.'
    );
  }

  const subscriptions = await MetaWhatsAppService.getAppWebhookSubscriptions();
  const wabaSub = subscriptions.find((item) => item.object === 'whatsapp_business_account');

  logger.info('Webhook setup complete', {
    callbackUrl: config.meta.webhookUrl,
    subscribedWabas: subscribedCount,
    skippedWabas: failures.length,
    fields: wabaSub?.fields,
    failures: failures.length > 0 ? failures : undefined,
  });
}

main()
  .catch((err) => {
    logError(err, { source: 'startup', action: 'setup-webhook failed' });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
