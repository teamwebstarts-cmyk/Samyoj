import { Router, Request, Response } from 'express';
import { MediaAssetKind, MediaAssetStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../config/database';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../../utils/response';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const kind = req.query.kind as MediaAssetKind | undefined;
    const status = req.query.status as MediaAssetStatus | undefined;
    const search = (req.query.search as string) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, parseInt((req.query.limit as string) || '50', 10));
    const skip = (page - 1) * limit;

    const where: Prisma.MediaAssetWhereInput = {
      organizationId: orgId,
      ...(kind ? { kind } : {}),
      ...(status ? { status } : { status: { not: MediaAssetStatus.ARCHIVED } }),
      ...(search
        ? {
            OR: [
              { prompt: { contains: search, mode: 'insensitive' as const } },
              { tags: { has: search } },
              { folder: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.mediaAsset.count({ where }),
    ]);

    sendSuccess(res, { assets, total, page, limit });
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
    });
    if (!asset) throw new AppError(404, 'Asset not found');
    sendSuccess(res, asset);
  })
);

const patchSchema = z.object({
  status: z.nativeEnum(MediaAssetStatus).optional(),
  tags: z.array(z.string()).optional(),
  folder: z.string().optional().nullable(),
});

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = patchSchema.parse(req.body);

    const existing = await prisma.mediaAsset.findFirst({
      where: { id: paramId(req), organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Asset not found');

    const asset = await prisma.mediaAsset.update({
      where: { id: existing.id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.folder !== undefined ? { folder: data.folder } : {}),
      },
    });

    sendSuccess(res, asset);
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const existing = await prisma.mediaAsset.findFirst({
      where: { id: paramId(req), organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Asset not found');

    await prisma.mediaAsset.update({
      where: { id: existing.id },
      data: { status: 'ARCHIVED' },
    });

    sendSuccess(res, { archived: true });
  })
);

export default router;
