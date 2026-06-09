import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';

const router = Router();

const cannedReplySchema = z.object({
  shortcut: z.string().min(1).max(30).regex(/^[a-z0-9_-]+$/i),
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(4000),
});

router.get(
  '/',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const search = (req.query.search as string) || '';

    const replies = await prisma.cannedReply.findMany({
      where: {
        organizationId: orgId,
        ...(search
          ? {
              OR: [
                { shortcut: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { shortcut: 'asc' },
    });
    sendSuccess(res, { replies });
  })
);

router.post(
  '/',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = cannedReplySchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const reply = await prisma.cannedReply.create({
      data: {
        organizationId: orgId,
        shortcut: data.shortcut.toLowerCase(),
        title: data.title.trim(),
        content: data.content,
      },
    });
    sendSuccess(res, reply, 201);
  })
);

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = cannedReplySchema.partial().parse(req.body);
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const existing = await prisma.cannedReply.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Canned reply not found');

    const reply = await prisma.cannedReply.update({
      where: { id },
      data: {
        ...(data.shortcut !== undefined ? { shortcut: data.shortcut.toLowerCase() } : {}),
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.content !== undefined ? { content: data.content } : {}),
      },
    });
    sendSuccess(res, reply);
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const existing = await prisma.cannedReply.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Canned reply not found');

    await prisma.cannedReply.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  })
);

export default router;
