import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { emitToOrg } from '../../realtime';
import { resolveActiveWhatsappNumber, conversationFilter } from '../whatsapp/active-number';

const router = Router();

const labelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

router.get(
  '/',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const labels = await prisma.label.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            conversations: {
              where: { conversation: conversationFilter(req.activeWhatsappNumberId) },
            },
          },
        },
      },
    });
    sendSuccess(res, {
      labels: labels.map(({ _count, ...label }) => ({
        ...label,
        conversationCount: _count.conversations,
      })),
    });
  })
);

router.post(
  '/',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = labelSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const existing = await prisma.label.findFirst({
      where: { organizationId: orgId, name: { equals: data.name, mode: 'insensitive' } },
    });
    if (existing) throw new AppError(409, 'Label already exists');

    const label = await prisma.label.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        color: data.color || '#6366f1',
      },
    });
    sendSuccess(res, label, 201);
  })
);

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = labelSchema.partial().parse(req.body);
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const label = await prisma.label.findFirst({ where: { id, organizationId: orgId } });
    if (!label) throw new AppError(404, 'Label not found');

    const updated = await prisma.label.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
      },
    });
    sendSuccess(res, updated);
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const label = await prisma.label.findFirst({ where: { id, organizationId: orgId } });
    if (!label) throw new AppError(404, 'Label not found');

    await prisma.label.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  })
);

router.post(
  '/conversations/:conversationId',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const { labelId } = z.object({ labelId: z.string().uuid() }).parse(req.body);
    const orgId = req.user!.organizationId!;
    const conversationId = req.params.conversationId as string;

    const [conversation, label] = await Promise.all([
      prisma.conversation.findFirst({
        where: { id: conversationId, organizationId: orgId, ...conversationFilter(req.activeWhatsappNumberId) },
      }),
      prisma.label.findFirst({ where: { id: labelId, organizationId: orgId } }),
    ]);
    if (!conversation) throw new AppError(404, 'Conversation not found');
    if (!label) throw new AppError(404, 'Label not found');

    await prisma.conversationLabel.upsert({
      where: { conversationId_labelId: { conversationId, labelId } },
      create: { conversationId, labelId },
      update: {},
    });

    const labels = await prisma.conversationLabel.findMany({
      where: { conversationId },
      include: { label: true },
    });
    emitToOrg(orgId, 'conversation:updated', {
      conversationId,
      patch: { labels },
    });
    sendSuccess(res, { labels });
  })
);

router.delete(
  '/conversations/:conversationId/:labelId',
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const conversationId = req.params.conversationId as string;
    const labelId = req.params.labelId as string;

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: orgId, ...conversationFilter(req.activeWhatsappNumberId) },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const label = await prisma.label.findFirst({ where: { id: labelId, organizationId: orgId } });
    if (!label) throw new AppError(404, 'Label not found');
    await prisma.conversationLabel.deleteMany({ where: { conversationId, labelId } });

    const labels = await prisma.conversationLabel.findMany({
      where: { conversationId },
      include: { label: true },
    });
    emitToOrg(orgId, 'conversation:updated', {
      conversationId,
      patch: { labels },
    });
    sendSuccess(res, { labels });
  })
);

export default router;
