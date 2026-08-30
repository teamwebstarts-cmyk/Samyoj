import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectForbiddenAdminKeys } from './privacy';

describe('platform API privacy', () => {
  it('treats masked numbers and owner email as allowed operator fields', () => {
    expect(
      collectForbiddenAdminKeys({
        companyName: 'Acme',
        ownerEmail: 'owner@example.com',
        numbers: [{ maskedPhone: '91••••10', isActive: true, qualityRating: 'GREEN' }],
      })
    ).toEqual([]);
  });

  it('keeps outreach POST strict so callers cannot supply recipient or body', () => {
    const routes = readFileSync(join(__dirname, 'routes.ts'), 'utf8');
    const postStart = routes.indexOf("router.post(\n  '/orgs/:id/outreach'");
    expect(postStart).toBeGreaterThan(-1);
    const postEnd = routes.indexOf("router.get(\n  '/operators'", postStart);
    const outreachPost = routes.slice(postStart, postEnd);
    expect(outreachPost).toContain('.strict()');
    expect(outreachPost).toContain("channel: z.literal('email')");
    expect(outreachPost).not.toMatch(/recipientEmail|to: z\.string\(\)\.email|body: z\.string/);
    expect(outreachPost).not.toContain("from '../../middleware/auth'");
  });
});
