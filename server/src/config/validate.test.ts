import { describe, expect, it } from 'vitest';
import {
  jwtDevFallbackAllowed,
  jwtSecretErrors,
  looksWeakSecret,
  platformAdminUrlErrors,
} from './validate';

describe('JWT secret fail-fast', () => {
  it('treats missing, short, and default secrets as weak', () => {
    expect(looksWeakSecret('')).toBe(true);
    expect(looksWeakSecret('short')).toBe(true);
    expect(looksWeakSecret('dev-secret')).toBe(true);
    expect(looksWeakSecret('dev-refresh-secret')).toBe(true);
    expect(looksWeakSecret('a'.repeat(32))).toBe(false);
  });

  it('allows weak secrets only when NODE_ENV is explicitly development', () => {
    expect(jwtDevFallbackAllowed('development')).toBe(true);
    expect(jwtDevFallbackAllowed('production')).toBe(false);
    expect(jwtDevFallbackAllowed('test')).toBe(false);
    expect(jwtDevFallbackAllowed(undefined)).toBe(false);
  });

  it('fails closed for test-deploy and production when secrets are default', () => {
    expect(jwtSecretErrors('production', 'dev-secret', 'a'.repeat(32))).toEqual([
      'JWT_SECRET must be a strong secret (32+ chars), not the default',
    ]);
    expect(jwtSecretErrors('test', '', 'dev-refresh-secret')).toHaveLength(2);
    expect(jwtSecretErrors('development', 'dev-secret', 'dev-refresh-secret')).toEqual([]);
  });
});

describe('platform admin URL validation', () => {
  it('requires a dedicated HTTPS origin in production', () => {
    expect(
      platformAdminUrlErrors('production', 'https://admin.samyoj.com')
    ).toEqual([]);
    expect(
      platformAdminUrlErrors('production', 'http://localhost:3001')
    ).toContain('PLATFORM_ADMIN_URL must use HTTPS in production');
    expect(
      platformAdminUrlErrors('production', 'https://admin.samyoj.com/path')
    ).toContain(
      'PLATFORM_ADMIN_URL must be an origin without a path, query, or credentials'
    );
  });
});
