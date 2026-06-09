import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../utils/response';
import { resolvePermissions, type TeamPermissions } from '../modules/team/types';

declare global {
  namespace Express {
    interface Request {
      permissions?: TeamPermissions;
    }
  }
}

export async function loadPermissions(req: Request, _res: Response, next: NextFunction) {
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
    req.permissions = resolvePermissions(
      membership.role,
      membership.permissions as Record<string, boolean> | null
    );
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(...keys: (keyof TeamPermissions)[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.permissions) {
      return next(new AppError(403, 'Permissions not loaded'));
    }
    const allowed = keys.some((key) => req.permissions![key]);
    if (!allowed) {
      return next(new AppError(403, 'Insufficient permissions'));
    }
    next();
  };
}
