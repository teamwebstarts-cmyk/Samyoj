import { Router, Request, Response } from 'express';
import { GenerationJobKind } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../config/database';
import { contentImageQueue } from '../../../config/queues';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../../utils/response';
import { assertBudget } from '../shared/cost-guard';

const router = Router();

const generateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(['1:1', '9:16', '16:9', '4:5', '1.91:1']).default('1:1'),
  provider: z.enum(['openai', 'google', 'ideogram', 'flux']).default('openai'),
  negativePrompt: z.string().max(500).optional(),
});

router.post(
  '/generate',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = generateSchema.parse(req.body);

    await assertBudget(orgId, GenerationJobKind.IMAGE, 1);

    const job = await prisma.generationJob.create({
      data: {
        organizationId: orgId,
        kind: GenerationJobKind.IMAGE,
        status: 'QUEUED',
        provider: data.provider,
        prompt: data.prompt,
        params: {
          aspectRatio: data.aspectRatio,
          negativePrompt: data.negativePrompt,
        },
        triggeredBy: `user:${req.user!.userId}`,
        costCents: 4,
      },
    });

    await contentImageQueue.add(
      'generate-image',
      { jobId: job.id, organizationId: orgId },
      { jobId: job.id }
    );

    sendSuccess(res, { job, status: 'queued' }, 202);
  })
);

router.get(
  '/jobs/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const job = await prisma.generationJob.findFirst({
      where: { id: paramId(req), organizationId: orgId },
      include: { resultAsset: true },
    });
    if (!job) throw new AppError(404, 'Generation job not found');
    sendSuccess(res, job);
  })
);

export async function processImageGenerationJob(jobId: string, organizationId: string) {
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, organizationId },
  });
  if (!job || job.status !== 'QUEUED') return;

  // ponytail: no provider; fail closed and skip recordUsage. Wire a real provider when one exists.
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      attempts: { increment: 1 },
      errorMessage: 'Demo stub — image generation is not connected. Not billed.',
    },
  });
}

export default router;
