import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(join(__dirname, 'routes.ts'), 'utf8');

describe('platform write APIs', () => {
  it('requires a reason on AI, flag, billing, outreach, and operator writes', () => {
    for (const [method, path] of [
      ['patch', '/orgs/:id/ai'],
      ['patch', '/orgs/:id/flags'],
      ['patch', '/orgs/:id/billing'],
      ['post', '/orgs/:id/outreach'],
      ['post', '/operators'],
    ] as const) {
      const matcher = new RegExp(
        `router\\.${method}\\(\\s*'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]{0,500}reason: reasonSchema`
      );
      expect(routes, `${method} ${path}`).toMatch(matcher);
    }
  });

  it('does not accept provider keys, prompts, or forged payments', () => {
    expect(routes).not.toMatch(/apiKey\s*:|endpoint\s*:|prompt\s*:|razorpay_payment_id|PaymentOrder\.create/);
    expect(routes).toContain("'trial'");
    expect(routes).toContain("'locked'");
  });
});
