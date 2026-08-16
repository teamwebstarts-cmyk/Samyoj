import crypto from 'node:crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { config } from '../../config';
import { AppError } from '../../utils/response';

export const PLATFORM_SESSION_COOKIE = 'samyoj_platform_session';
export const PLATFORM_CSRF_COOKIE = 'samyoj_platform_csrf';
export const PLATFORM_CSRF_HEADER = 'x-platform-csrf-token';
export const PLATFORM_COOKIE_PATH = '/api/platform';
/** Readable CSRF cookie must be Path=/ so the admin SPA can send the header. */
export const PLATFORM_CSRF_COOKIE_PATH = '/';

export function randomOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashPlatformToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};

  return header.split(';').reduce<Record<string, string>>((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return cookies;

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      // Ignore malformed cookie values instead of treating them as credentials.
    }
    return cookies;
  }, {});
}

export function platformCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: PLATFORM_COOKIE_PATH,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function platformCsrfCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: false,
    sameSite: 'strict',
    secure: config.nodeEnv === 'production',
    path: PLATFORM_CSRF_COOKIE_PATH,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function setPlatformSessionCookies(
  res: Response,
  sessionToken: string,
  csrfToken: string,
  expiresAt: Date
): void {
  res.cookie(
    PLATFORM_SESSION_COOKIE,
    sessionToken,
    platformCookieOptions(expiresAt)
  );
  setPlatformCsrfCookie(res, csrfToken, expiresAt);
}

export function setPlatformCsrfCookie(
  res: Response,
  csrfToken: string,
  expiresAt: Date
): void {
  res.cookie(PLATFORM_CSRF_COOKIE, csrfToken, platformCsrfCookieOptions(expiresAt));
}

export function clearPlatformSessionCookies(res: Response): void {
  res.clearCookie(PLATFORM_SESSION_COOKIE, platformCookieOptions());
  res.clearCookie(PLATFORM_CSRF_COOKIE, platformCsrfCookieOptions());
}

function requestOrigin(req: Request): string | null {
  const origin = req.get('origin');
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }

  const referer = req.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Browser writes are accepted only from the configured admin origin. This also
 * protects pre-session writes (login) where a session-bound CSRF token cannot
 * exist yet.
 */
export function requirePlatformMutationOrigin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    next();
    return;
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(config.platformAdminUrl).origin;
  } catch {
    next(new AppError(500, 'Platform admin origin is not configured'));
    return;
  }

  if (requestOrigin(req) !== expectedOrigin) {
    next(new AppError(403, 'Platform request origin rejected', 'PLATFORM_ORIGIN_REJECTED'));
    return;
  }

  next();
}
