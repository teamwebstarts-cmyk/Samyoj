import { Router, Request, Response } from 'express';
import { GenerationJobKind, type BrandKit } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { createChatCompletion, isAiConfigured } from '../ai/chat-completion.service';
import { assertBudget, recordUsage } from '../content-studio/shared/cost-guard';
import { resolveActiveWhatsappNumberId } from '../whatsapp/active-number';
import { brandSystemPrompt } from '../content-studio/composer/tools';

const router = Router();

/**
 * Human-readable labels for each output channel — used to constrain the
 * generation prompt so the model knows what structure to emit per channel.
 */
const OUTPUT_LABELS: Record<string, string> = {
  ig_carousel: 'Instagram carousel (3-5 slides, each with headline, sub, offer, cta, point text)',
  ig_image: 'Instagram single image post (1 slide)',
  whatsapp: 'WhatsApp template (name, category, body ≤1024 chars, footer, URL button, example phones)',
  email: 'Email (subject line + body text)',
};

export function cryptoId(): string {
  return 'pack_' + crypto.randomBytes(8).toString('hex');
}

export function derivePackName(brief: string): string {
  const cleaned = brief.trim();
  return cleaned.length > 40 ? cleaned.slice(0, 37) + '…' : cleaned || 'Untitled pack';
}

/**
 * The system prompt asks the model to produce a single JSON object matching
 * the client-side `Pack` type. We describe the shape inline so the model fills
 * in all required fields.
 */
export function buildStudioSystemPrompt(
  brief: string,
  language: string,
  outputs: string[],
  brandKit: BrandKit | null,
  photoNames: string[] = [],
) {
  const base = brandSystemPrompt(brandKit, language);
  const requestedChannels = outputs
    .map((o) => OUTPUT_LABELS[o] || o)
    .join(', ');

  return [
    base,
    'You are generating content for "AI Studio" — a multi-channel marketing pack generator.',
    `User brief: ${brief}`,
    `Language: ${language}.`,
    `Generate content for these channels: ${requestedChannels}.`,
    photoNames.length ? `The user attached these photos (names only): ${photoNames.join(', ')}.` : '',
    'Return a SINGLE JSON object with NO markdown fences and NO explanatory text. The object must have these fields:',
    '  id: string (a short unique id)',
    '  name: string (a catchy pack name derived from the brief)',
    '  brief: string',
    '  language: string',
    '  outputs: array<string>',
    '  photos: array (empty array if unused)',
    "  ctx: { occasion: string|null, pct: number|null, place: string|null }",
    '  copyVariant: 0 | 1 | 2',
    '  carousel: optional array of slide objects — each { id, kind, bg, art, layout, image|null, variant, elements: [{ id, role, label, text }] }',
    '  image: optional { options: Slide[], selected: number }',
    '  instagram: optional { caption: string, hashtags: string }',
    '  whatsapp: optional { name, category:"Marketing", language, header:{type:"IMAGE",source}, body:string(≤1024), footer:string, buttons:[{id,label,type:"URL",url}], examples:object }',
    '  email: optional { subject: string, body: string }',
    '  handedOff: object (empty object if none handed off yet)',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// POST /ai-studio/generate
// ---------------------------------------------------------------------------

export const generateSchema = z.object({
  brief: z.string().min(1).max(2000),
  language: z.string().min(1).max(20),
  outputs: z.array(z.string()).min(1).max(10),
  photoNames: z.array(z.string().max(200)).max(8).optional(),
});

router.post(
  '/generate',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = generateSchema.parse(req.body);

    if (!(await isAiConfigured(orgId))) {
      throw new AppError(503, 'AI is not configured for this organization');
    }

    await assertBudget(orgId, GenerationJobKind.TEXT, 2000);

    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );

    const brandKit = await prisma.brandKit.findUnique({
      where: { organizationId: orgId },
    });

    const systemPrompt = buildStudioSystemPrompt(
      data.brief,
      data.language,
      data.outputs,
      brandKit,
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
    });

    try {
      const result = await createChatCompletion({
        organizationId: orgId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: data.brief },
        ],
        maxTokens: 4000,
        temperature: 0.7,
        usageAction: 'chat',
        whatsappNumberId: numberId,
      });

      let pack: Record<string, unknown>;
      try {
        pack = JSON.parse(result.content) as Record<string, unknown>;
      } catch {
        throw new AppError(502, 'AI returned malformed JSON. Please try again.');
      }

      // Ensure required fields are populated on the server side.
      pack.brief = data.brief;
      pack.language = data.language;
      pack.outputs = data.outputs;
      pack.id = pack.id || cryptoId();
      pack.name = pack.name || derivePackName(data.brief);
      pack.handedOff = pack.handedOff || {};

      const tokens = result.usage?.totalTokens || 2000;
      await recordUsage(orgId, GenerationJobKind.TEXT, tokens);

      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'SUCCEEDED',
          modelUsed: result.provider === 'azure' ? 'azure-openai' : 'sarvam',
          costCents: Math.ceil(tokens * 0.001),
          meta: { outputCount: data.outputs.length, packId: pack.id as string },
        },
      });

      sendSuccess(res, { pack, jobId: job.id }, 201);
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
        packId: data.packId,
        channel: data.channel,
        payload: data.payload || ({} as any),
      },
    });

    res.status(204).send();
  })
);

export default router;
