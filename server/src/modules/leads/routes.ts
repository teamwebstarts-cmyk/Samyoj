import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler, AppError, paramId } from '../../utils/response';

import { resolveActiveWhatsappNumber, leadsForNumberFilter } from '../whatsapp/active-number';
import { Prisma } from '@prisma/client';

const router = Router();

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber);

const leadSchema = z.object({
  title: z.string().min(1),
  contactId: z.string().uuid().optional(),
  stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  source: z.string().optional(),
  assignedAgentId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

router.get(
  '/',
  loadPermissions,
  requirePermission('manageInbox', 'viewAnalytics'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const stage = req.query.stage as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    const where: Prisma.LeadWhereInput = {
      organizationId: orgId,
      ...(stage ? { stage: stage as never } : {}),
      ...leadsForNumberFilter(numberId),
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { contact: { name: { contains: search, mode: 'insensitive' } } },
        { contact: { phone: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      include: {
        contact: { select: { id: true, phone: true, name: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    sendSuccess(res, { leads });
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
    const data = leadSchema.parse(req.body);
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before creating leads');

    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId, organizationId: orgId, whatsappNumberId },
      });
      if (!contact) throw new AppError(404, 'Contact not found');
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        title: data.title,
        contactId: data.contactId,
        whatsappNumberId,
        stage: (data.stage?.toUpperCase() as never) || 'NEW',
        source: data.source,
        assignedAgentId: data.assignedAgentId,
        notes: data.notes,
      },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    sendSuccess(res, lead, 201);
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
    const data = leadSchema.partial().parse(req.body);

    const existing = await prisma.lead.findFirst({
      where: { id, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
    });
    if (!existing) throw new AppError(404, 'Lead not found');
    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId, organizationId: orgId, whatsappNumberId: req.activeWhatsappNumberId },
      });
      if (!contact) throw new AppError(404, 'Contact not found for the active WhatsApp number');
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
        ...(req.activeWhatsappNumberId ? { whatsappNumberId: req.activeWhatsappNumberId } : {}),
        ...(data.stage !== undefined ? { stage: data.stage.toUpperCase() as never } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.assignedAgentId !== undefined ? { assignedAgentId: data.assignedAgentId } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
        assignedAgent: { select: { id: true, name: true } },
      },
    });

    sendSuccess(res, lead);
  })
);

router.post(
  '/from-contact/:contactId',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const contactId = req.params.contactId as string;
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before creating leads');

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId, whatsappNumberId },
    });
    if (!contact) throw new AppError(404, 'Contact not found');

    const existing = await prisma.lead.findFirst({
      where: { organizationId: orgId, contactId: contact.id },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
      },
    });
    if (existing) {
      sendSuccess(res, { lead: existing, created: false });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        contactId: contact.id,
        whatsappNumberId,
        title: contact.name || contact.phone,
        source: contact.source,
        stage: 'NEW',
      },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
      },
    });

    sendSuccess(res, { lead, created: true }, 201);
  })
);

router.post(
  '/bulk',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageInbox'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before updating leads');

    const { ids, stage } = z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']),
      })
      .parse(req.body);

    const result = await prisma.lead.updateMany({
      where: {
        id: { in: ids },
        organizationId: orgId,
        whatsappNumberId,
      },
      data: { stage: stage as never },
    });

    sendSuccess(res, { updated: result.count });
  })
);

export default router;
