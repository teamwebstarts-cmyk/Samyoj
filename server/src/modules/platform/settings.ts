import { type Request, type Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { asyncHandler, sendSuccess } from '../../utils/response';
import { requirePlatformPermission } from './rbac';
import { PLAN_TIERS, BILLING_SKUS } from '../billing/plans';

const configSchema = z.object({
  planTiers: z.record(z.string(), z.any()),
  billingSkus: z.array(z.any()),
});

export const getPlatformSettings = asyncHandler(
  async (req: Request, res: Response) => {
    requirePlatformPermission(req.platformOperator, 'SUPER_ADMIN');

    const setting = await prisma.platformSetting.findUnique({
      where: { key: 'BILLING_CONFIG' },
    });

    if (!setting) {
      // Return defaults if none in DB
      sendSuccess(res, { planTiers: PLAN_TIERS, billingSkus: BILLING_SKUS });
      return;
    }

    sendSuccess(res, setting.value);
  }
);

export const patchPlatformSettings = asyncHandler(
  async (req: Request, res: Response) => {
    requirePlatformPermission(req.platformOperator, 'SUPER_ADMIN');

    const data = configSchema.parse(req.body);

    const setting = await prisma.platformSetting.upsert({
      where: { key: 'BILLING_CONFIG' },
      update: { value: data },
      create: { key: 'BILLING_CONFIG', value: data },
    });

    sendSuccess(res, setting.value);
  }
);
