import { Router, Request, Response } from 'express';
import { ContentDraftStatus, MediaAssetStatus } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../config/database';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../../utils/response';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;

    const [drafts, assets] = await Promise.all([
      prisma.contentDraft.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['IN_REVIEW', 'DRAFT'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      prisma.mediaAsset.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['IN_REVIEW', 'DRAFT'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    sendSuccess(res, {
      queue: [
        ...drafts.map((d) => ({
          resourceKind: 'content_draft',
          resourceId: d.id,
          status: d.status,
          preview: d.body.slice(0, 160),
          updatedAt: d.updatedAt,
        })),
        ...assets.map((a) => ({
          resourceKind: 'media_asset',
          resourceId: a.id,
          status: a.status,
          preview: a.prompt?.slice(0, 160) || a.kind,
          updatedAt: a.updatedAt,
        })),
      ],
    });
  })
);

const actionSchema = z.object({
  resourceKind: z.enum(['content_draft', 'media_asset']),
  resourceId: z.string().uuid(),
  action: z.enum(['submitted', 'approved', 'rejected', 'comment']),
  comment: z.string().max(1000).optional(),
});

router.post(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const data = actionSchema.parse(req.body);

    if (data.resourceKind === 'content_draft') {
      const draft = await prisma.contentDraft.findFirst({
        where: { id: data.resourceId, organizationId: orgId },
      });
      if (!draft) throw new AppError(404, 'Draft not found');

      let newStatus: ContentDraftStatus = draft.status;
      if (data.action === 'submitted') newStatus = 'IN_REVIEW';
      if (data.action === 'approved') newStatus = 'APPROVED';
      if (data.action === 'rejected') newStatus = 'REJECTED';

      await prisma.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: newStatus,
          ...(data.action === 'approved'
            ? { approvedById: userId, approvedAt: new Date() }
            : {}),
        },
      });
    } else {
      const asset = await prisma.mediaAsset.findFirst({
        where: { id: data.resourceId, organizationId: orgId },
      });
      if (!asset) throw new AppError(404, 'Asset not found');

      let newStatus: MediaAssetStatus = asset.status;
      if (data.action === 'submitted') newStatus = 'IN_REVIEW';
      if (data.action === 'approved') newStatus = 'APPROVED';
      if (data.action === 'rejected') newStatus = 'ARCHIVED';

      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: newStatus },
      });
    }

    const log = await prisma.approvalLog.create({
      data: {
        organizationId: orgId,
        resourceKind: data.resourceKind,
        resourceId: data.resourceId,
        action: data.action,
        actorId: userId,
        comment: data.comment,
      },
    });

    sendSuccess(res, log, 201);
  })
);

router.get(
  '/history',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const resourceKind = req.query.resourceKind as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;

    const logs = await prisma.approvalLog.findMany({
      where: {
        organizationId: orgId,
        ...(resourceKind ? { resourceKind } : {}),
        ...(resourceId ? { resourceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    sendSuccess(res, { logs });
  })
);

export default router;
