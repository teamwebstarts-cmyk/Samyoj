import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('automation PATCH channel scope', () => {
  it('clears WhatsApp ownership when converting to an Instagram keyword', () => {
    const source = readFileSync(join(__dirname, 'routes.ts'), 'utf8');
    expect(source).toContain('const nextNumberId = nextChannelPlatform ? null : requireWhatsappNumber(numberId);');
    expect(source).toContain("if (nextChannelPlatform === 'IG') await requireInstagramChannel(tx, orgId);");
  });
});
