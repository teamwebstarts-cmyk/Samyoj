import type { NextFunction, Request, Response } from 'express';
import type { PlatformRole } from '@prisma/client';
import { AppError } from '../../utils/response';

export const PLATFORM_PERMISSIONS = [
  'platform.read',
  'organization.read',
  'organization.write',
  'errors.read',
  'outreach.send',
  'operators.manage',
  'sessions.manage',
  'audit.read',
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<PlatformRole, ReadonlySet<PlatformPermission>> = {
  SUPER_ADMIN: new Set(PLATFORM_PERMISSIONS),
  SUPPORT: new Set([
    'platform.read',
    'organization.read',
    'organization.write',
    'errors.read',
    'outreach.send',
    'audit.read',
  ]),
  ANALYST: new Set([
    'platform.read',
    'organization.read',
    'errors.read',
    'audit.read',
  ]),
};

export function platformRoleHasPermission(
  role: PlatformRole,
  permission: PlatformPermission
): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function requirePlatformRole(...roles: PlatformRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const operator = req.platformOperator;
    if (!operator) {
      next(new AppError(401, 'Platform authentication required'));
      return;
    }
    if (!roles.includes(operator.role)) {
      next(new AppError(403, 'Insufficient platform permissions'));
      return;
    }
    next();
  };
}

export function requirePlatformPermission(permission: PlatformPermission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const operator = req.platformOperator;
    if (!operator) {
      next(new AppError(401, 'Platform authentication required'));
      return;
    }
    if (!platformRoleHasPermission(operator.role, permission)) {
      next(new AppError(403, 'Insufficient platform permissions'));
      return;
    }
    next();
  };
}
