import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { withPermission } from '../../middleware/permissions';
import { authenticateJwtOrApiKey } from '../../middleware/authenticate-jwt-or-api-key';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { phoneFieldSchema, validatePhone } from '../../utils/phone';
import { z } from 'zod';
import { getOrgCallingSettings } from '../calling/settings.service';
import { applyGlobalCallingToContactIfEnabled } from '../calling/calling-ai-global.service';
import {
  bulkUpdateContacts,
  deleteTag,
  exportContacts,
  getContactDetail,
  listContacts,
  renameTag,
  subscribeUnsubscribedContacts,
} from './service';
import { resolveActiveWhatsappNumber } from '../whatsapp/active-number';
import { asCustomAttributes } from '../../utils/custom-attributes';
import { Prisma } from '@prisma/client';
import { contactConsentData, contactCreateConsentFields } from './consent';
import { emitProductEvent } from '../platform/events';
import { checkQuota } from '../billing/entitlements.service';
import { requireActiveCommercialOnMutation } from '../../middleware/plan-guard';
import { NEW_CONTACT_CALLING_DEFAULTS } from './contact-ai-defaults';

const router = Router();

router.use(authenticateJwtOrApiKey, requireOrg, resolveActiveWhatsappNumber, ...withPermission('manageContacts'));
router.use(requireActiveCommercialOnMutation());

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const result = await listContacts(orgId, req.query as Record<string, string>, req.activeWhatsappNumberId);
    sendSuccess(res, result);
  })
);

const customAttributesSchema = z.record(z.string().max(64), z.string().max(500)).optional();

const contactSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  optedIn: z.boolean().optional(),
  customAttributes: customAttributesSchema,
});

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const data = contactSchema.parse(req.body);
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before creating contacts');

    const orgId = req.user!.organizationId!;
    const customAttributes = asCustomAttributes(data.customAttributes) as Prisma.InputJsonValue;
    const { contact, created } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
      const existing = await tx.contact.findUnique({
        where: {
          organizationId_whatsappNumberId_normalizedPhone: {
            organizationId: orgId,
            whatsappNumberId,
            normalizedPhone: data.phone,
          },
        },
      });
      if (!existing) {
        const quotaCheck = await checkQuota(orgId, 'contacts', 1);
        if (!quotaCheck.allowed) {
          throw new AppError(
            402,
            quotaCheck.reason ||
              `Contact limit reached (${quotaCheck.used}/${quotaCheck.limit}). Upgrade your plan to add more contacts.`,
            quotaCheck.code
          );
        }
      }
      const contact = await tx.contact.upsert({
        where: {
          organizationId_whatsappNumberId_normalizedPhone: {
            organizationId: orgId,
            whatsappNumberId,
            normalizedPhone: data.phone,
          },
        },
        create: {
          organizationId: orgId,
          phone: data.phone,
          normalizedPhone: data.phone,
          whatsappNumberId,
          name: data.name,
          email: data.email || undefined,
          tags: data.tags || [],
          notes: data.notes,
          customAttributes,
          source: 'MANUAL',
          ...NEW_CONTACT_CALLING_DEFAULTS,
          ...contactCreateConsentFields(data.optedIn, 'MANUAL'),
        },
        update: {
          name: data.name,
          email: data.email || undefined,
          tags: data.tags,
          notes: data.notes,
          customAttributes,
          ...(data.optedIn !== undefined ? contactConsentData(data.optedIn, 'MANUAL') : {}),
        },
      });
      return { contact, created: !existing };
    });
    if (created) {
      await applyGlobalCallingToContactIfEnabled(req.user!.organizationId!, contact.id);
    }
    if (created) {
      emitProductEvent({
        organizationId: req.user!.organizationId!,
        name: 'CONTACT_CREATED',
      });
    }

    sendSuccess(res, contact, 201);
  })
);

router.post(
  '/import',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { contacts } = req.body as {
      contacts: Array<{
        phone: string;
        name?: string;
        tags?: string[];
        notes?: string;
        customAttributes?: Record<string, string>;
      }>;
    };

    if (!Array.isArray(contacts)) throw new AppError(400, 'Contacts array required');

    const orgId = req.user!.organizationId!;
    const whatsappNumberId = req.activeWhatsappNumberId;
    if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before importing contacts');

    const normalizedPhones = contacts.map((contact, index) => {
      const result = validatePhone(contact.phone);
      if (!result.ok) throw new AppError(400, `Contact ${index + 1}: ${result.error}`);
      return result.phone;
    });
    const imported = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
      const existingContacts = await tx.contact.findMany({
        where: {
          organizationId: orgId,
          whatsappNumberId,
          normalizedPhone: { in: [...new Set(normalizedPhones)] },
        },
        select: { normalizedPhone: true },
      });
      const existingPhones = new Set(existingContacts.map((contact) => contact.normalizedPhone));
      const newContactCount = new Set(
        normalizedPhones.filter((phone) => !existingPhones.has(phone))
      ).size;
      const quotaCheck = await checkQuota(orgId, 'contacts', newContactCount);
      if (!quotaCheck.allowed) {
        throw new AppError(
          402,
          quotaCheck.reason ||
            `Importing ${newContactCount} contacts exceeds your plan limit (${quotaCheck.used}/${quotaCheck.limit}). Upgrade your plan to import more contacts.`,
          quotaCheck.code
        );
      }

      let count = 0;
      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        const normalizedPhone = normalizedPhones[i];
        const incomingAttrs = asCustomAttributes(c.customAttributes);
        const existing = await tx.contact.findUnique({
          where: {
            organizationId_whatsappNumberId_normalizedPhone: {
              organizationId: orgId,
              whatsappNumberId,
              normalizedPhone,
            },
          },
          select: { customAttributes: true },
        });
        const customAttributes = {
          ...asCustomAttributes(existing?.customAttributes),
          ...incomingAttrs,
        } as Prisma.InputJsonValue;

        await tx.contact.upsert({
          where: {
            organizationId_whatsappNumberId_normalizedPhone: {
              organizationId: orgId,
              whatsappNumberId,
              normalizedPhone,
            },
          },
          create: {
            organizationId: orgId,
            phone: normalizedPhone,
            normalizedPhone,
            whatsappNumberId,
            name: c.name,
            email: undefined,
            tags: c.tags || [],
            notes: c.notes,
            customAttributes,
            source: 'IMPORT',
            ...NEW_CONTACT_CALLING_DEFAULTS,
            ...contactCreateConsentFields(undefined, 'IMPORT'),
          },
          update: { name: c.name, tags: c.tags, notes: c.notes, customAttributes },
        });
        count++;
      }
      return count;
    });
    if (imported > 0) {
      emitProductEvent({
        organizationId: orgId,
        name: 'CSV_IMPORTED',
        count: imported,
      });
    }

    sendSuccess(res, { imported });
  })
);

router.post(
  '/subscribe-unsubscribed',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const result = await subscribeUnsubscribedContacts(orgId, req.activeWhatsappNumberId);
    sendSuccess(res, result);
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
  callingAiEnabled: z.boolean().optional(),
  customAttributes: customAttributesSchema,
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

    if (data.callingAiEnabled !== undefined) {
      if (data.callingAiEnabled) {
        const callingQuota = await checkQuota(req.user!.organizationId!, 'calling');
        if (!callingQuota.allowed) {
          throw new AppError(
            402,
            callingQuota.reason || 'Calling is not included in your plan.',
            callingQuota.code
          );
        }
      }
      const calling = await getOrgCallingSettings(req.user!.organizationId!);
      if (calling.aiAutoAnswer) {
        throw new AppError(
          400,
          'Global AI calling is on — turn it off from Calls to change pickup for this person.'
        );
      }
    }

    const { customAttributes, optedIn, ...rest } = data;
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...rest,
        email: data.email === '' ? null : data.email,
        ...(optedIn !== undefined ? contactConsentData(optedIn, 'MANUAL') : {}),
        ...(customAttributes !== undefined
          ? { customAttributes: asCustomAttributes(customAttributes) as Prisma.InputJsonValue }
          : {}),
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
