import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../utils/response';
import {
  platformRoleHasPermission,
  requirePlatformPermission,
} from './rbac';

function invoke(role: 'SUPER_ADMIN' | 'SUPPORT' | 'ANALYST', permission: Parameters<typeof requirePlatformPermission>[0]) {
  let result: unknown;
  const req = {
    platformOperator: {
      id: 'operator-1',
      email: 'ops@example.com',
      role,
      mfaEnabledAt: new Date(),
      disabledAt: null,
    },
  } as Request;
  const next: NextFunction = (error?: unknown) => {
    result = error;
  };
  requirePlatformPermission(permission)(req, {} as Response, next);
  return result;
}

describe('platform RBAC', () => {
  it('reserves operator and session management for SUPER_ADMIN', () => {
    expect(platformRoleHasPermission('SUPER_ADMIN', 'operators.manage')).toBe(true);
    expect(platformRoleHasPermission('SUPPORT', 'operators.manage')).toBe(false);
    expect(platformRoleHasPermission('ANALYST', 'sessions.manage')).toBe(false);
    expect(platformRoleHasPermission('SUPPORT', 'outreach.send')).toBe(true);
    expect(platformRoleHasPermission('ANALYST', 'outreach.send')).toBe(false);
  });

  it('allows SUPPORT writes but keeps ANALYST read-only', () => {
    expect(invoke('SUPPORT', 'organization.write')).toBeUndefined();

    const error = invoke('ANALYST', 'organization.write');
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(403);

    expect(invoke('ANALYST', 'organization.read')).toBeUndefined();
    expect(invoke('ANALYST', 'outreach.send')).toBeInstanceOf(AppError);
  });
});
