import { Router, Request, Response } from 'express';
import { GenerationJobKind } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../config/database';
import { contentQueue } from '../../../config/queues';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../../utils/response';
import { assertBudget } from '../shared/cost-guard';

const router = Router();

const generateSchema = z.object({
  script: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
  provider: z.enum(['elevenlabs']).default('elevenlabs'),
  language: z.string().default('en'),
});

router.post(
  '/generate',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = generateSchema.parse(req.body);

    await assertBudget(orgId, GenerationJobKind.VOICE, 1);

    const job = await prisma.generationJob.create({
      data: {
        organizationId: orgId,
        kind: GenerationJobKind.VOICE,
        status: 'QUEUED',
        provider: data.provider,
        prompt: data.script,
        params: {
          voiceId: data.voiceId || 'default',
          language: data.language,
          stub: true,
        },
        triggeredBy: `user:${req.user!.userId}`,
        costCents: 8,
      },
    });

    await contentQueue.add(
      'generate-voice',
      { jobId: job.id, organizationId: orgId },
      { jobId: job.id }
    );

    sendSuccess(res, { job, status: 'queued', provider: 'elevenlabs (stub)' }, 202);
  })
);

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, {
      provider: 'elevenlabs',
      configured: false,
      voices: [
        { id: 'default', name: 'Default Voice', language: 'en' },
        { id: 'professional', name: 'Professional', language: 'en' },
      ],
      message: 'ElevenLabs integration is a stub — configure ELEVENLABS_API_KEY to enable.',
    });
  })
);

router.get(
  '/voices',
  authenticate,
  requireOrg,
  asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, {
      provider: 'elevenlabs',
      configured: false,
      voices: [
        { id: 'default', name: 'Default Voice', language: 'en' },
        { id: 'professional', name: 'Professional', language: 'en' },
      ],
      message: 'ElevenLabs integration is a stub — configure ELEVENLABS_API_KEY to enable.',
    });
  })
);

router.get(
  '/jobs/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const job = await prisma.generationJob.findFirst({
      where: { id: paramId(req), organizationId: orgId, kind: GenerationJobKind.VOICE },
      include: { resultAsset: true },
    });
    if (!job) throw new AppError(404, 'Voice job not found');
    sendSuccess(res, job);
  })
);

export async function processVoiceGenerationJob(jobId: string, organizationId: string) {
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, organizationId, kind: GenerationJobKind.VOICE },
  });
  if (!job || job.status !== 'QUEUED') return;

  // ponytail: no provider; fail closed and skip recordUsage. Wire a real provider when one exists.
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      attempts: { increment: 1 },
      errorMessage: 'Demo stub — voice generation is not connected. Not billed.',
    },
  });
}

export default router;
