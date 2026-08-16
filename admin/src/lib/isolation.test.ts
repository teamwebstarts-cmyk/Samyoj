import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

describe('admin app isolation', () => {
  it('does not import customer auth, inbox, or org JWT storage', () => {
    const files = walk(join(__dirname, '..')).filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
    const joined = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(joined).not.toMatch(/AuthContext|WhatsAppNumberContext|sessionStorage|localStorage\.getItem\(['"]token/);
    expect(joined).not.toContain('../client/');
    expect(joined).not.toContain('../../client/');
  });

  it('protects operator screens behind /auth/me', () => {
    const app = readFileSync(join(__dirname, '../App.tsx'), 'utf8');
    expect(app).toContain("path=\"/login\"");
    expect(app).toContain('<Protected operator={operator} />');
    expect(app).toContain("'/auth/me'");
  });
});
