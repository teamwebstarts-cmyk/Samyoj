import type { PlatformRole } from '../types';

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
  ANALYST: new Set(['platform.read', 'organization.read', 'errors.read', 'audit.read']),
};

export function can(role: PlatformRole, permission: PlatformPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function isWriteRole(role: PlatformRole): boolean {
  return can(role, 'organization.write');
}
