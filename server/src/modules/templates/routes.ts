import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../../middleware/auth';
import { withPermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { resolveMetaCredentials } from '../whatsapp/org-meta.service';
import { resolveActiveWhatsappNumber } from '../whatsapp/active-number';
import { buildTemplateComponents, mergeTemplateParams } from '../campaigns/template-params';
import { assertApprovedCampaignTemplate } from '../campaigns/template-validation';
import { buildTemplateComponents as buildCreateComponents } from './builder';
import { getTemplateUsage } from './analytics';
import { invalidateTemplateCache } from './cache';
import {
  createTemplateSchema,
  createFromLibrarySchema,
  testSendSchema,
} from './types';
import { getTemplateVariableMeta, saveTemplateVariableMeta } from './variable-meta';
import {
  buildCatalogSubmitPayload,
  getPublishedLibraryTemplate,
  listPublishedLibraryTemplates,
} from './catalog-store';
import prisma from '../../config/database';
import { normalizePhoneIdentity } from '../../utils/phone';
import { emitProductEvent } from '../platform/events';
import {
  requireActiveCommercialOnMutation,
  requireFeatureOnMutation,
} from '../../middleware/plan-guard';

const router = Router();

router.use(authenticate, requireOrg, resolveActiveWhatsappNumber, ...withPermission('manageTemplates'));
router.use(requireActiveCommercialOnMutation(), requireFeatureOnMutation('templates'));

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

    if (all === 'true') {
      const templates = await MetaWhatsAppService.listAllMessageTemplates(wabaId, accessToken, {
        status: status as string | undefined,
      });
      emitTemplateSyncTelemetry(req.user!.organizationId!, templates);
      sendSuccess(res, { templates, paging: null });
      return;
    }

    const result = await MetaWhatsAppService.listMessageTemplates(wabaId, accessToken, {
      status: status as string | undefined,
      after: after as string | undefined,
    });

    emitTemplateSyncTelemetry(req.user!.organizationId!, result.templates);
    sendSuccess(res, result);
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
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await listPublishedLibraryTemplates());
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
    const data = createTemplateSchema.parse(
      buildCatalogSubmitPayload(row, {
        name: body.name,
        language: body.language,
        buttonUrl: body.buttonUrl,
        buttonPhone: body.buttonPhone,
      })
    );
    const { wabaId, accessToken } = await getOrgWhatsappContext(
      req.user!.organizationId!,
      req.activeWhatsappNumberId
    );

    const result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
      name: data.name,
      language: data.language,
      category: data.category,
      components: buildCreateComponents(data),
      allow_category_change: true,
    });

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

    const result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
      name: data.name,
      language: data.language,
      category: data.category,
      components: buildCreateComponents(data),
      allow_category_change: true,
    });

    await invalidateTemplateCache(req.user!.organizationId!, wabaId, data.name);

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

    const result = await MetaWhatsAppService.createMessageTemplateFromLibrary(wabaId, accessToken, {
      name: data.name,
      language: data.language,
      libraryTemplateName: data.libraryTemplateName,
      libraryTemplateButtonInputs: data.libraryTemplateButtonInputs,
      category: data.category,
      allow_category_change: true,
    });

    await invalidateTemplateCache(req.user!.organizationId!, wabaId, data.name);

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
    const phoneNumberId = whatsappNumber.phoneNumberId;
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
      select: { name: true, phone: true, email: true, customAttributes: true },
    });
    const resolvedParams = mergeTemplateParams(
      templateParams || null,
      null,
      contact?.name,
      template,
      contact
        ? {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            customAttributes: contact.customAttributes,
          }
        : { phone }
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
    const components = buildTemplateComponents(resolvedParams, template);

    const result = await MetaWhatsAppService.sendMessage(
      phoneNumberId,
      accessToken,
      {
        to: phone,
        type: 'template',
        template: {
          name,
          language: { code: templateLanguage },
          ...(components.length ? { components } : {}),
        },
      },
      {
        whatsappNumberId: whatsappNumber.id,
        isOnBizApp: Boolean(whatsappNumber.isOnBizApp),
      }
    );

    sendSuccess(res, { metaMessageId: result.messages?.[0]?.id });
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

    await MetaWhatsAppService.deleteMessageTemplate(wabaId, accessToken, name);
    await invalidateTemplateCache(req.user!.organizationId!, wabaId, name);

    const result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
      name: data.name,
      language: data.language,
      category: data.category,
      components: buildCreateComponents(data),
      allow_category_change: true,
    });

    await invalidateTemplateCache(req.user!.organizationId!, wabaId, data.name);

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
