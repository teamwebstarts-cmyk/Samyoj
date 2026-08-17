import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_COOKIE_PATH,
  PLATFORM_CSRF_COOKIE,
  PLATFORM_CSRF_COOKIE_PATH,
  PLATFORM_CSRF_HEADER,
  PLATFORM_SESSION_COOKIE,
} from './security';

const routes = readFileSync(join(__dirname, 'routes.ts'), 'utf8');

const PLATFORM_ROUTES = [
  'POST /auth/login',
  'POST /auth/mfa/enroll',
  'POST /auth/mfa/reset-enrollment',
  'GET /auth/csrf',
  'GET /auth/me',
  'POST /auth/logout',
  'GET /overview',
  'GET /orgs',
  'GET /orgs/:id',
  'GET /orgs/:id/ai',
  'PATCH /orgs/:id/ai',
  'PATCH /orgs/:id/flags',
  'PATCH /orgs/:id/billing',
  'GET /errors',
  'GET /outreach',
  'GET /orgs/:id/outreach',
  'POST /orgs/:id/outreach',
  'GET /operators',
  'POST /operators',
  'PATCH /operators/:id',
  'GET /sessions',
  'DELETE /sessions/:id',
  'GET /audit',
] as const;

function routePresent(method: string, path: string): boolean {
  const matcher = new RegExp(
    `router\\.${method.toLowerCase()}\\(\\s*['\\\`]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\\\`]`
  );
  return matcher.test(routes);
}

describe('platform API contract for the admin app', () => {
  it('exposes the documented /api/platform routes', () => {
    for (const route of PLATFORM_ROUTES) {
      const [method, path] = route.split(' ');
      expect(routePresent(method, path), route).toBe(true);
    }
  });

  it('returns csrfToken on login, MFA enroll, and CSRF rotation', () => {
    expect(routes).toContain("csrfToken: session.csrfToken");
    expect(routes).toContain('sendSuccess(res, { csrfToken: rotated.csrfToken })');
    expect(routes).toContain('csrfToken,');
  });

  it('keeps TOTP enroll/verify paths and gates them with PLATFORM_MFA_REQUIRED', () => {
    expect(routes).toContain('isPlatformMfaRequired');
    expect(routes).toContain('resolvePlatformPasswordLogin');
    expect(routes).toContain("'/auth/mfa/enroll'");
    expect(routes).toContain("state: 'MFA_REQUIRED'");
    expect(routes).toContain("state: 'MFA_ENROLLMENT_REQUIRED'");
  });

  it('documents the cookie and CSRF header names the UI must use', () => {
    expect(PLATFORM_SESSION_COOKIE).toBe('samyoj_platform_session');
    expect(PLATFORM_CSRF_COOKIE).toBe('samyoj_platform_csrf');
    expect(PLATFORM_CSRF_HEADER).toBe('x-platform-csrf-token');
    expect(PLATFORM_COOKIE_PATH).toBe('/api/platform');
    expect(PLATFORM_CSRF_COOKIE_PATH).toBe('/');
  });
});
