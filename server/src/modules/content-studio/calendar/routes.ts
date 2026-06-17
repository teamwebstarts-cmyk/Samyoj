import { Router, Request, Response } from 'express';
import prisma from '../../../config/database';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { sendSuccess, asyncHandler } from '../../../utils/response';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const from = req.query.from ? new Date(req.query.from as string) : new Date();
    const to = req.query.to
      ? new Date(req.query.to as string)
      : new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      from.setHours(0, 0, 0, 0);
      to.setTime(from.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    const [drafts, assets, jobs] = await Promise.all([
      prisma.contentDraft.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: from, lte: to },
          status: { in: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED'] },
        },
        select: {
          id: true,
          kind: true,
          status: true,
          body: true,
          locale: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.mediaAsset.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: from, lte: to },
          status: { not: 'ARCHIVED' },
        },
        select: {
          id: true,
          kind: true,
          status: true,
          prompt: true,
          publicUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.generationJob.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          kind: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const events = [
      ...drafts.map((d) => ({
        id: d.id,
        type: 'draft' as const,
        title: `${d.kind} (${d.status})`,
        body: d.body.slice(0, 120),
        status: d.status,
        at: d.createdAt,
      })),
      ...assets.map((a) => ({
        id: a.id,
        type: 'asset' as const,
        title: `${a.kind} (${a.status})`,
        body: a.prompt?.slice(0, 120) || '',
        status: a.status,
        at: a.createdAt,
      })),
      ...jobs.map((j) => ({
        id: j.id,
        type: 'job' as const,
        title: `${j.kind} generation`,
        body: j.status,
        status: j.status,
        at: j.createdAt,
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    sendSuccess(res, { from, to, events });
  })
);

export default router;
