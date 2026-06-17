import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../../config/database';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../../utils/response';

const router = Router();

const brandKitSchema = z.object({
  companyName: z.string().min(1).max(200),
  logoPrimaryAssetId: z.string().uuid().optional().nullable(),
  logoMonoAssetId: z.string().uuid().optional().nullable(),
  colorPrimary: z.string().optional().nullable(),
  colorSecondary: z.string().optional().nullable(),
  colorAccent: z.string().optional().nullable(),
  fontHeading: z.string().optional().nullable(),
  fontBody: z.string().optional().nullable(),
  toneFormal: z.number().int().min(0).max(100).optional(),
  toneBrief: z.number().int().min(0).max(100).optional(),
  toneFriendly: z.number().int().min(0).max(100).optional(),
  tonePlayful: z.number().int().min(0).max(100).optional(),
  bannedWords: z.array(z.string()).optional(),
  mandatoryPhrases: z.array(z.string()).optional(),
  sampleLike: z.array(z.string()).optional(),
  sampleDislike: z.array(z.string()).optional(),
  audience: z.string().optional().nullable(),
  valueProps: z.array(z.string()).optional(),
  defaultLocale: z.string().optional(),
  locales: z.array(z.string()).optional(),
});

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { companyName: true },
    });

    let brandKit = await prisma.brandKit.findUnique({ where: { organizationId: orgId } });
    if (!brandKit) {
      brandKit = await prisma.brandKit.create({
        data: {
          organizationId: orgId,
          companyName: org?.companyName || 'My Company',
        },
      });
    }

    sendSuccess(res, brandKit);
  })
);

router.put(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = brandKitSchema.parse(req.body);

    const brandKit = await prisma.brandKit.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        ...data,
        logoPrimaryAssetId: data.logoPrimaryAssetId || undefined,
        logoMonoAssetId: data.logoMonoAssetId || undefined,
      },
      update: {
        ...data,
        logoPrimaryAssetId: data.logoPrimaryAssetId ?? undefined,
        logoMonoAssetId: data.logoMonoAssetId ?? undefined,
      },
    });

    sendSuccess(res, brandKit);
  })
);

export default router;
