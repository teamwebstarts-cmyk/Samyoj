import { Router, Request, Response } from 'express';
import { ContentDraftKind, ContentDraftStatus, GenerationJobKind } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../config/database';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../../utils/response';
import { createChatCompletion, isAiConfigured } from '../../ai/chat-completion.service';
import { resolveActiveWhatsappNumberId } from '../../whatsapp/active-number';
import { assertBudget, recordUsage } from '../shared/cost-guard';
import { policyGuard } from '../shared/policy-guard';

const router = Router();

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

    const toneHints = brandKit
      ? `Tone: formal ${brandKit.toneFormal}/100, brief ${brandKit.toneBrief}/100, friendly ${brandKit.toneFriendly}/100, playful ${brandKit.tonePlayful}/100.`
      : '';

    const systemPrompt = [
      'You are a WhatsApp marketing copywriter.',
      brandKit ? `Brand: ${brandKit.companyName}. Audience: ${brandKit.audience || 'general'}.` : '',
      toneHints,
      brandKit?.valueProps?.length ? `Value props: ${brandKit.valueProps.join(', ')}.` : '',
      brandKit?.sampleLike?.length ? `Write like: ${brandKit.sampleLike.join('; ')}.` : '',
      brandKit?.sampleDislike?.length ? `Avoid style like: ${brandKit.sampleDislike.join('; ')}.` : '',
      `Output locale: ${data.locale}. Keep under 1024 characters.`,
    ]
      .filter(Boolean)
      .join(' ');

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
        ...(status ? { status } : {}),
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

export default router;
