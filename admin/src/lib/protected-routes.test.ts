import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canAccessPath, isProtectedPath, isPublicPath, NAV_ITEMS } from './routes';

describe('protected routes', () => {
  it('keeps login public and operator screens protected', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isProtectedPath('/')).toBe(true);
    expect(isProtectedPath('/accounts')).toBe(true);
    expect(isProtectedPath('/errors')).toBe(true);
    expect(isProtectedPath('/outreach')).toBe(true);
    expect(isProtectedPath('/operators')).toBe(true);
    expect(isProtectedPath('/audit')).toBe(true);
  });

  it('hides outreach from ANALYST and operators from SUPPORT', () => {
    expect(canAccessPath('ANALYST', '/')).toBe(true);
    expect(canAccessPath('ANALYST', '/outreach')).toBe(false);
    expect(canAccessPath('ANALYST', '/operators')).toBe(false);
    expect(canAccessPath('SUPPORT', '/outreach')).toBe(true);
    expect(canAccessPath('SUPPORT', '/operators')).toBe(false);
    expect(canAccessPath('SUPER_ADMIN', '/operators')).toBe(true);
  });

  it('mounts screens behind /auth/me and /login', () => {
    const app = readFileSync(join(__dirname, '../App.tsx'), 'utf8');
    const session = readFileSync(join(__dirname, '../context/OperatorContext.tsx'), 'utf8');
    expect(app).toContain('path="/login"');
    expect(app).toContain('<Protected');
    expect(app).toContain('<RoleGate');
    expect(session).toContain("'/auth/me'");
    for (const item of NAV_ITEMS) {
      expect(app).toContain(`path="${item.to}"`);
    }
  });
});
