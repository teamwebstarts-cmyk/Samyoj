import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routesSrc = readFileSync(join(__dirname, 'routes.ts'), 'utf8');

describe('WhatsApp route hardening', () => {
  it('PATCH /meta-config fails closed with 410 like legacy connect', () => {
    expect(routesSrc).toContain("router.patch(\n  '/meta-config'");
    expect(routesSrc).toContain('rejectOrgMetaConfigWrite');
    expect(routesSrc).not.toMatch(/saveOrgMetaSettings\(/);
    expect(routesSrc).toContain("router.post(\n  '/connect'");
    expect(routesSrc).toMatch(/throw new AppError\(\s*410,/);
  });

  it('public webhook health does not serialize the live webhook URL', () => {
    const healthBlock = routesSrc.slice(
      routesSrc.indexOf("router.get('/webhook/health'"),
      routesSrc.indexOf("router.post('/webhook'")
    );
    expect(healthBlock).toContain('toPublicWebhookHealth');
    expect(healthBlock).not.toContain('webhookUrl:');
    expect(healthBlock).toContain('webhookConfigured');
    expect(healthBlock).toContain('oldestWaitingMs');
  });

  it('acks Meta only after persistAndEnqueueInboundWebhook', () => {
    const postBlock = routesSrc.slice(routesSrc.indexOf("router.post('/webhook'"));
    const persistIdx = postBlock.indexOf('persistAndEnqueueInboundWebhook');
    const hmacIdx = postBlock.indexOf('inboundWebhookSignatureGate');
    // WABA ack lives after persist; page branch has its own earlier EVENT_RECEIVED.
    const wabaAckIdx = postBlock.lastIndexOf("EVENT_RECEIVED");
    expect(hmacIdx).toBeGreaterThan(-1);
    expect(persistIdx).toBeGreaterThan(-1);
    expect(wabaAckIdx).toBeGreaterThan(-1);
    expect(hmacIdx).toBeLessThan(persistIdx);
    expect(persistIdx).toBeLessThan(wabaAckIdx);
    expect(postBlock).toContain("status(500).send('Webhook persist failed')");
    expect(routesSrc).toContain("'/webhook-replay'");
  });

  it('routes Page and Instagram objects through signature then durable queueing', () => {
    const postBlock = routesSrc.slice(routesSrc.indexOf("router.post('/webhook'"));
    expect(postBlock).toContain("payload.object !== 'page'");
    expect(postBlock).toContain("payload.object !== 'instagram'");
    expect(postBlock).toContain('persistAndEnqueueInboundWebhook');
    const hmacIdx = postBlock.indexOf('inboundWebhookSignatureGate');
    // Handler branch comes after signature validation.
    const pageHandlerIdx = postBlock.indexOf(
      "// --- 3b. Page/Instagram objects: persist + enqueue before acknowledging Meta ---"
    );
    expect(hmacIdx).toBeGreaterThan(-1);
    expect(pageHandlerIdx).toBeGreaterThan(hmacIdx);
    expect(postBlock.slice(pageHandlerIdx)).toContain("webhookObject === 'page'");
    expect(postBlock.slice(pageHandlerIdx)).toContain("webhookObject === 'instagram'");
    expect(postBlock.slice(pageHandlerIdx)).toContain('trackWebhookReceived(channel)');
    expect(postBlock.slice(pageHandlerIdx)).toContain('trackWebhookQueued(channel)');
    expect(postBlock).not.toContain('Webhook ignored — not a WhatsApp business account payload');
  });

  it('GET /numbers does not expose tokenExpiresAt', () => {
    const numbersBlock = routesSrc.slice(
      routesSrc.indexOf("router.get(\n  '/numbers'"),
      routesSrc.indexOf("router.get(\n  '/webhook-status'")
    );
    expect(numbersBlock).not.toContain('tokenExpiresAt');
    expect(routesSrc).toContain("router.get(\n  '/webhook-status'");
    const statusBlock = routesSrc.slice(
      routesSrc.indexOf("router.get(\n  '/webhook-status'"),
      routesSrc.indexOf("router.get(\n  '/payment-hint'")
    );
    expect(statusBlock).toContain('tokenExpiresAt');
  });

  it('Graph-checks is_on_biz_app after any connect, not only the coexistence modal', () => {
    const connectFn = routesSrc.slice(
      routesSrc.indexOf('async function saveWhatsappConnection'),
      routesSrc.indexOf('const metaAdminGuard')
    );
    expect(connectFn).toContain('fetchCoexistenceFlags');
    expect(connectFn).not.toMatch(
      /if \(opts\?\.connectMode === 'coexistence' \|\| opts\?\.skipRegister\)/
    );
    expect(connectFn).not.toMatch(
      /isOnBizApp:\s*opts\?\.connectMode === 'coexistence'\s*\?\s*isOnBizApp/
    );
  });
});
