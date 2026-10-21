import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../../middleware/auth';
import { withPermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { isMetaUnavailableError, isWhatsAppRateLimit, MetaApiError, MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { resolveMetaCredentials } from '../whatsapp/org-meta.service';
import { resolveActiveWhatsappNumber } from '../whatsapp/active-number';
import { mergeTemplateParams } from '../campaigns/template-params';
import { assertApprovedCampaignTemplate } from '../campaigns/template-validation';
import { buildTemplateComponents as buildCreateComponents } from './builder';
import { getTemplateUsage } from './analytics';
import { invalidateTemplateCache, recallTemplateList, rememberTemplateList } from './cache';
import {
  createTemplateSchema,
  createFromLibrarySchema,
  testSendSchema,
} from './types';
import { getTemplateVariableMeta, saveTemplateVariableMeta } from './variable-meta';
import {
  buildCatalogSubmitPayload,
  getPublishedLibraryTemplate,
  hideSamyojHostedCatalogDrafts,
  unusableTemplateButtonUrl,
} from './catalog-store';
import { listTenantTemplateLibrary } from './library-tenant';
import prisma from '../../config/database';
import { normalizePhoneIdentity } from '../../utils/phone';
import { emitProductEvent } from '../platform/events';
import { sendDirectMessage } from '../messages/service';
import { hasAuditableCampaignConsent } from '../contacts/consent';
import {
  requireActiveCommercialOnMutation,
  requireFeatureOnMutation,
} from '../../middleware/plan-guard';

const router = Router();

// Active-number list works even when no single number can be resolved (409).
router.get(
  '/by-any-active-number',
  authenticate,
  requireOrg,
  ...withPermission('manageTemplates'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const all = req.query.all === 'true';
    const numbers = await prisma.whatsappNumber.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    if (!numbers.length) {
      throw new AppError(400, 'No WhatsApp number connected. Connect WhatsApp in Settings first.');
    }
    const unavailableNumbers: string[] = [];
    let lastError: unknown = null;
    for (const number of numbers) {
      try {
        const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
        if (all) {
          const templates = await MetaWhatsAppService.listAllMessageTemplates(number.wabaId, accessToken, { status });
          sendSuccess(res, {
            templates,
            paging: null,
            whatsappNumberId: number.id,
            unavailableNumbers,
          });
          return;
        }
        const result = await MetaWhatsAppService.listMessageTemplates(number.wabaId, accessToken, {
          status,
          after: typeof req.query.after === 'string' ? req.query.after : undefined,
        });
        sendSuccess(res, {
          templates: result.templates,
          paging: result.paging ?? null,
          whatsappNumberId: number.id,
          unavailableNumbers,
        });
        return;
      } catch (error) {
        lastError = error;
        if (!isMetaUnavailableError(error)) throw error;
        unavailableNumbers.push(number.phoneNumber);
      }
    }
    void lastError;
    throw new AppError(
      503,
      'Every connected WhatsApp number has lost Meta access. Reconnect it in Settings.',
      'META_OBJECT_UNAVAILABLE'
    );
  })
);

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber, ...withPermission('manageTemplates'));
router.use(requireActiveCommercialOnMutation(), requireFeatureOnMutation('templates'));

function throwTemplateSaveError(error: unknown): never {
  if (isWhatsAppRateLimit(error)) {
    throw new AppError(
      429,
      'Too many calls to this WhatsApp Business account. Wait a minute, then try again.',
      'WHATSAPP_RATE_LIMIT',
    );
  }
  if (error instanceof MetaApiError) {
    throw new AppError(400, error.message, 'META_TEMPLATE_REJECTED');
  }
  throw error;
}

async function bindStudioHandoffTemplate(
  organizationId: string,
  studioPackId: string | undefined,
  templateName: string,
  whatsappNumberId?: string,
): Promise<void> {
  if (!studioPackId) return;
  const pack = await prisma.aiStudioPack.findFirst({
    where: { organizationId, packData: { path: ['id'], equals: studioPackId } },
    select: { id: true },
  }).catch(() => null);
  if (!pack) return;
  const handoffs = await prisma.aiStudioHandoff.findMany({
    where: { organizationId, packId: pack.id, channel: 'whatsapp' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const handoff = handoffs.find((candidate) => {
    const payload =
      candidate.payload && typeof candidate.payload === 'object'
        ? (candidate.payload as Record<string, unknown>)
        : {};
    return !whatsappNumberId || !payload.whatsappNumberId || payload.whatsappNumberId === whatsappNumberId;
  });
  if (!handoff) return;
  const payload =
    handoff.payload && typeof handoff.payload === 'object'
      ? (handoff.payload as Record<string, unknown>)
      : {};
  await prisma.aiStudioHandoff.update({
    where: { id: handoff.id },
    data: { payload: { ...payload, name: templateName } },
  });
}

function emitTemplateSyncTelemetry(
  organizationId: string,
  templates: Array<{ status?: string }>
): void {
  emitProductEvent({ organizationId, name: 'TEMPLATE_SYNC' });
  const rejected = templates.filter((template) => template.status?.toUpperCase() === 'REJECTED').length;
  if (rejected > 0) {
    emitProductEvent({
      organizationId,
      name: 'TEMPLATE_REJECTED',
      count: rejected,
    });
  }
}

const uploadHeaderSchema = z.object({
  data: z.string().min(1),
  mimeType: z.string().min(1),
});

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { status, after, all } = req.query;
    const { wabaId, accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    const orgId = req.user!.organizationId!;
    const statusKey = typeof status === 'string' ? status : '';

    try {
      if (all === 'true') {
        const templates = await MetaWhatsAppService.listAllMessageTemplates(wabaId, accessToken, {
          status: status as string | undefined,
        });
        emitTemplateSyncTelemetry(orgId, templates);
        await rememberTemplateList(orgId, wabaId, statusKey, templates);
        sendSuccess(res, { templates, paging: null });
        return;
      }

      const result = await MetaWhatsAppService.listMessageTemplates(wabaId, accessToken, {
        status: status as string | undefined,
        after: after as string | undefined,
      });

      emitTemplateSyncTelemetry(orgId, result.templates);
      if (!after) await rememberTemplateList(orgId, wabaId, statusKey, result.templates);
      sendSuccess(res, result);
    } catch (err) {
      if (!isWhatsAppRateLimit(err) || after) throwTemplateSaveError(err);
      const cached = await recallTemplateList<unknown>(orgId, wabaId, statusKey);
      if (!cached) throwTemplateSaveError(err);
      sendSuccess(res, { templates: cached, paging: null });
    }
  })
);

router.get(
  '/library',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { search, language, topic, usecase, industry, name, limit } = req.query;
    const { accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    const templates = await MetaWhatsAppService.listMessageTemplateLibrary(accessToken, {
      search: search as string | undefined,
      language: language as string | undefined,
      topic: topic as string | undefined,
      usecase: usecase as string | undefined,
      industry: industry as string | undefined,
      name: name as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    sendSuccess(res, templates);
  })
);

router.get(
  '/starters',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    await hideSamyojHostedCatalogDrafts();
    sendSuccess(
      res,
      await listTenantTemplateLibrary({
        organizationId: req.user!.organizationId!,
        whatsappNumberId: req.activeWhatsappNumberId,
      })
    );
  })
);

const catalogSubmitSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only'),
  language: z.string().min(2).default('en_US'),
  buttonUrl: z.string().max(2000).optional(),
  buttonPhone: z.string().max(20).optional(),
  headerMediaHandle: z.string().max(500).optional(),
});

router.post(
  '/catalog/:slug/submit',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const slug = z
      .string()
      .regex(/^[a-z0-9_]{3,64}$/)
      .parse(req.params.slug);
    const body = catalogSubmitSchema.parse(req.body);
    const row = await getPublishedLibraryTemplate(slug);
    const rowButtons = Array.isArray(row.buttons) ? row.buttons : [];
    const needsUrl = rowButtons.some(
      (button) =>
        button &&
        typeof button === 'object' &&
        !Array.isArray(button) &&
        (button as { type?: string }).type === 'URL',
    );
    if (needsUrl && body.buttonUrl) {
      const buttonUrlError = unusableTemplateButtonUrl(body.buttonUrl);
      if (buttonUrlError) throw new AppError(400, buttonUrlError);
    }
    const data = createTemplateSchema.parse(
      buildCatalogSubmitPayload(row, {
        name: body.name,
        language: body.language,
        buttonUrl: body.buttonUrl,
        buttonPhone: body.buttonPhone,
        headerMediaHandle: body.headerMediaHandle,
      })
    );
    const { wabaId, accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    let result;
    try {
      result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
        name: data.name,
        language: data.language,
        category: data.category,
        components: buildCreateComponents(data),
        allow_category_change: true,
      });
    } catch (error) {
      throwTemplateSaveError(error);
    }

    await invalidateTemplateCache(req.user!.organizationId!, wabaId, data.name);
    sendSuccess(res, result, 201);
  })
);

router.get(
  '/:name/usage',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const usage = await getTemplateUsage(
      req.user!.organizationId!,
      name,
      req.activeWhatsappNumberId
    );
    sendSuccess(res, usage);
  })
);

const variableMetaSchema = z.object({
  language: z.string().optional(),
  meta: z.array(
    z.object({
      scope: z.enum(['body', 'header']),
      index: z.number().int().min(1),
      description: z.string().max(200).default(''),
      suggestedSource: z.enum(['contact.name', 'contact.phone', 'contact.email', 'custom', 'contact.custom']).optional(),
      customKey: z.string().max(64).optional(),
    })
  ),
}).superRefine((data, ctx) => {
  const seen = new Set<string>();
  for (const item of data.meta) {
    const key = `${item.scope}:${item.index}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['meta'],
        message: `Duplicate variable mapping for ${key}`,
      });
    }
    seen.add(key);
  }
});

router.get(
  '/:name/variable-meta',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const language = typeof req.query.language === 'string' ? req.query.language : undefined;
    const meta = await getTemplateVariableMeta(req.user!.organizationId!, name, language);
    sendSuccess(res, { meta });
  })
);

router.put(
  '/:name/variable-meta',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const data = variableMetaSchema.parse(req.body);
    const meta = await saveTemplateVariableMeta(
      req.user!.organizationId!,
      name,
      data.meta,
      data.language
    );
    sendSuccess(res, { meta });
  })
);

router.get(
  '/:name',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { wabaId, accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    const template = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, name);
    if (!template) throw new AppError(404, 'Template not found');

    sendSuccess(res, template);
  })
);

router.post(
  '/upload-header',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { data, mimeType } = uploadHeaderSchema.parse(req.body);
    const buffer = Buffer.from(data, 'base64');
    if (buffer.length > 16 * 1024 * 1024) {
      throw new AppError(400, 'File too large. Maximum size is 16 MB.');
    }

    const { accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );
    const metaCredentials = await resolveMetaCredentials(req.user!.organizationId!);
    const handle = await MetaWhatsAppService.uploadTemplateMedia(
      accessToken,
      buffer,
      mimeType,
      metaCredentials
    );

    sendSuccess(res, { handle, mimeType, size: buffer.length });
  })
);

router.post(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createTemplateSchema.parse(req.body);
    const { wabaId, accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    let result;
    try {
      result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
        name: data.name,
        language: data.language,
        category: data.category,
        components: buildCreateComponents(data),
        allow_category_change: true,
      });
    } catch (error) {
      throwTemplateSaveError(error);
    }

    await invalidateTemplateCache(req.user!.organizationId!, wabaId, data.name);

    await bindStudioHandoffTemplate(
      req.user!.organizationId!,
      data.studioPackId,
      data.name,
      req.activeWhatsappNumberId,
    );

    sendSuccess(res, result, 201);
  })
);

router.post(
  '/from-library',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createFromLibrarySchema.parse(req.body);
    const { wabaId, accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    let result;
    try {
      result = await MetaWhatsAppService.createMessageTemplateFromLibrary(wabaId, accessToken, {
        name: data.name,
        language: data.language,
        libraryTemplateName: data.libraryTemplateName,
        libraryTemplateButtonInputs: data.libraryTemplateButtonInputs,
        category: data.category,
        allow_category_change: true,
      });
    } catch (error) {
      throwTemplateSaveError(error);
    }

    await invalidateTemplateCache(req.user!.organizationId!, wabaId, data.name);
    await bindStudioHandoffTemplate(
      req.user!.organizationId!,
      data.studioPackId,
      data.name,
      req.activeWhatsappNumberId,
    );

    sendSuccess(res, result, 201);
  })
);

router.post(
  '/:name/test-send',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { phone, language, templateParams } = testSendSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const { wabaId, accessToken, whatsappNumber } = await getOrgWhatsappContext(
      orgId,
      req.activeWhatsappNumberId
    );
    const template = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, name);
    if (!template) throw new AppError(404, 'Template not found');
    if (template.status !== 'APPROVED') {
      throw new AppError(400, 'Only approved templates can be test-sent');
    }

    const templateLanguage = language || template.language || 'en_US';
    const contact = await prisma.contact.findUnique({
      where: {
        organizationId_whatsappNumberId_normalizedPhone: {
          organizationId: orgId,
          whatsappNumberId: whatsappNumber.id,
          normalizedPhone: normalizePhoneIdentity(phone),
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        customAttributes: true,
        optedIn: true,
        consentSource: true,
        consentAt: true,
        optOutAt: true,
      },
    });
    if (!contact) {
      throw new AppError(404, 'Test sends require an existing contact on the active WhatsApp number');
    }
    if (!hasAuditableCampaignConsent(contact)) {
      throw new AppError(400, 'Test sends require auditable campaign consent for this contact');
    }
    const resolvedParams = mergeTemplateParams(
      templateParams || null,
      null,
      contact?.name,
      template,
      {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        customAttributes: contact.customAttributes,
      }
    );
    try {
      assertApprovedCampaignTemplate(template, {
        name,
        language: templateLanguage,
        params: resolvedParams,
      });
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : String(error));
    }
    const result = await sendDirectMessage(orgId, {
      phone: contact.phone,
      content: name,
      type: 'TEMPLATE',
      templateName: name,
      templateLanguage,
      templateParams: resolvedParams,
      whatsappNumberId: whatsappNumber.id,
      idempotencyKey: req.get('Idempotency-Key') || undefined,
    });

    sendSuccess(res, { metaMessageId: result.message.metaMessageId });
  })
);

router.post(
  '/:name/resubmit',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const data = createTemplateSchema.parse(req.body);
    const { wabaId, accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    const existing = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, name);
    if (!existing) throw new AppError(404, 'Template not found');
    if (!['REJECTED', 'PAUSED', 'DISABLED'].includes(existing.status)) {
      throw new AppError(400, 'Only rejected, paused, or disabled templates can be resubmitted');
    }

    if (data.name.toLowerCase() === name.toLowerCase()) {
      throw new AppError(
        400,
        `Meta enforces a 30-day quarantine on deleted template names. Provide a new versioned name (e.g. ${name}_v2) to resubmit.`
      );
    }

    await MetaWhatsAppService.deleteMessageTemplate(wabaId, accessToken, name);
    await invalidateTemplateCache(req.user!.organizationId!, wabaId, name);

    let result;
    try {
      result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
        name: data.name,
        language: data.language,
        category: data.category,
        components: buildCreateComponents(data),
        allow_category_change: true,
      });
    } catch (error) {
      throwTemplateSaveError(error);
    }

    await invalidateTemplateCache(req.user!.organizationId!, wabaId, data.name);
    await bindStudioHandoffTemplate(
      req.user!.organizationId!,
      data.studioPackId,
      data.name,
      req.activeWhatsappNumberId,
    );

    sendSuccess(res, result, 201);
  })
);

router.delete(
  '/:name',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { wabaId, accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    await MetaWhatsAppService.deleteMessageTemplate(wabaId, accessToken, name);
    await invalidateTemplateCache(req.user!.organizationId!, wabaId, name);
    sendSuccess(res, { deleted: true, name });
  })
);

export default router;
