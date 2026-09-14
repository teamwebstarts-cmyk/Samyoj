import { Router, Request, Response } from 'express';
import { ContentDraftKind, ContentDraftStatus, GenerationJobKind } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../config/database';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { withPermission } from '../../../middleware/permissions';
import {
  requireActiveCommercialOnMutation,
  requireFeatureOnMutation,
} from '../../../middleware/plan-guard';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../../utils/response';
import { createChatCompletion, isAiConfigured } from '../../ai/chat-completion.service';
import { resolveActiveWhatsappNumberId } from '../../whatsapp/active-number';
import { getOrgWhatsappContext } from '../../whatsapp/context';
import { MetaWhatsAppService } from '../../whatsapp/meta.service';
import { buildTemplateComponents } from '../../templates/builder';
import { assertBudget, recordUsage } from '../shared/cost-guard';
import { policyGuard } from '../shared/policy-guard';
import {
  COMPOSER_TOOL_ACTIONS,
  bodyVariableExamples,
  brandSystemPrompt,
  localeToMetaLanguage,
  parseAbVariants,
  slugTemplateName,
  toolInstruction,
  type ComposerToolAction,
} from './tools';

const router = Router();

function assertDraftNumber(
  draft: { whatsappNumberId: string | null },
  numberId: string
): void {
  if (draft.whatsappNumberId && draft.whatsappNumberId !== numberId) {
    throw new AppError(
      409,
      'This draft is bound to another WhatsApp number. Switch to that number to continue.'
    );
  }
}

const generateSchema = z.object({
  prompt: z.string().min(1).max(4000),
  kind: z.nativeEnum(ContentDraftKind).default('TEMPLATE_BODY'),
  locale: z.string().default('en-IN'),
  templateCategory: z.string().optional(),
});

router.post(
  '/generate',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = generateSchema.parse(req.body);
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );

    if (!(await isAiConfigured(orgId))) {
      throw new AppError(503, 'AI is not configured for this organization');
    }

    await assertBudget(orgId, GenerationJobKind.TEXT, 500);

    const brandKit = await prisma.brandKit.findUnique({ where: { organizationId: orgId } });
    const systemPrompt = brandSystemPrompt(brandKit, data.locale);

    const job = await prisma.generationJob.create({
      data: {
        organizationId: orgId,
        kind: GenerationJobKind.TEXT,
        status: 'RUNNING',
        prompt: data.prompt,
        triggeredBy: `user:${req.user!.userId}`,
      },
    });

    try {
      const result = await createChatCompletion({
        organizationId: orgId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: data.prompt },
        ],
        maxTokens: 800,
        temperature: 0.7,
        usageAction: 'content_studio',
        whatsappNumberId: numberId,
      });

      const policy = policyGuard({
        text: result.content,
        bannedWords: brandKit?.bannedWords,
        mandatoryPhrases: brandKit?.mandatoryPhrases,
        templateCategory: data.templateCategory,
      });

      const draftStatus: ContentDraftStatus = policy.safe ? 'DRAFT' : 'BLOCKED';
      const body = policy.redactedText || result.content;

      const draft = await prisma.contentDraft.create({
        data: {
          organizationId: orgId,
          kind: data.kind,
          status: draftStatus,
          body,
          locale: data.locale,
          templateCategory: data.templateCategory,
          brandKitId: brandKit?.id,
          createdById: req.user!.userId,
          whatsappNumberId: numberId,
        },
      });

      const tokens = result.usage?.totalTokens || 500;
      await recordUsage(orgId, GenerationJobKind.TEXT, tokens);

      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: policy.safe ? 'SUCCEEDED' : 'BLOCKED_BY_POLICY',
          modelUsed: result.provider === 'azure' ? 'azure-openai' : 'sarvam',
          costCents: Math.ceil(tokens * 0.001),
          meta: { draftId: draft.id, policyReasons: policy.reasons },
        },
      });

      sendSuccess(res, { draft, jobId: job.id, policy }, 201);
    } catch (err) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Generation failed',
        },
      });
      throw err;
    }
  })
);

router.get(
  '/drafts',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const status = req.query.status as ContentDraftStatus | undefined;

    const drafts = await prisma.contentDraft.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status } : { status: { not: ContentDraftStatus.ARCHIVED } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    sendSuccess(res, { drafts });
  })
);

router.get(
  '/drafts/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const draft = await prisma.contentDraft.findFirst({
      where: { id: paramId(req), organizationId: orgId },
      include: { attachments: { include: { asset: true } } },
    });
    if (!draft) throw new AppError(404, 'Draft not found');
    sendSuccess(res, draft);
  })
);

const updateDraftSchema = z.object({
  body: z.string().min(1).max(4096).optional(),
  status: z.nativeEnum(ContentDraftStatus).optional(),
});

router.patch(
  '/drafts/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = updateDraftSchema.parse(req.body);

    const existing = await prisma.contentDraft.findFirst({
      where: { id: paramId(req), organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Draft not found');

    if (data.body) {
      const brandKit = await prisma.brandKit.findUnique({ where: { organizationId: orgId } });
      const policy = policyGuard({
        text: data.body,
        bannedWords: brandKit?.bannedWords,
        mandatoryPhrases: brandKit?.mandatoryPhrases,
        templateCategory: existing.templateCategory || undefined,
      });
      if (!policy.safe) {
        throw new AppError(400, `Content blocked by policy: ${policy.reasons.join(', ')}`);
      }
    }

    const draft = await prisma.contentDraft.update({
      where: { id: existing.id },
      data: {
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });

    sendSuccess(res, draft);
  })
);

const toolsSchema = z.object({
  action: z.enum(COMPOSER_TOOL_ACTIONS),
  text: z.string().min(1).max(8000),
  locale: z.string().default('en-IN'),
  kind: z.nativeEnum(ContentDraftKind).optional(),
  parentDraftId: z.string().uuid().optional(),
  templateCategory: z.string().optional(),
});

function kindForTool(action: ComposerToolAction, fallback?: ContentDraftKind): ContentDraftKind {
  if (action === 'ab_variants') return 'AB_VARIANT';
  if (action === 'button_list') return 'LIST_SECTION';
  return fallback || 'TEMPLATE_BODY';
}

router.post(
  '/tools',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = toolsSchema.parse(req.body);
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );

    if (!(await isAiConfigured(orgId))) {
      throw new AppError(503, 'AI is not configured for this organization');
    }

    const estimatedTokens = data.action === 'ab_variants' ? 1200 : 500;
    await assertBudget(orgId, GenerationJobKind.TEXT, estimatedTokens);

    const brandKit = await prisma.brandKit.findUnique({ where: { organizationId: orgId } });
    const systemPrompt = [
      brandSystemPrompt(brandKit, data.locale),
      toolInstruction(data.action, data.locale),
    ].join(' ');

    const job = await prisma.generationJob.create({
      data: {
        organizationId: orgId,
        kind: GenerationJobKind.TEXT,
        status: 'RUNNING',
        prompt: data.text.slice(0, 2000),
        params: { action: data.action, locale: data.locale },
        triggeredBy: `user:${req.user!.userId}`,
      },
    });

    try {
      const result = await createChatCompletion({
        organizationId: orgId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: data.text },
        ],
        maxTokens: data.action === 'ab_variants' ? 1400 : data.action === 'shorten' ? 500 : 800,
        temperature: data.action === 'ab_variants' ? 0.85 : 0.6,
        usageAction: 'content_studio',
        whatsappNumberId: numberId,
      });

      const variants =
        data.action === 'ab_variants' ? parseAbVariants(result.content) : [result.content];
      if (variants.length === 0) {
        throw new AppError(502, 'The model returned empty copy');
      }

      const drafts = [];
      let lastPolicy = policyGuard({ text: variants[0] });

      for (const variant of variants) {
        const policy = policyGuard({
          text: variant,
          bannedWords: brandKit?.bannedWords,
          mandatoryPhrases: brandKit?.mandatoryPhrases,
          templateCategory: data.templateCategory,
        });
        lastPolicy = policy;
        const body = (policy.redactedText || variant).slice(0, 4096);
        const draft = await prisma.contentDraft.create({
          data: {
            organizationId: orgId,
            kind: kindForTool(data.action, data.kind),
            status: policy.safe ? 'DRAFT' : 'BLOCKED',
            body,
            locale: data.locale,
            templateCategory: data.templateCategory,
            brandKitId: brandKit?.id,
            parentDraftId: data.parentDraftId,
            createdById: req.user!.userId,
            whatsappNumberId: numberId,
          },
        });
        drafts.push(draft);
      }

      const tokens = result.usage?.totalTokens || estimatedTokens;
      await recordUsage(orgId, GenerationJobKind.TEXT, tokens);

      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: lastPolicy.safe ? 'SUCCEEDED' : 'BLOCKED_BY_POLICY',
          modelUsed: result.provider === 'azure' ? 'azure-openai' : 'sarvam',
          costCents: Math.ceil(tokens * 0.001),
          meta: { draftIds: drafts.map((d) => d.id), action: data.action },
        },
      });

      sendSuccess(
        res,
        {
          action: data.action,
          draft: drafts[0],
          drafts,
          jobId: job.id,
          policy: lastPolicy,
        },
        201
      );
    } catch (err) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Tool failed',
        },
      });
      throw err;
    }
  })
);

const submitMetaSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9_]+$/, 'Name must be lowercase letters, numbers, and underscores only')
    .max(512)
    .optional(),
  category: z.enum(['MARKETING', 'UTILITY']).default('MARKETING'),
  language: z.string().optional(),
});

router.post(
  '/drafts/:id/submit-meta',
  authenticate,
  requireOrg,
  requireActiveCommercialOnMutation(),
  requireFeatureOnMutation('templates'),
  ...withPermission('manageTemplates'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = submitMetaSchema.parse(req.body || {});
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );
    if (!numberId) {
      throw new AppError(400, 'Connect WhatsApp before submitting a template to Meta.');
    }

    const existing = await prisma.contentDraft.findFirst({
      where: { id: paramId(req), organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Draft not found');
    if (existing.status === 'BLOCKED') {
      throw new AppError(400, 'Blocked drafts cannot be submitted to Meta. Rewrite the copy first.');
    }
    assertDraftNumber(existing, numberId);
    if (existing.body.length > 1024) {
      throw new AppError(400, 'Template body must be 1024 characters or fewer. Shorten the draft first.');
    }

    const brandKit = await prisma.brandKit.findUnique({ where: { organizationId: orgId } });
    const policy = policyGuard({
      text: existing.body,
      bannedWords: brandKit?.bannedWords,
      mandatoryPhrases: brandKit?.mandatoryPhrases,
      templateCategory: data.category,
    });
    if (!policy.safe) {
      throw new AppError(400, `Content blocked by policy: ${policy.reasons.join(', ')}`);
    }

    const { wabaId, accessToken } = await getOrgWhatsappContext(orgId, numberId);
    const language = data.language || localeToMetaLanguage(existing.locale);
    const name = data.name || slugTemplateName(brandKit?.companyName || 'studio');
    const footer =
      brandKit?.mandatoryPhrases?.[0]?.slice(0, 60) ||
      (data.category === 'MARKETING' ? 'Reply STOP to opt out.' : undefined);

    try {
      const result = await MetaWhatsAppService.createMessageTemplate(wabaId, accessToken, {
        name,
        language,
        category: data.category,
        components: buildTemplateComponents({
          name,
          language,
          category: data.category,
          body: existing.body,
          headerFormat: 'NONE',
          footer: footer || undefined,
          bodyExamples: bodyVariableExamples(existing.body),
        }),
        allow_category_change: true,
      });

      const draft = await prisma.contentDraft.update({
        where: { id: existing.id },
        data: {
          status: 'IN_REVIEW',
          templateCategory: data.category,
          metaTemplateName: name,
          metaTemplateStatus: result.status || 'PENDING',
          metaRejectionReason: null,
          whatsappNumberId: existing.whatsappNumberId ?? numberId,
        },
      });

      sendSuccess(res, {
        draft,
        meta: { id: result.id, name, language, status: result.status, category: result.category },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit template to Meta';
      throw new AppError(502, message);
    }
  })
);

router.get(
  '/drafts/:id/meta-status',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );
    if (!numberId) {
      throw new AppError(400, 'Connect WhatsApp before checking Meta template status.');
    }

    const existing = await prisma.contentDraft.findFirst({
      where: { id: paramId(req), organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Draft not found');
    assertDraftNumber(existing, numberId);
    if (!existing.metaTemplateName) {
      throw new AppError(400, 'This draft has not been submitted to Meta yet.');
    }

    const { wabaId, accessToken } = await getOrgWhatsappContext(orgId, numberId);
    const template = await MetaWhatsAppService.getMessageTemplate(
      wabaId,
      accessToken,
      existing.metaTemplateName
    );
    if (!template) {
      throw new AppError(404, 'Meta has no template with that name yet. Try again in a minute.');
    }

    const status = (template.status || '').toUpperCase();
    const rejectedReason = template.rejected_reason || null;

    let draftStatus: ContentDraftStatus = existing.status;
    if (status === 'APPROVED') draftStatus = 'APPROVED';
    else if (status === 'REJECTED') draftStatus = 'REJECTED';
    else if (status === 'PENDING' || status === 'IN_APPEAL') draftStatus = 'IN_REVIEW';

    const draft = await prisma.contentDraft.update({
      where: { id: existing.id },
      data: {
        status: draftStatus,
        metaTemplateStatus: status || existing.metaTemplateStatus,
        metaRejectionReason: rejectedReason,
      },
    });

    sendSuccess(res, { draft, meta: template });
  })
);

const autofixSchema = z.object({
  reason: z.string().max(2000).optional(),
});

router.post(
  '/drafts/:id/autofix',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = autofixSchema.parse(req.body || {});
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );

    if (!(await isAiConfigured(orgId))) {
      throw new AppError(503, 'AI is not configured for this organization');
    }

    const existing = await prisma.contentDraft.findFirst({
      where: { id: paramId(req), organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Draft not found');
    if (numberId) assertDraftNumber(existing, numberId);

    const reason = data.reason || existing.metaRejectionReason;
    if (!reason) {
      throw new AppError(400, 'No Meta rejection reason to fix. Refresh status first.');
    }

    await assertBudget(orgId, GenerationJobKind.TEXT, 500);
    const brandKit = await prisma.brandKit.findUnique({ where: { organizationId: orgId } });

    const job = await prisma.generationJob.create({
      data: {
        organizationId: orgId,
        kind: GenerationJobKind.TEXT,
        status: 'RUNNING',
        prompt: existing.body.slice(0, 2000),
        params: { action: 'autofix', reason },
        triggeredBy: `user:${req.user!.userId}`,
      },
    });

    try {
      const result = await createChatCompletion({
        organizationId: orgId,
        messages: [
          {
            role: 'system',
            content: [
              brandSystemPrompt(brandKit, existing.locale),
              'Meta rejected this WhatsApp template. Rewrite so it will pass review.',
              'Keep the offer and CTA. Stay under 1024 characters. Return only the fixed message.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Rejected copy:\n${existing.body}\n\nMeta reason:\n${reason}`,
          },
        ],
        maxTokens: 800,
        temperature: 0.5,
        usageAction: 'content_studio',
        whatsappNumberId: numberId,
      });

      const policy = policyGuard({
        text: result.content,
        bannedWords: brandKit?.bannedWords,
        mandatoryPhrases: brandKit?.mandatoryPhrases,
        templateCategory: existing.templateCategory || 'MARKETING',
      });
      const body = (policy.redactedText || result.content).slice(0, 1024);

      const draft = await prisma.contentDraft.create({
        data: {
          organizationId: orgId,
          kind: existing.kind,
          status: policy.safe ? 'DRAFT' : 'BLOCKED',
          body,
          locale: existing.locale,
          templateCategory: existing.templateCategory,
          brandKitId: brandKit?.id,
          parentDraftId: existing.id,
          version: existing.version + 1,
          createdById: req.user!.userId,
          whatsappNumberId: existing.whatsappNumberId ?? numberId,
        },
      });

      const tokens = result.usage?.totalTokens || 500;
      await recordUsage(orgId, GenerationJobKind.TEXT, tokens);
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: policy.safe ? 'SUCCEEDED' : 'BLOCKED_BY_POLICY',
          meta: { draftId: draft.id, parentDraftId: existing.id },
        },
      });

      sendSuccess(res, { draft, policy, parentId: existing.id }, 201);
    } catch (err) {
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Autofix failed',
        },
      });
      throw err;
    }
  })
);

export default router;
