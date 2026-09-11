import { Router, Request, Response } from 'express';
import { GenerationJobKind } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../../config/database';
import { contentVideoQueue } from '../../../config/queues';
import { authenticate, requireOrg } from '../../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../../utils/response';
import { assertBudget } from '../shared/cost-guard';

const router = Router();

const generateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  durationSeconds: z.number().int().min(5).max(60).default(15),
  provider: z.enum(['runway', 'stub']).default('stub'),
});

router.post(
  '/generate',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = generateSchema.parse(req.body);

    await assertBudget(orgId, GenerationJobKind.VIDEO, data.durationSeconds);

    const job = await prisma.generationJob.create({
      data: {
        organizationId: orgId,
        kind: GenerationJobKind.VIDEO,
        status: 'QUEUED',
        provider: data.provider,
        prompt: data.prompt,
        params: {
          aspectRatio: data.aspectRatio,
          durationSeconds: data.durationSeconds,
        },
        triggeredBy: `user:${req.user!.userId}`,
        costCents: 25,
      },
    });

    await contentVideoQueue.add(
      'generate-video',
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
      where: { id: paramId(req), organizationId: orgId, kind: GenerationJobKind.VIDEO },
      include: { resultAsset: true },
    });
    if (!job) throw new AppError(404, 'Video job not found');
    sendSuccess(res, job);
  })
);

export async function processVideoGenerationJob(jobId: string, organizationId: string) {
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, organizationId, kind: GenerationJobKind.VIDEO },
  });
  if (!job || job.status !== 'QUEUED') return;

  // ponytail: no provider; fail closed and skip recordUsage. Wire a real provider when one exists.
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      attempts: { increment: 1 },
      errorMessage: 'Demo stub — video generation is not connected. Not billed.',
    },
  });
}

export default router;
