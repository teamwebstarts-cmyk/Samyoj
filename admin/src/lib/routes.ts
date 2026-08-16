import { can, type PlatformPermission } from './rbac';
import type { PlatformRole } from '../types';

export const PUBLIC_PATHS = ['/login'] as const;

export const NAV_ITEMS = [
  { to: '/', label: 'Overview', permission: 'platform.read' as const },
  { to: '/accounts', label: 'Accounts', permission: 'organization.read' as const },
  { to: '/errors', label: 'Errors', permission: 'errors.read' as const },
  { to: '/outreach', label: 'Outreach', permission: 'outreach.send' as const },
  { to: '/operators', label: 'Operators', permission: 'operators.manage' as const },
  { to: '/audit', label: 'Audit', permission: 'audit.read' as const },
] as const;

export function isPublicPath(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login?');
}

export function isProtectedPath(pathname: string): boolean {
  return !isPublicPath(pathname);
}

export function permissionForPath(pathname: string): PlatformPermission {
  if (pathname.startsWith('/accounts')) return 'organization.read';
  const exact = NAV_ITEMS.find((item) => item.to === pathname);
  return exact?.permission ?? 'platform.read';
}

export function canAccessPath(role: PlatformRole, pathname: string): boolean {
  if (isPublicPath(pathname)) return true;
  return can(role, permissionForPath(pathname));
}

export function visibleNav(role: PlatformRole) {
  return NAV_ITEMS.filter((item) => can(role, item.permission));
}
