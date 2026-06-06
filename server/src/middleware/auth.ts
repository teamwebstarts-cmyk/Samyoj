import { Request, Response, NextFunction } from 'express';
import { OrgRole } from '@prisma/client';
import prisma from '../config/database';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { AppError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgRole?: OrgRole;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Authentication required'));
  }

  try {
    const token = authHeader.slice(7);
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

export function requireOrg(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.organizationId) {
    return next(new AppError(403, 'Organization context required'));
  }
  next();
}

export async function loadOrgRole(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user?.organizationId) {
      return next(new AppError(403, 'Organization context required'));
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
