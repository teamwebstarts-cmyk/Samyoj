import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexSource = readFileSync(join(__dirname, '../../index.ts'), 'utf8');
const routesSource = readFileSync(join(__dirname, 'routes.ts'), 'utf8');
const middlewareSource = readFileSync(join(__dirname, 'middleware.ts'), 'utf8');

describe('platform route isolation regression', () => {
  it('removes the tenant-visible /api/ops route completely', () => {
    expect(indexSource).not.toContain("'/api/ops'");
    expect(indexSource).not.toContain('opsRoutes');
    expect(
      existsSync(join(__dirname, '../ops/routes.ts'))
    ).toBe(false);
  });

  it('mounts only independent cookie/MFA platform auth', () => {
    expect(indexSource).toContain("app.use('/api/platform', platformRoutes)");
    expect(routesSource).toContain('requirePlatformRouteAccess');
    expect(middlewareSource).toContain('authenticatePlatform');
    expect(routesSource).toContain('requireSessionBoundPlatformMutation');
    expect(routesSource).not.toContain("from '../../middleware/auth'");
    expect(middlewareSource).not.toContain('verifyAccessToken');
    expect(middlewareSource).not.toContain('requireOrg');
  });

  it('places the full-MFA boundary before every route definition', () => {
    const boundary = routesSource.indexOf(
      'router.use(requirePlatformRouteAccess)'
    );
    expect(boundary).toBeGreaterThan(0);
    expect(boundary).toBeLessThan(routesSource.indexOf("'/auth/login'"));

    for (const authExemption of [
      'POST /auth/login',
      'POST /auth/mfa/enroll',
      'GET /auth/csrf',
      'POST /auth/logout',
    ]) {
      expect(middlewareSource).toContain(`'${authExemption}'`);
    }
    expect(middlewareSource).not.toContain("'GET /auth/me'");
    expect(
      routesSource.indexOf('router.use(requireSessionBoundPlatformMutation)')
    ).toBeLessThan(boundary);
  });
});
