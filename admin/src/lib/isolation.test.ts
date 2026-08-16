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
    const files = walk(join(__dirname, '..')).filter(
      (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.endsWith('.test.ts')
    );
    const joined = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(joined).not.toMatch(/AuthContext|WhatsAppNumberContext/);
    expect(joined).not.toMatch(/sessionStorage|localStorage\.getItem\(['"]token/);
    expect(joined).not.toContain('../client/');
    expect(joined).not.toContain('../../client/');
  });

  it('calls only /api/platform with cookie credentials', () => {
    const api = readFileSync(join(__dirname, '../api.ts'), 'utf8');
    const session = readFileSync(join(__dirname, './session.ts'), 'utf8');
    expect(api).toContain('`/api/platform${path}`');
    expect(api).toContain("credentials: 'include'");
    expect(api).toContain('CSRF_HEADER');
    expect(session).toContain("x-platform-csrf-token");
  });
});
