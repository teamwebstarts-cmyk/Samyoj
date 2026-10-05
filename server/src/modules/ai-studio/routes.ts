import { Router, Request, Response } from 'express';
import { GenerationJobKind } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { resolveActiveWhatsappNumberId } from '../whatsapp/active-number';
import { studioTemplateHeaderUrl } from '../instagram/posts.media-url';
import { isImageQuality, type ImageQuality } from './hunyuan-image';
import { buildSlideImagePrompt, generateOneStudioImage, isImageCount, stampPackWithModelImages, type ImageCount } from './studio-image-pipeline';
import { buildStudioSystemPrompt } from './studio-prompts';
import { fetchStudioPackFromLlm } from './studio-llm';
import { assembleStudioPack } from './assemble-studio-pack';

const router = Router();

export function cryptoId(): string {
  return 'pack_' + crypto.randomBytes(8).toString('hex');
}

export function derivePackName(brief: string): string {
  const cleaned = brief.trim();
  return cleaned.length > 40 ? cleaned.slice(0, 37) + '…' : cleaned || 'Untitled pack';
}

// ---------------------------------------------------------------------------
// POST /ai-studio/generate
// ---------------------------------------------------------------------------

export const generateSchema = z.object({
  brief: z.string().min(1).max(2000),
  language: z.string().min(1).max(20),
  outputs: z.array(z.string()).min(1).max(10),
  photoNames: z.array(z.string().max(200)).max(8).optional(),
  referenceUrls: z
    .array(z.string().url().refine((value) => new URL(value).protocol === 'https:', 'Reference images must use HTTPS'))
    .max(5)
    .optional(),
  imageQuality: z.enum(['standard', 'high', 'story']).optional(),
  imageCount: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
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

    const brandRow = await prisma.brandKit.findUnique({
      where: { organizationId: orgId },
      select: { companyName: true, audience: true, valueProps: true },
    }).catch(() => null);
    const brandKit = brandRow
      ? {
          companyName: brandRow.companyName,
          audience: brandRow.audience,
          valueProps: brandRow.valueProps,
          toneFormal: 60,
          toneBrief: 40,
          toneFriendly: 70,
          tonePlayful: 30,
          sampleLike: [] as string[],
          sampleDislike: [] as string[],
          bannedWords: [] as string[],
          mandatoryPhrases: [] as string[],
        }
      : null;

    const systemPrompt = buildStudioSystemPrompt(
      data.brief,
      data.language,
      data.outputs,
      brandKit as Parameters<typeof buildStudioSystemPrompt>[3],
      data.photoNames || [],
    );

    const job = await prisma.generationJob.create({
      data: {
        organizationId: orgId,
        kind: GenerationJobKind.AI_STUDIO_PACK,
        status: 'RUNNING',
        prompt: data.brief,
        params: { language: data.language, outputs: data.outputs },
        triggeredBy: `user:${req.user!.userId}`,
      },
    }).catch(() => null);

    try {
      const { pack: rawPack, result } = await fetchStudioPackFromLlm({
        organizationId: orgId,
        systemPrompt,
        brief: data.brief,
        whatsappNumberId: numberId,
      });

      const packId = cryptoId();
      const pack = assembleStudioPack(rawPack, {
        brief: data.brief,
        language: data.language,
        outputs: data.outputs,
        packId,
        photoNames: data.photoNames || [],
      });
      const quality = (data.imageQuality && isImageQuality(data.imageQuality) ? data.imageQuality : 'standard') as ImageQuality;
      const imageCount = (data.imageCount && isImageCount(data.imageCount) ? data.imageCount : 1) as ImageCount;
      const visual = String(rawPack.imagePrompt || '').slice(0, 500);
      const imageBrief = visual ? `${data.brief}\nVisual direction: ${visual}` : data.brief;
      pack.imagePrompt = data.brief;
      await stampPackWithModelImages(
        req,
        orgId,
        pack,
        imageBrief,
        quality,
        imageCount,
        data.referenceUrls || [],
      );

      const tokens = result.usage?.totalTokens || 2000;

      if (job) {
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'SUCCEEDED',
            modelUsed: result.provider === 'azure' ? 'azure-openai' : 'sarvam',
            costCents: Math.ceil(tokens * 0.001),
            meta: { outputCount: data.outputs.length, packId: pack.id as string },
          },
        }).catch(() => undefined);
      }

      sendSuccess(res, { pack, jobId: job?.id ?? null }, 201);
    } catch (err) {
      if (job) {
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : 'Generation failed',
          },
        }).catch(() => undefined);
      }
      throw err;
    }
  })
);

const regenerateVisualSchema = z.object({
  imagePrompt: z.string().min(1).max(2000),
  headline: z.string().max(200).optional(),
  slideIndex: z.number().int().min(0).max(20).optional(),
  imageQuality: z.enum(['standard', 'high', 'story']).optional(),
  packId: z.string().max(80).optional(),
});

router.post(
  '/regenerate-visual',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const body = regenerateVisualSchema.parse(req.body);
    const quality = (body.imageQuality && isImageQuality(body.imageQuality) ? body.imageQuality : 'standard') as ImageQuality;
    const packId = body.packId || cryptoId();
    const prompt = buildSlideImagePrompt(body.imagePrompt, body.headline || '', body.slideIndex ?? 0);
    const url = await generateOneStudioImage(orgId, packId, `r${body.slideIndex ?? 0}`, prompt, quality);
    sendSuccess(res, { url });
  }),
);

// ---------------------------------------------------------------------------
// GET /ai-studio/packs  — list persisted packs for the org
// ---------------------------------------------------------------------------

router.get(
  '/packs',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const packs = await prisma.aiStudioPack.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch((err: { code?: string }) => {
      if (err?.code === 'P2021') return [];
      throw err;
    });
    sendSuccess(res, { packs });
  })
);

// ---------------------------------------------------------------------------
// POST /ai-studio/packs — upsert (save / overwrite) a pack
// ---------------------------------------------------------------------------

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Client sends the Pack object; older callers may wrap it as { packData }. */
export function normalizeStudioPackBody(raw: unknown): {
  clientId: string | null;
  name: string;
  brief: string;
  language: string;
  outputs: string[];
  photoNames: string[];
  packData: Record<string, unknown>;
} {
  if (!raw || typeof raw !== 'object') {
    throw new AppError(400, 'Pack is required');
  }
  const body = raw as Record<string, unknown>;
  const packData = (body.packData && typeof body.packData === 'object' ? body.packData : body) as Record<string, unknown>;
  const name = String(packData.name || body.name || '').trim();
  const brief = String(packData.brief || body.brief || '').trim();
  const language = String(packData.language || body.language || 'English').trim();
  const outputs = Array.isArray(packData.outputs) ? packData.outputs.map(String) : [];
  if (!name || !brief) throw new AppError(400, 'Pack name and brief are required');
  const photos = Array.isArray(packData.photos) ? packData.photos : [];
  const photoNames = photos
    .map((photo) => (photo && typeof photo === 'object' ? String((photo as { name?: string }).name || '') : ''))
    .filter(Boolean);
  const clientId = String(packData.id || '').trim() || null;
  return {
    clientId,
    name: name.slice(0, 200),
    brief: brief.slice(0, 2000),
    language: language.slice(0, 20),
    outputs: outputs.slice(0, 10),
    photoNames,
    packData,
  };
}

router.post(
  '/packs',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = normalizeStudioPackBody(req.body.pack || req.body);

    const existing = data.clientId
      ? await prisma.aiStudioPack.findFirst({
          where: {
            organizationId: orgId,
            OR: [
              ...(UUID_RE.test(data.clientId) ? [{ id: data.clientId }] : []),
              { packData: { path: ['id'], equals: data.clientId } },
            ],
          },
        })
      : null;

    const saved = existing
      ? await prisma.aiStudioPack.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            brief: data.brief,
            language: data.language,
            outputs: data.outputs,
            photoNames: data.photoNames,
            packData: data.packData as any,
          },
        })
      : await prisma.aiStudioPack.create({
          data: {
            organizationId: orgId,
            name: data.name,
            brief: data.brief,
            language: data.language,
            outputs: data.outputs,
            photoNames: data.photoNames,
            packData: data.packData as any,
          },
        });

    sendSuccess(res, { pack: saved }, 201);
  })
);

// ---------------------------------------------------------------------------
// DELETE /ai-studio/packs/:id
// ---------------------------------------------------------------------------

router.delete(
  '/packs/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const existing = await prisma.aiStudioPack.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          ...(UUID_RE.test(id) ? [{ id }] : []),
          { packData: { path: ['id'], equals: id } },
        ],
      },
    });
    if (!existing) throw new AppError(404, 'Pack not found');

    await prisma.aiStudioPack.delete({ where: { id } });

    res.status(204).send();
  })
);

// ---------------------------------------------------------------------------
// POST /ai-studio/handoffs — audit log of hand-off events (returns 204)
// ---------------------------------------------------------------------------

export const handoffSchema = z.object({
  packId: z.string().min(1),
  channel: z.string().min(1).max(50),
  payload: z.record(z.unknown()).optional(),
});

router.post(
  '/handoffs',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = handoffSchema.parse(req.body);

    // Ensure the pack belongs to this org before recording a handoff.
    const pack = await prisma.aiStudioPack.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          ...(UUID_RE.test(data.packId) ? [{ id: data.packId }] : []),
          { packData: { path: ['id'], equals: data.packId } },
        ],
      },
      select: { id: true },
    });
    if (!pack) throw new AppError(404, 'Pack not found');

    await prisma.aiStudioHandoff.create({
      data: {
        organizationId: orgId,
        packId: pack.id,
        channel: data.channel,
        payload: data.payload || ({} as any),
      },
    });

    res.status(204).send();
  })
);

router.get(
  '/handoffs/template-media/:name',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.params.name || '').trim();
    if (!name) throw new AppError(400, 'Template name is required.');
    const activeNumberId = await resolveActiveWhatsappNumberId(
      req.user!.organizationId!,
      req.headers['x-whatsapp-number-id'],
    );

    const rows = await prisma.aiStudioHandoff.findMany({
      where: {
        organizationId: req.user!.organizationId!,
        channel: 'whatsapp',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { payload: true },
    });

    for (const row of rows) {
      const payload = (row.payload && typeof row.payload === 'object'
        ? row.payload
        : {}) as Record<string, unknown>;
      if (String(payload.name || '') !== name) continue;
      if (
        activeNumberId &&
        payload.whatsappNumberId &&
        payload.whatsappNumberId !== activeNumberId
      ) {
        continue;
      }
      const mediaUrl = studioTemplateHeaderUrl(payload);
      sendSuccess(res, { mediaUrl, packId: payload.packId || null });
      return;
    }

    sendSuccess(res, { mediaUrl: null, packId: null });
  }),
);

export default router;
