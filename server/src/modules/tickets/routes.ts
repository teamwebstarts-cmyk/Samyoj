import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler, AppError, paramId } from '../../utils/response';
import { computeSlaDueAt } from '../sla/service';

const router = Router();

const ticketSchema = z.object({
  title: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'PENDING', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().optional(),
  assignedAgentId: z.string().uuid().optional(),
  slaDueAt: z.string().datetime().optional(),
});

router.get(
  '/',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const status = req.query.status as string | undefined;

    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
        conversation: { select: { id: true, status: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    sendSuccess(res, { tickets });
  })
);

router.post(
  '/',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = ticketSchema.parse(req.body);

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: orgId,
        title: data.title,
        conversationId: data.conversationId,
        contactId: data.contactId,
        status: data.status || 'OPEN',
        priority: data.priority || 'MEDIUM',
        category: data.category,
        assignedAgentId: data.assignedAgentId,
        slaDueAt: data.slaDueAt ? new Date(data.slaDueAt) : computeSlaDueAt(),
      },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
        conversation: { select: { id: true, status: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    sendSuccess(res, ticket, 201);
  })
);

router.post(
  '/from-conversation/:conversationId',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const conversationId = paramId(req);
    const { title, priority, category } = z
      .object({
        title: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        category: z.string().optional(),
      })
      .parse(req.body);

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: orgId },
      include: { contact: true },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: orgId,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        title: title || `Ticket: ${conversation.contact.name || conversation.contact.phone}`,
        priority: priority || 'MEDIUM',
        category,
        slaDueAt: computeSlaDueAt(),
      },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
        conversation: { select: { id: true, status: true } },
      },
    });

    sendSuccess(res, ticket, 201);
  })
);

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const data = ticketSchema.partial().parse(req.body);

    const existing = await prisma.ticket.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Ticket not found');

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.assignedAgentId !== undefined ? { assignedAgentId: data.assignedAgentId } : {}),
        ...(data.slaDueAt !== undefined ? { slaDueAt: new Date(data.slaDueAt) } : {}),
      },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
        conversation: { select: { id: true, status: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    sendSuccess(res, ticket);
  })
);

export default router;
