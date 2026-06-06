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

  const number = await prisma.whatsappNumber.findFirst({ where: { isActive: true } });
  if (!number) throw new Error('No active WhatsApp number — connect WhatsApp in Settings first');

  const token = MetaWhatsAppService.decryptToken(number.accessToken);
  const result = await MetaWhatsAppService.configureWebhooks(number.wabaId, token);
  const status = await MetaWhatsAppService.getWebhookStatus(number.wabaId, token);

  logger.info('Webhook setup complete', { ...result, subscribed: status.subscribed });
}

main()
  .catch((err) => {
    logError(err, { source: 'startup', action: 'setup-webhook failed' });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
