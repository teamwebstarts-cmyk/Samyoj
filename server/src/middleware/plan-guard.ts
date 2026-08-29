import { Request, Response, NextFunction } from 'express';
import { PlanTier } from '../modules/billing/plans';
import {
  checkQuota,
  getOrgEntitlements,
  isTierSufficient,
  QuotaType,
  FeatureType,
  checkFeature,
} from '../modules/billing/entitlements.service';
import { AppError } from '../utils/response';
import { config } from '../config';

/** Local test-deploy: do not block product flows on expired demo plans. */
function bypassPlanGuardsForLocalTesting(): boolean {
  return config.nodeEnv === 'development';
}

/**
 * Middleware that blocks requests if the organization is in an expired, locked, or past_due state.
 */
export function requireActiveCommercial() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (bypassPlanGuardsForLocalTesting()) return next();
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return next(new AppError(401, 'Organization required'));
    }

    try {
      const entitlements = await getOrgEntitlements(orgId);
      if (entitlements.isLocked) {
        return sendPlanError(res, {
          code: 'SUBSCRIPTION_LOCKED',
          message: 'Your paid period has expired. Purchase a plan to continue.',
          requiredPlan: 'growth',
          upgradeCta: 'growth',
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Apply commercial expiry only to mutations; reads remain available for recovery. */
export function requireActiveCommercialOnMutation() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    return requireActiveCommercial()(req, res, next);
  };
}

/**
 * Middleware that requires an organization to be on at least the specified PlanTier.
 */
export function requirePlan(minTier: PlanTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (bypassPlanGuardsForLocalTesting()) return next();
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return next(new AppError(401, 'Organization required'));
    }

    try {
      const entitlements = await getOrgEntitlements(orgId);
      if (entitlements.isLocked) {
        return sendPlanError(res, {
          code: 'SUBSCRIPTION_LOCKED',
          message: 'Your paid period has expired. Purchase a plan to continue.',
          requiredPlan: minTier,
          upgradeCta: minTier,
        });
      }

      if (!isTierSufficient(entitlements.planTier, minTier)) {
        return sendPlanError(res, {
          code: 'PLAN_LIMIT',
          message: `This feature requires the ${minTier.charAt(0).toUpperCase() + minTier.slice(1)} plan or higher.`,
          currentPlan: entitlements.planTier,
          requiredPlan: minTier,
          upgradeCta: minTier,
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
    if (bypassPlanGuardsForLocalTesting()) return next();
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return next(new AppError(401, 'Organization required'));
    }

    try {
      const check = await checkQuota(orgId, quotaType, requestedCount);
      if (!check.allowed) {
        return sendPlanError(res, {
          code: check.code?.startsWith('PLAN_FEATURE') ? 'PLAN_FEATURE' : check.code || 'PLAN_LIMIT',
          message: check.reason || 'Plan limit reached. Please upgrade to continue.',
          quota: quotaType,
          used: check.used,
          limit: check.limit,
          upgradeCta: check.upgradeCta,
          requiredPlan: check.upgradeCta,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Guard a named entitlement before a mutating route runs. */
export function requireFeature(feature: FeatureType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (bypassPlanGuardsForLocalTesting()) return next();
    const orgId = req.user?.organizationId;
    if (!orgId) return next(new AppError(401, 'Organization required'));

    try {
      const check = await checkFeature(orgId, feature);
      // Expired organizations retain read-only access to their historical
      // data, including reports for features that were enabled in the paid
      // period. Mutation-specific callers still receive SUBSCRIPTION_LOCKED.
      if (
        check.code === 'SUBSCRIPTION_LOCKED' &&
        ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      ) {
        return next();
      }
      if (!check.allowed) {
        return sendPlanError(res, {
          code: check.code || 'PLAN_FEATURE',
          message: check.reason || 'This feature is not included in your plan.',
          requiredPlan: check.requiredPlan,
          upgradeCta: check.requiredPlan,
          quota: feature,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireFeatureOnMutation(feature: FeatureType) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    return requireFeature(feature)(req, res, next);
  };
}

function sendPlanError(
  res: Response,
  error: Record<string, unknown>
) {
  const requestId =
    typeof error.requestId === 'string'
      ? error.requestId
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return res.status(402).json({
    success: false,
    error: {
      ...error,
      requestId,
      correlationId: requestId,
    },
  });
}
