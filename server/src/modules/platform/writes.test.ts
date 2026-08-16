import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routes = readFileSync(join(__dirname, 'routes.ts'), 'utf8');

describe('platform write APIs', () => {
  it('requires a reason on AI, flag, billing, outreach, and operator writes', () => {
    for (const path of [
      "'/orgs/:id/ai'",
      "'/orgs/:id/flags'",
      "'/orgs/:id/billing'",
      "'/orgs/:id/outreach'",
      "'/operators'",
    ]) {
      const index = routes.indexOf(path);
      expect(index).toBeGreaterThan(0);
      expect(routes.slice(index, index + 800)).toContain('reason: reasonSchema');
    }
  });

  it('does not accept provider keys, prompts, or forged payments', () => {
    expect(routes).not.toMatch(/apiKey\s*:|endpoint\s*:|prompt\s*:|razorpay_payment_id|PaymentOrder\.create/);
    expect(routes).toContain("'active', 'complimentary', 'expired', 'past_due', 'cancelled'");
  });
});
