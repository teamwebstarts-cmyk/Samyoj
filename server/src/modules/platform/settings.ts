import { type Request, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { asyncHandler, sendSuccess, AppError } from '../../utils/response';
import { PLAN_TIERS, BILLING_SKUS } from '../billing/plans';
import { billingConfigSchema, parseBillingConfig, refreshBillingConfig } from '../billing/config';

function assertSuperAdmin(req: Request) {
  if (req.platformOperator?.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Insufficient platform permissions');
  }
}

export const getPlatformSettings = asyncHandler(
  async (req: Request, res: Response) => {
    assertSuperAdmin(req);

    const setting = await prisma.platformSetting.findUnique({
      where: { key: 'BILLING_CONFIG' },
    });

    if (!setting) {
      sendSuccess(res, { planTiers: PLAN_TIERS, billingSkus: BILLING_SKUS });
      return;
    }

    sendSuccess(res, setting.value);
  }
);

export const patchPlatformSettings = asyncHandler(
  async (req: Request, res: Response) => {
    assertSuperAdmin(req);

    const data = billingConfigSchema.parse(req.body);
    parseBillingConfig(data);

    const setting = await prisma.platformSetting.upsert({
      where: { key: 'BILLING_CONFIG' },
      update: { value: data as unknown as Prisma.InputJsonValue },
      create: { key: 'BILLING_CONFIG', value: data as unknown as Prisma.InputJsonValue },
    });

    // Apply the updated config immediately across the running backend instances
    // In a multi-tenant environment, you'd broadcast this via Redis PubSub,
    // but here we just call refresh locally.
    await refreshBillingConfig();

    sendSuccess(res, setting.value);
  }
);
