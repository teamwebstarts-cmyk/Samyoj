import { Router, Request, Response } from 'express';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { z } from 'zod';

const router = Router();

const templateButtonSchema = z
  .object({
    type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
    text: z.string().min(1).max(25),
    url: z.string().max(2000).optional(),
    phone_number: z.string().max(20).optional(),
  })
  .superRefine((btn, ctx) => {
    if (btn.type === 'URL' && !btn.url?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'URL is required for URL buttons', path: ['url'] });
    }
    if (btn.type === 'PHONE_NUMBER' && !btn.phone_number?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Phone number is required for call buttons',
        path: ['phone_number'],
      });
    }
  });

const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only'),
  language: z.string().min(2).default('en_US'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  body: z.string().min(1).max(1024),
  header: z.string().max(60).optional(),
  footer: z.string().max(60).optional(),
  buttons: z.array(templateButtonSchema).max(3).optional(),
});

const createFromLibrarySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only'),
  language: z.string().min(2).default('en_US'),
  libraryTemplateName: z.string().min(1),
});

function buildTemplateComponents(data: z.infer<typeof createTemplateSchema>) {
  const components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT';
    text?: string;
    buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  }> = [];

  if (data.header) {
    components.push({ type: 'HEADER', format: 'TEXT', text: data.header });
  }

  components.push({ type: 'BODY', text: data.body });

  if (data.footer) {
    components.push({ type: 'FOOTER', text: data.footer });
  }

  if (data.buttons?.length) {
    components.push({
      type: 'BUTTONS',
      buttons: data.buttons.map((btn) => ({
        type: btn.type,
        text: btn.text,
        ...(btn.type === 'URL' && btn.url ? { url: btn.url } : {}),
        ...(btn.type === 'PHONE_NUMBER' && btn.phone_number
          ? { phone_number: btn.phone_number }
          : {}),
      })),
    });
  }

  return components;
}

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.query;
    const { wabaId, accessToken } = await getOrgWhatsappContext(req.user!.organizationId!);

    const templates = await MetaWhatsAppService.listMessageTemplates(wabaId, accessToken, {
      status: status as string | undefined,
    });

    sendSuccess(res, templates);
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
      components: buildTemplateComponents(data),
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
