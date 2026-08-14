import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler, AppError, paramId } from '../../utils/response';
import { computeSlaDueAt } from '../sla/service';

import { resolveActiveWhatsappNumber, ticketsForNumberFilter } from '../whatsapp/active-number';

const router = Router();

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber);

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

async function validateTicketScope(
  organizationId: string,
  whatsappNumberId: string,
  conversationId?: string,
  contactId?: string
) {
  const conversation = conversationId
    ? await prisma.conversation.findFirst({
        where: { id: conversationId, organizationId, whatsappNumberId },
        select: { id: true, contactId: true, whatsappNumberId: true },
      })
    : null;
  if (conversationId && !conversation) throw new AppError(400, 'Conversation does not belong to the active WhatsApp number');

  const contact = contactId
    ? await prisma.contact.findFirst({
        where: { id: contactId, organizationId, whatsappNumberId },
        select: { id: true },
      })
    : null;
  if (contactId && !contact) throw new AppError(400, 'Contact does not belong to the active WhatsApp number');
  if (conversation && contactId && conversation.contactId !== contactId) {
    throw new AppError(400, 'Ticket contact must match the conversation contact');
  }
}

router.get(
  '/',
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const status = req.query.status as string | undefined;

    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as never } : {}),
        ...ticketsForNumberFilter(numberId),
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
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before creating tickets');
    await validateTicketScope(orgId, whatsappNumberId, data.conversationId, data.contactId);

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: orgId,
        title: data.title,
        conversationId: data.conversationId,
        contactId: data.contactId,
        whatsappNumberId,
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
    const conversationId = req.params.conversationId as string;
    const { title, priority, category } = z
      .object({
        title: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        category: z.string().optional(),
      })
      .parse(req.body);

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
      include: { contact: true },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found');

    const ticket = await prisma.ticket.create({
      data: {
        organizationId: orgId,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        whatsappNumberId: conversation.whatsappNumberId,
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

    const existing = await prisma.ticket.findFirst({
      where: { id, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
    });
    if (!existing) throw new AppError(404, 'Ticket not found');
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before updating tickets');
    const conversationId = data.conversationId === undefined ? existing.conversationId : data.conversationId;
    const contactId = data.contactId === undefined ? existing.contactId : data.contactId;
    await validateTicketScope(
      orgId,
      whatsappNumberId,
      conversationId ?? undefined,
      contactId ?? undefined
    );

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.conversationId !== undefined ? { conversationId: data.conversationId } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
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

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const existing = await prisma.ticket.findFirst({
      where: { id, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
      select: { id: true },
    });
    if (!existing) throw new AppError(404, 'Ticket not found');
    await prisma.ticket.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  })
);

export default router;
