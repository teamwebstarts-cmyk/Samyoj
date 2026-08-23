import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../utils/response';
import { resolvePermissions, DEFAULT_PERMISSIONS, type TeamPermissions } from '../modules/team/types';

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

    // Org API keys are integration credentials — bypass the human role matrix.
    if (req.user.userId === 'api-key') {
      req.orgRole = 'ADMIN';
      req.permissions = { ...DEFAULT_PERMISSIONS.ADMIN };
      return next();
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

    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      select: { settings: true },
    });
    const teamSettings = ((org?.settings as Record<string, unknown>) || {}).team as
      | { rolePermissions?: Partial<Record<string, Partial<TeamPermissions>>> }
      | undefined;

    req.orgRole = membership.role;
    req.permissions = resolvePermissions(
      membership.role,
      membership.permissions as Record<string, boolean> | null,
      teamSettings?.rolePermissions ?? null
    );
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(...keys: (keyof TeamPermissions)[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.orgRole === 'OWNER') {
      return next();
    }
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

/** Load org permissions and enforce one or more feature keys (Owner always passes). */
export function withPermission(...keys: (keyof TeamPermissions)[]) {
  return [loadPermissions, requirePermission(...keys)];
}
