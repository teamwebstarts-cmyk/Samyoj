import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/response';
import {
  readTenantAccessToken,
  readTenantRefreshToken,
  tenantCsrfIsValid,
} from '../modules/auth/cookies';

const EXEMPT_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/oauth/',
  '/api/whatsapp/webhook',
  '/api/billing/webhook',
  '/api/flows-assets/webhook/',
  '/api/v1/',
];

/** Path-boundary match so `/api/whatsapp/webhook-replay` is not CSRF-exempt. */
export function isTenantCsrfExemptPath(path: string): boolean {
  return EXEMPT_PREFIXES.some((prefix) => {
    if (path === prefix) return true;
    return path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
  });
}

/**
 * Double-submit CSRF for cookie-based tenant sessions. Bearer-authenticated
 * requests (API keys, legacy clients) skip this check.
 */
export function requireTenantCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    next();
    return;
  }

  const path = req.path || '';
  if (isTenantCsrfExemptPath(path)) {
    next();
    return;
  }

  const bearer = req.headers.authorization;
  if (bearer?.startsWith('Bearer ') && bearer.length > 7) {
    next();
    return;
  }

  if (!readTenantAccessToken(req) && !readTenantRefreshToken(req)) {
    next();
    return;
  }

  if (!tenantCsrfIsValid(req)) {
    next(new AppError(403, 'Invalid CSRF token', 'CSRF_REJECTED'));
    return;
  }

  next();
}
