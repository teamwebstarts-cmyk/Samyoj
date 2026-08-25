import crypto from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { config } from '../../config';
import { constantTimeEqual, parseCookieHeader } from '../platform/security';
import { parseExpiry } from '../../utils/jwt';

export const TENANT_ACCESS_COOKIE = 'samyoj_access';
export const TENANT_REFRESH_COOKIE = 'samyoj_refresh';
export const TENANT_CSRF_COOKIE = 'samyoj_csrf';
export const TENANT_CSRF_HEADER = 'x-csrf-token';
export const TENANT_COOKIE_PATH = '/api';
/** Readable CSRF cookie must be Path=/ so the SPA can send the header. */
export const TENANT_CSRF_COOKIE_PATH = '/';

export function newCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function tenantCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: TENANT_COOKIE_PATH,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

function tenantCsrfCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: false,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: TENANT_CSRF_COOKIE_PATH,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function setTenantAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  csrfToken: string
): void {
  const accessExpires = parseExpiry(config.jwt.expiresIn);
  const refreshExpires = parseExpiry(config.jwt.refreshExpiresIn);
  res.cookie(TENANT_ACCESS_COOKIE, accessToken, tenantCookieOptions(accessExpires));
  res.cookie(TENANT_REFRESH_COOKIE, refreshToken, tenantCookieOptions(refreshExpires));
  res.cookie(TENANT_CSRF_COOKIE, csrfToken, tenantCsrfCookieOptions(refreshExpires));
}

export function clearTenantAuthCookies(res: Response): void {
  res.clearCookie(TENANT_ACCESS_COOKIE, tenantCookieOptions());
  res.clearCookie(TENANT_REFRESH_COOKIE, tenantCookieOptions());
  res.clearCookie(TENANT_CSRF_COOKIE, tenantCsrfCookieOptions());
}

export function readTenantAccessToken(req: Request): string | null {
  return parseCookieHeader(req.headers.cookie)[TENANT_ACCESS_COOKIE] ?? null;
}

export function readTenantRefreshToken(req: Request): string | null {
  return parseCookieHeader(req.headers.cookie)[TENANT_REFRESH_COOKIE] ?? null;
}

export function readTenantCsrfFromRequest(req: Request): { cookie: string; header: string } {
  const cookies = parseCookieHeader(req.headers.cookie);
  return {
    cookie: cookies[TENANT_CSRF_COOKIE] ?? '',
    header: req.get(TENANT_CSRF_HEADER) ?? '',
  };
}

export function tenantCsrfIsValid(req: Request): boolean {
  const { cookie, header } = readTenantCsrfFromRequest(req);
  return Boolean(cookie && header && constantTimeEqual(cookie, header));
}
