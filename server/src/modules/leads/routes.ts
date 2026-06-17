import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler, AppError, paramId } from '../../utils/response';

const router = Router();

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
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('viewAnalytics'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const stage = req.query.stage as string | undefined;

    const leads = await prisma.lead.findMany({
      where: {
        organizationId: orgId,
        ...(stage ? { stage: stage as never } : {}),
      },
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

    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId, organizationId: orgId },
      });
      if (!contact) throw new AppError(404, 'Contact not found');
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        title: data.title,
        contactId: data.contactId,
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

    const existing = await prisma.lead.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Lead not found');

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
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
    const contactId = paramId(req);

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
    });
    if (!contact) throw new AppError(404, 'Contact not found');

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        contactId: contact.id,
        title: contact.name || contact.phone,
        source: contact.source,
        stage: 'NEW',
      },
      include: {
        contact: { select: { id: true, phone: true, name: true } },
      },
    });

    sendSuccess(res, lead, 201);
  })
);

export default router;
