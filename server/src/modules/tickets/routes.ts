import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler, AppError, paramId } from '../../utils/response';
import { computeSlaDueAt } from '../sla/service';
import { emitToOrg } from '../../realtime';
import { emitTicketEvent } from './events';

import { resolveActiveWhatsappNumber, ticketsForNumberFilter } from '../whatsapp/active-number';

const router = Router();

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber);

const ticketInclude = {
  contact: { select: { id: true, phone: true, name: true } },
  conversation: {
    select: {
      id: true,
      status: true,
      // The "private note" from the create-ticket modal is stored as the
      // conversation's most recent internal note. Surface it on the ticket so
      // the sidebar can show it back to the team.
      internalNotes: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      },
    },
  },
  assignedAgent: { select: { id: true, name: true } },
} as const;

const ticketSchema = z.object({
  title: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  status: z.enum(['OPEN', 'PENDING', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  category: z.string().optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
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

async function assertAgentInOrg(organizationId: string, userId: string) {
  const member = await prisma.organizationUser.findFirst({
    where: { organizationId, userId },
    select: { userId: true },
  });
  if (!member) throw new AppError(400, 'That teammate is not in this workspace');
}

async function saveTicketNote(params: {
  conversationId: string;
  userId?: string;
  content?: string;
  organizationId: string;
  whatsappNumberId?: string | null;
}) {
  const content = params.content?.trim();
  const userId = params.userId;
  if (!content || !userId || userId === 'api-key') return;

  try {
    await prisma.internalNote.create({
      data: {
        conversationId: params.conversationId,
        userId,
        content,
      },
    });
    emitToOrg(params.organizationId, 'conversation:updated', {
      conversationId: params.conversationId,
      whatsappNumberId: params.whatsappNumberId ?? null,
    });
  } catch {
    // Ticket still created if the private note cannot be saved.
  }
}

router.get(
  '/',
  loadPermissions,
  requirePermission('manageTickets'),
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
      include: ticketInclude,
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
  requirePermission('manageTickets'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = ticketSchema.parse(req.body);
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before creating tickets');
    await validateTicketScope(orgId, whatsappNumberId, data.conversationId, data.contactId);
    if (data.assignedAgentId) await assertAgentInOrg(orgId, data.assignedAgentId);

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
        assignedAgentId: data.assignedAgentId ?? undefined,
        slaDueAt: data.slaDueAt ? new Date(data.slaDueAt) : computeSlaDueAt(),
      },
      include: ticketInclude,
    });

    emitTicketEvent(orgId, 'ticket:new', ticket);
    sendSuccess(res, ticket, 201);
  })
);

router.post(
  '/from-conversation/:conversationId',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageTickets'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const conversationId = req.params.conversationId as string;
    const { title, priority, category, description } = z
      .object({
        title: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        category: z.string().optional(),
        description: z.string().max(2000).optional(),
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
      include: ticketInclude,
    });

    await saveTicketNote({
      conversationId: conversation.id,
      userId: req.user?.userId,
      content: description,
      organizationId: orgId,
      whatsappNumberId: conversation.whatsappNumberId,
    });

    emitTicketEvent(orgId, 'ticket:new', ticket);
    sendSuccess(res, ticket, 201);
  })
);

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageTickets'),
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
    if (data.assignedAgentId) await assertAgentInOrg(orgId, data.assignedAgentId);

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
      include: ticketInclude,
    });

    emitTicketEvent(orgId, 'ticket:updated', ticket);
    sendSuccess(res, ticket);
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageTickets'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const existing = await prisma.ticket.findFirst({
      where: { id, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
      select: { id: true, whatsappNumberId: true, conversationId: true, status: true },
    });
    if (!existing) throw new AppError(404, 'Ticket not found');
    await prisma.ticket.delete({ where: { id } });
    emitTicketEvent(orgId, 'ticket:updated', existing);
    sendSuccess(res, { deleted: true });
  })
);

export default router;
