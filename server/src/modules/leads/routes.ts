import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { sendSuccess, asyncHandler, AppError, paramId } from '../../utils/response';

import { resolveActiveWhatsappNumberId, leadsForNumberFilter } from '../whatsapp/active-number';
import { Prisma } from '@prisma/client';
import { META_ADS_SOURCE } from '../facebook/leadgen-ingest';

const router = Router();

/** Soft resolve: Page-only orgs can list META_ADS leads without a WhatsApp number. */
async function resolveWhatsappNumberSoft(req: Request, _res: Response, next: (err?: unknown) => void) {
  try {
    if (!req.user?.organizationId) return next();
    req.activeWhatsappNumberId = await resolveActiveWhatsappNumberId(
      req.user.organizationId,
      req.headers['x-whatsapp-number-id']
    );
    next();
  } catch (err) {
    // Multi-number without header must not 409 META_ADS list; number-scoped queries get empty filter.
    if (err instanceof AppError && err.statusCode === 409) {
      req.activeWhatsappNumberId = undefined;
      return next();
    }
    next(err);
  }
}

router.use(authenticate, requireOrg, resolveWhatsappNumberSoft);

async function assertAgentInOrg(organizationId: string, userId: string) {
  const member = await prisma.organizationUser.findFirst({
    where: { organizationId, userId },
    select: { userId: true },
  });
  if (!member) throw new AppError(400, 'That teammate is not in this workspace');
}

const leadSchema = z.object({
  title: z.string().min(1),
  contactId: z.string().uuid().optional(),
  stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  source: z.string().optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
});

function isMetaAdsSource(value: unknown): boolean {
  return typeof value === 'string' && value.toUpperCase() === META_ADS_SOURCE;
}

router.get(
  '/',
  loadPermissions,
  requirePermission('manageContacts'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const stage = req.query.stage as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const source = typeof req.query.source === 'string' ? req.query.source.trim() : undefined;
    const metaAdsList = isMetaAdsSource(source);

    const where: Prisma.LeadWhereInput = {
      organizationId: orgId,
      ...(stage ? { stage: stage as never } : {}),
      ...(metaAdsList
        ? { source: META_ADS_SOURCE }
        : {
            ...leadsForNumberFilter(numberId),
            ...(source ? { source } : {}),
          }),
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
  requirePermission('manageContacts'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = leadSchema.parse(req.body);
    const metaAdsCreate = isMetaAdsSource(data.source);
    const whatsappNumberId = req.activeWhatsappNumberId;

    // Manual leads still require WhatsApp. META_ADS list/create path does not.
    if (!metaAdsCreate && !whatsappNumberId) {
      throw new AppError(400, 'Connect a WhatsApp number before creating leads');
    }
    if (metaAdsCreate) {
      throw new AppError(
        400,
        'Meta Ads leads are created from Instant Form webhooks. Connect a Facebook Page in Settings.'
      );
    }

    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId, organizationId: orgId, whatsappNumberId },
      });
      if (!contact) throw new AppError(404, 'Contact not found');
    }
    if (data.assignedAgentId) await assertAgentInOrg(orgId, data.assignedAgentId);

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
  requirePermission('manageContacts'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const data = leadSchema.partial().parse(req.body);

    const existing = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: orgId,
        OR: [
          { source: META_ADS_SOURCE },
          { whatsappNumberId: req.activeWhatsappNumberId },
        ],
      },
    });
    if (!existing) throw new AppError(404, 'Lead not found');
    if (data.contactId) {
      const contact = await prisma.contact.findFirst({
        where: {
          id: data.contactId,
          organizationId: orgId,
          ...(existing.source === META_ADS_SOURCE
            ? {}
            : { whatsappNumberId: req.activeWhatsappNumberId }),
        },
      });
      if (!contact) throw new AppError(404, 'Contact not found for the active WhatsApp number');
    }
    if (data.assignedAgentId) await assertAgentInOrg(orgId, data.assignedAgentId);
    if (data.source !== undefined && isMetaAdsSource(data.source)) {
      throw new AppError(
        400,
        'Meta Ads leads are created from Instant Form webhooks. Source cannot be set to META_ADS.'
      );
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
        ...(existing.source !== META_ADS_SOURCE && req.activeWhatsappNumberId
          ? { whatsappNumberId: req.activeWhatsappNumberId }
          : {}),
        ...(data.stage !== undefined ? { stage: data.stage.toUpperCase() as never } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
        ...(data.assignedAgentId !== undefined ? { assignedAgentId: data.assignedAgentId } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.amount !== undefined
          ? { amount: data.amount == null ? null : new Prisma.Decimal(data.amount.toFixed(2)) }
          : {}),
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
  requirePermission('manageContacts'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const contactId = req.params.contactId as string;
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before creating leads');

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId, whatsappNumberId },
    });
    if (!contact) throw new AppError(404, 'Contact not found');

    const lead = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
      const existing = await tx.lead.findFirst({
        where: { organizationId: orgId, whatsappNumberId, contactId: contact.id },
        include: {
          contact: { select: { id: true, phone: true, name: true } },
        },
      });
      if (existing) return { lead: existing, created: false };

      return {
        lead: await tx.lead.create({
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
        }),
        created: true,
      };
    });

    sendSuccess(res, lead, lead.created ? 201 : 200);
  })
);

router.post(
  '/bulk',
  authenticate,
  requireOrg,
  loadPermissions,
  requirePermission('manageContacts'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const whatsappNumberId = req.activeWhatsappNumberId;

    const { ids, stage } = z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        stage: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']),
      })
      .parse(req.body);

    // Allow bulk stage for META_ADS without WhatsApp; otherwise keep number scope.
    const result = await prisma.lead.updateMany({
      where: {
        id: { in: ids },
        organizationId: orgId,
        OR: [
          { source: META_ADS_SOURCE },
          ...(whatsappNumberId ? [{ whatsappNumberId }] : []),
        ],
      },
      data: { stage: stage as never },
    });

    sendSuccess(res, { updated: result.count });
  })
);

export default router;
