import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { buildTemplateComponents } from '../campaigns/template-params';
import { buildTemplateComponents as buildCreateComponents } from './builder';
import { getTemplateUsage } from './analytics';
import {
  createTemplateSchema,
  createFromLibrarySchema,
  testSendSchema,
} from './types';

const router = Router();

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
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);

    if (all === 'true') {
      const templates = await MetaWhatsAppService.listAllMessageTemplates(wabaId, accessToken, {
        status: status as string | undefined,
      });
      sendSuccess(res, { templates, paging: null });
      return;
    }

    const result = await MetaWhatsAppService.listMessageTemplates(wabaId, accessToken, {
      status: status as string | undefined,
      after: after as string | undefined,
    });

    sendSuccess(res, result);
  })
);

router.get(
  '/library',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { search, language, topic, usecase, industry, name, limit } = req.query;
    const { accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);

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
  '/:name/usage',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const usage = await getTemplateUsage(req.user!.organizationId!, name);
    sendSuccess(res, usage);
  })
);

router.get(
  '/:name',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);

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

    const { accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);
    const handle = await MetaWhatsAppService.uploadTemplateMedia(accessToken, buffer, mimeType);

    sendSuccess(res, { handle, mimeType, size: buffer.length });
  })
);

router.post(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createTemplateSchema.parse(req.body);
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);

    const result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
      name: data.name,
      language: data.language,
      category: data.category,
      components: buildCreateComponents(data),
    });

    sendSuccess(res, result, 201);
  })
);

router.post(
  '/from-library',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createFromLibrarySchema.parse(req.body);
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);

    const result = await MetaWhatsAppService.createMessageTemplateFromLibrary(wabaId, accessToken, {
      name: data.name,
      language: data.language,
      libraryTemplateName: data.libraryTemplateName,
      libraryTemplateButtonInputs: data.libraryTemplateButtonInputs,
    });

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

    const { wabaId, accessToken, whatsappNumber } = await getOrgWhatsappContext(orgId);
    const phoneNumberId = whatsappNumber.phoneNumberId;
    const template = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, name);
    if (!template) throw new AppError(404, 'Template not found');
    if (template.status !== 'APPROVED') {
      throw new AppError(400, 'Only approved templates can be test-sent');
    }

    const templateLanguage = language || template.language || 'en_US';
    const components = buildTemplateComponents(templateParams || null, template);

    const result = await MetaWhatsAppService.sendMessage(phoneNumberId, accessToken, {
      to: phone,
      type: 'template',
      template: {
        name,
        language: { code: templateLanguage },
        ...(components.length ? { components } : {}),
      },
    });

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
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);

    const existing = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, name);
    if (!existing) throw new AppError(404, 'Template not found');
    if (!['REJECTED', 'PAUSED'].includes(existing.status)) {
      throw new AppError(400, 'Only rejected or paused templates can be resubmitted');
    }

    await MetaWhatsAppService.deleteMessageTemplate(wabaId, accessToken, name);

    const result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
      name: data.name,
      language: data.language,
      category: data.category,
      components: buildCreateComponents(data),
    });

    sendSuccess(res, result, 201);
  })
);

router.delete(
  '/:name',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);

    await MetaWhatsAppService.deleteMessageTemplate(wabaId, accessToken, name);
    sendSuccess(res, { deleted: true, name });
  })
);

export default router;
