import type { NextFunction, Request, Response } from 'express';
import type { PlatformRole } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import {
  constantTimeEqual,
  hashPlatformToken,
  parseCookieHeader,
  PLATFORM_CSRF_COOKIE,
  PLATFORM_CSRF_HEADER,
} from './security';
import { platformSessionToken } from './session';

export interface PlatformRequestOperator {
  id: string;
  email: string;
  role: PlatformRole;
  mfaEnabledAt: Date | null;
  disabledAt: Date | null;
}

export interface PlatformRequestSession {
  id: string;
  operatorId: string;
  csrfTokenHash: string;
  mfaVerifiedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

const PRE_MFA_PLATFORM_AUTH_ROUTES = new Set([
  'POST /auth/login',
  'POST /auth/mfa/enroll',
  'GET /auth/csrf',
  'POST /auth/logout',
]);

declare global {
  namespace Express {
    interface Request {
      platformOperator?: PlatformRequestOperator;
      platformSession?: PlatformRequestSession;
    }
  }
}

async function resolvePlatformSession(req: Request): Promise<void> {
  const rawToken = platformSessionToken(req);
  if (!rawToken) {
    throw new AppError(401, 'Platform authentication required');
  }

  const session = await prisma.platformSession.findUnique({
    where: { tokenHash: hashPlatformToken(rawToken) },
    select: {
      id: true,
      operatorId: true,
      csrfTokenHash: true,
      mfaVerifiedAt: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      operator: {
        select: {
          id: true,
          email: true,
          role: true,
          mfaEnabledAt: true,
          disabledAt: true,
        },
      },
    },
  });

  const now = new Date();
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.operator.disabledAt
  ) {
    throw new AppError(401, 'Invalid or expired platform session');
  }

  req.platformSession = {
    id: session.id,
    operatorId: session.operatorId,
    csrfTokenHash: session.csrfTokenHash,
    mfaVerifiedAt: session.mfaVerifiedAt,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
  };
  req.platformOperator = session.operator;

  if (now.getTime() - session.lastSeenAt.getTime() >= 5 * 60 * 1000) {
    void prisma.platformSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      })
      .catch(() => {
        // Authentication succeeded; a best-effort activity timestamp must not
        // turn a healthy session into a platform outage.
      });
  }
}

export async function loadPlatformSession(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await resolvePlatformSession(req);
    next();
  } catch (error) {
    next(error);
  }
}

export async function authenticatePlatform(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await resolvePlatformSession(req);
    if (
      !req.platformOperator?.mfaEnabledAt ||
      !req.platformSession?.mfaVerifiedAt
    ) {
      throw new AppError(403, 'Platform MFA verification required', 'PLATFORM_MFA_REQUIRED');
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePlatformCsrf(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const session = req.platformSession;
  if (!session) {
    next(new AppError(401, 'Platform authentication required'));
    return;
  }

  const headerToken = req.get(PLATFORM_CSRF_HEADER) ?? '';
  const cookieToken =
    parseCookieHeader(req.headers.cookie)[PLATFORM_CSRF_COOKIE] ?? '';

  if (
    !headerToken ||
    !cookieToken ||
    !constantTimeEqual(headerToken, cookieToken) ||
    !constantTimeEqual(hashPlatformToken(headerToken), session.csrfTokenHash)
  ) {
    next(new AppError(403, 'Invalid platform CSRF token', 'PLATFORM_CSRF_REJECTED'));
    return;
  }

  next();
}

/**
 * Mount after unauthenticated login. Every later mutating platform route then
 * receives both session loading and session-bound double-submit CSRF checks.
 */
export function requireSessionBoundPlatformMutation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
    next();
    return;
  }
  if (req.method.toUpperCase() === 'POST' && req.path === '/auth/login') {
    next();
    return;
  }

  void loadPlatformSession(req, res, (sessionError?: unknown) => {
    if (sessionError) {
      next(sessionError);
      return;
    }
    requirePlatformCsrf(req, res, next);
  });
}

/**
 * Exact pre-MFA auth exemptions. Every other platform path is authenticated
 * here before route matching, so route registration order cannot bypass MFA.
 */
export function requirePlatformRouteAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method.toUpperCase() === 'OPTIONS') {
    next();
    return;
  }

  const routeKey = `${req.method.toUpperCase()} ${req.path}`;
  if (PRE_MFA_PLATFORM_AUTH_ROUTES.has(routeKey)) {
    next();
    return;
  }

  void authenticatePlatform(req, res, next);
}
