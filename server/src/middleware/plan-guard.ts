import { Request, Response, NextFunction } from 'express';
import { PlanTier } from '../modules/billing/plans';
import {
  checkQuota,
  getOrgEntitlements,
  isTierSufficient,
  QuotaType,
} from '../modules/billing/entitlements.service';
import { AppError } from '../utils/response';

/**
 * Middleware that blocks requests if the organization is in an expired, locked, or past_due state.
 */
export function requireActiveCommercial() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return next(new AppError(401, 'Organization required'));
    }

    try {
      const entitlements = await getOrgEntitlements(orgId);
      if (entitlements.isLocked) {
        return res.status(402).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_LOCKED',
            message: 'Your subscription or trial has expired. Upgrade your plan to continue.',
            upgradeCta: 'growth',
          },
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware that requires an organization to be on at least the specified PlanTier.
 */
export function requirePlan(minTier: PlanTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return next(new AppError(401, 'Organization required'));
    }

    try {
      const entitlements = await getOrgEntitlements(orgId);
      if (entitlements.isLocked) {
        return res.status(402).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_LOCKED',
            message: 'Your subscription or trial has expired. Upgrade your plan to continue.',
            upgradeCta: minTier,
          },
        });
      }

      if (!isTierSufficient(entitlements.planTier, minTier)) {
        return res.status(402).json({
          success: false,
          error: {
            code: 'PLAN_LIMIT',
            message: `This feature requires the ${minTier.charAt(0).toUpperCase() + minTier.slice(1)} plan or higher.`,
            currentPlan: entitlements.planTier,
            requiredPlan: minTier,
            upgradeCta: minTier,
          },
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware that checks a specific numeric or boolean quota before proceeding.
 */
export function requireQuota(quotaType: QuotaType, requestedCount = 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return next(new AppError(401, 'Organization required'));
    }

    try {
      const check = await checkQuota(orgId, quotaType, requestedCount);
      if (!check.allowed) {
        return res.status(402).json({
          success: false,
          error: {
            code: check.code || 'PLAN_LIMIT',
            message: check.reason || 'Plan limit reached. Please upgrade to continue.',
            quota: quotaType,
            used: check.used,
            limit: check.limit,
            upgradeCta: check.upgradeCta,
          },
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
