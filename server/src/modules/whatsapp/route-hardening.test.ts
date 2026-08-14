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
  });
});
