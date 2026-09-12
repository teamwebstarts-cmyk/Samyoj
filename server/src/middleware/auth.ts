import { Request, Response, NextFunction } from 'express';
import { OrgRole } from '@prisma/client';
import prisma from '../config/database';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { AppError } from '../utils/response';
import { readTenantAccessToken } from '../modules/auth/cookies';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgRole?: OrgRole;
    }
  }
}

export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return readTenantAccessToken(req);
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractAccessToken(req);
  if (!token) {
    return next(new AppError(401, 'Authentication required'));
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

/** True when the user is an OrganizationUser (or an org-bound API key). Same rule as HTTP requireOrg. */
export async function hasActiveOrgMembership(userId: string, organizationId: string): Promise<boolean> {
  // API keys are already bound to an organization; they are not OrganizationUsers.
  if (userId === 'api-key') return true;

  const membership = await prisma.organizationUser.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function requireOrg(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user?.organizationId) {
      return next(new AppError(403, 'Organization context required'));
    }

    if (req.user.userId === 'api-key') {
      return next();
    }

    const membership = await prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: req.user.organizationId,
          userId: req.user.userId,
        },
      },
      select: { id: true, mustResetPassword: true },
    });
    if (!membership) {
      return next(new AppError(403, 'Not a member of this organization'));
    }
    if (
      membership?.mustResetPassword &&
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.method !== 'OPTIONS' &&
      !isPasswordResetRequest(req)
    ) {
      return next(new AppError(403, 'Set a new password before continuing', 'MUST_RESET_PASSWORD'));
    }

    next();
  } catch (err) {
    next(err);
  }
}

function isPasswordResetRequest(req: Request): boolean {
  if (req.method !== 'POST') return false;
  const path = `${req.baseUrl || ''}${req.path || ''}`;
  return path.endsWith('/me/password') || path.endsWith('/team/me/password');
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractAccessToken(req);
  if (!token) return next();
  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Public routes still proceed without a session.
  }
  next();
}

export async function loadOrgRole(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user?.organizationId) {
      return next(new AppError(403, 'Organization context required'));
    }

    // API keys are org-bound integrations, not human OWNER/ADMIN members.
    if (req.user.userId === 'api-key') {
      return next(new AppError(403, 'Insufficient permissions'));
    }

    const membership = await prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: req.user.organizationId,
          userId: req.user.userId,
        },
      },
    });

    if (!membership) {
      return next(new AppError(403, 'Not a member of this organization'));
    }

    req.orgRole = membership.role;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireOrgRole(...roles: OrgRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.orgRole || !roles.includes(req.orgRole)) {
      return next(new AppError(403, 'Insufficient permissions'));
    }
    next();
  };
}

/** GET/HEAD stay member-readable. Mutations need a loaded OWNER/ADMIN role. */
export function requireAdminOnMutation(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  void loadOrgRole(req, res, (err) => {
    if (err) return next(err);
    requireOrgRole('OWNER', 'ADMIN')(req, res, next);
  });
}
