import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('automation PATCH channel scope', () => {
  it('clears WhatsApp ownership when converting to an Instagram keyword', () => {
    const source = readFileSync(join(__dirname, 'routes.ts'), 'utf8');
    expect(source).toContain('const nextNumberId = nextInstagramKeyword ? null : requireWhatsappNumber(numberId);');
  });
});
