import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { authenticateJwtOrApiKey } from '../../middleware/authenticate-jwt-or-api-key';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { phoneFieldSchema, validatePhone } from '../../utils/phone';
import { z } from 'zod';
import {
  bulkUpdateContacts,
  deleteTag,
  exportContacts,
  getContactDetail,
  listContacts,
  renameTag,
} from './service';
import { resolveActiveWhatsappNumber } from '../whatsapp/active-number';

const router = Router();

router.use(authenticateJwtOrApiKey, requireOrg, resolveActiveWhatsappNumber);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const result = await listContacts(orgId, req.query as Record<string, string>, req.activeWhatsappNumberId);
    sendSuccess(res, result);
  })
);

const contactSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  optedIn: z.boolean().optional(),
});

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const data = contactSchema.parse(req.body);
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before creating contacts');

    const contact = await prisma.contact.upsert({
      where: {
        organizationId_whatsappNumberId_normalizedPhone: {
          organizationId: req.user!.organizationId!,
          whatsappNumberId,
          normalizedPhone: data.phone,
        },
      },
      create: {
        organizationId: req.user!.organizationId!,
        phone: data.phone,
        normalizedPhone: data.phone,
        whatsappNumberId,
        name: data.name,
        email: data.email || undefined,
        tags: data.tags || [],
        notes: data.notes,
        optedIn: data.optedIn ?? false,
        source: 'MANUAL',
      },
      update: {
        name: data.name,
        email: data.email || undefined,
        tags: data.tags,
        notes: data.notes,
        ...(data.optedIn !== undefined ? { optedIn: data.optedIn } : {}),
      },
    });

    sendSuccess(res, contact, 201);
  })
);

router.post(
  '/import',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { contacts } = req.body as {
      contacts: Array<{ phone: string; name?: string; tags?: string[]; notes?: string }>;
    };

    if (!Array.isArray(contacts)) throw new AppError(400, 'Contacts array required');

    const orgId = req.user!.organizationId!;
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before importing contacts');
    let imported = 0;

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const result = validatePhone(c.phone);
      if (!result.ok) throw new AppError(400, `Contact ${i + 1}: ${result.error}`);

      await prisma.contact.upsert({
        where: {
          organizationId_whatsappNumberId_normalizedPhone: {
            organizationId: orgId,
            whatsappNumberId,
            normalizedPhone: result.phone,
          },
        },
        create: {
          organizationId: orgId,
          phone: result.phone,
          normalizedPhone: result.phone,
          whatsappNumberId,
          name: c.name,
          tags: c.tags || [],
          notes: c.notes,
          source: 'IMPORT',
        },
        update: { name: c.name, tags: c.tags, notes: c.notes },
      });
      imported++;
    }

    sendSuccess(res, { imported });
  })
);

router.post(
  '/bulk',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      ids: z.array(z.string()).min(1),
      action: z.enum(['delete', 'addTags', 'removeTags', 'setOptedIn']),
      tags: z.array(z.string()).optional(),
      optedIn: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const result = await bulkUpdateContacts(
      req.user!.organizationId!,
      data,
      req.activeWhatsappNumberId
    );
    sendSuccess(res, result);
  })
);

router.get(
  '/tags',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const whatsappNumberId = req.activeWhatsappNumberId;
    const contacts = await prisma.contact.findMany({
      where: whatsappNumberId ? { organizationId: orgId, whatsappNumberId } : { id: { in: [] } },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
    for (const contact of contacts) {
      for (const tag of contact.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const tags = [...tagCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));

    sendSuccess(res, { tags });
  })
);

router.post(
  '/tags/rename',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({ from: z.string().min(1), to: z.string().min(1) });
    const data = schema.parse(req.body);
    const result = await renameTag(
      req.user!.organizationId!,
      data.from,
      data.to,
      req.activeWhatsappNumberId
    );
    sendSuccess(res, result);
  })
);

router.delete(
  '/tags/:tag',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const tag = decodeURIComponent(String(req.params.tag));
    const result = await deleteTag(req.user!.organizationId!, tag, req.activeWhatsappNumberId);
    sendSuccess(res, result);
  })
);

router.get(
  '/export',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await exportContacts(
      req.user!.organizationId!,
      req.query as Record<string, string>,
      req.activeWhatsappNumberId
    );
    const ext = result.contentType === 'text/csv' ? 'csv' : 'json';
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename=contacts.${ext}`);
    res.send(result.body);
  })
);

router.get(
  '/:id/detail',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const detail = await getContactDetail(
      req.user!.organizationId!,
      paramId(req),
      req.activeWhatsappNumberId
    );
    sendSuccess(res, detail);
  })
);

router.get(
  '/:id/timeline',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { getContactTimeline } = await import('./timeline');
    const result = await getContactTimeline(
      req.user!.organizationId!,
      paramId(req),
      req.activeWhatsappNumberId
    );
    if (!result) throw new AppError(404, 'Contact not found');
    sendSuccess(res, result);
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const contact = await prisma.contact.findFirst({
      where: {
        id: paramId(req),
        organizationId: req.user!.organizationId!,
        ...(req.activeWhatsappNumberId ? { whatsappNumberId: req.activeWhatsappNumberId } : { id: { in: [] } }),
      },
    });
    if (!contact) throw new AppError(404, 'Contact not found');
    sendSuccess(res, contact);
  })
);

const updateContactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  optedIn: z.boolean().optional(),
});

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateContactSchema.parse(req.body);
    const id = paramId(req);
    const existing = await prisma.contact.findFirst({
      where: {
        id,
        organizationId: req.user!.organizationId!,
        ...(req.activeWhatsappNumberId ? { whatsappNumberId: req.activeWhatsappNumberId } : { id: { in: [] } }),
      },
    });
    if (!existing) throw new AppError(404, 'Contact not found');

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
      },
    });

    sendSuccess(res, contact);
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    await prisma.$transaction(async (tx) => {
      const contact = await tx.contact.findFirst({
        where: {
          id,
          organizationId: req.user!.organizationId!,
          ...(req.activeWhatsappNumberId ? { whatsappNumberId: req.activeWhatsappNumberId } : { id: { in: [] } }),
        },
        select: { id: true },
      });
      if (!contact) throw new AppError(404, 'Contact not found');

      // Lock the parent while checking history. FK inserts acquire a
      // conflicting key-share lock, so a concurrent history write cannot
      // race this check and be cascaded by deletion.
      await tx.$queryRaw`SELECT id FROM contacts WHERE id = ${contact.id} FOR UPDATE`;
      const locked = await tx.contact.findUnique({
        where: { id: contact.id },
        select: {
          _count: { select: { conversations: true, calls: true, orders: true, leads: true, tickets: true } },
        },
      });
      if (!locked || Object.values(locked._count).some((count) => count > 0)) {
        throw new AppError(409, 'Cannot delete a contact with history; retain or archive it instead');
      }
      const deleted = await tx.contact.deleteMany({ where: { id: contact.id } });
      if (deleted.count !== 1) throw new AppError(404, 'Contact not found');
    });
    sendSuccess(res, { deleted: true });
  })
);

export default router;
