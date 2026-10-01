import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { requireFeatureOnMutation } from '../../middleware/plan-guard';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { generateSchema, generateStudioPack, STUDIO_BRIEF_MAX } from './studio.service';

const router = Router();
router.use(authenticate, requireOrg, loadOrgRole);

const editors = requireOrgRole('OWNER', 'ADMIN', 'SUPERVISOR');

const idSchema = z.string().uuid();

function toDto(row: {
  id: string;
  brief: string;
  language: string;
  status: string;
  error: string | null;
  slides: unknown;
  photos: unknown;
  caption: string | null;
  hashtags: unknown;
  waName: string | null;
  waBody: string | null;
  waFooter: string | null;
  waButtons: unknown;
  emailSubject: string | null;
  emailBody: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    brief: row.brief,
    language: row.language,
    status: row.status,
    error: row.error,
    slides: Array.isArray(row.slides) ? row.slides : [],
    photos: Array.isArray(row.photos) ? row.photos : [],
    caption: row.caption,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
    waTemplate: row.waBody
      ? {
          name: row.waName,
          body: row.waBody,
          footer: row.waFooter,
          buttons: Array.isArray(row.waButtons) ? row.waButtons : [],
        }
      : null,
    email: row.emailSubject || row.emailBody
      ? { subject: row.emailSubject ?? '', body: row.emailBody ?? '' }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type StudioPackRow = Parameters<typeof toDto>[0] & { organizationId: string };

/** A Studio pack may travel to Instagram Posts; those rows must never leak the uploader id. */
export type StudioPackDto = ReturnType<typeof toDto>;

async function ownedPack(orgId: string, id: string): Promise<StudioPackRow> {
  const row = await prisma.studioPack.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!row) throw new AppError(404, 'Content pack not found');
  return row as unknown as StudioPackRow;
}

const editSchema = z.object({
  caption: z.string().max(2200).optional(),
  emailSubject: z.string().max(200).optional(),
  emailBody: z.string().max(2000).optional(),
  waBody: z.string().max(1024).optional(),
  /** In-place slide copy/theme edits from the visual editor. No regeneration. */
  slides: z
    .array(
      z.object({
        title: z.string().max(120),
        body: z.string().max(300),
        /** Optional photo url from the pack's own uploads to show behind this slide. */
        photo: z.string().max(2048).optional(),
        /** Visual theme key rendered client-side (no AI image generation). */
        style: z.enum(['none', 'festival', 'minimal', 'modern', 'premium']).optional(),
      })
    )
    .min(1)
    .max(10)
    .optional(),
});

/**
 * Generate a content pack from one brief. This is the ONLY mutation that
 * spends AI in Studio, and it never sends/publishes/submits anything —
 * hand-off happens on the destination channel pages.
 */
router.post(
  '/generate',
  editors,
  requireFeatureOnMutation('ai'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;
    const input = generateSchema.parse(req.body);
    const row = await generateStudioPack(orgId, userId, input);
    sendSuccess(res, toDto(row), 201);
  })
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const take = Math.min(Number(req.query.take) || 20, 50);
    const rows = await prisma.studioPack.findMany({
      where: { organizationId: orgId, status: { not: 'GENERATING' } },
      orderBy: { createdAt: 'desc' },
      take,
    });
    sendSuccess(res, { packs: rows.map(toDto) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = idSchema.parse(req.params.id);
    const row = await ownedPack(orgId, id);
    sendSuccess(res, toDto(row));
  })
);

/** In-place copy edits on a READY pack. No regeneration, no second billing. */
router.patch(
  '/:id',
  editors,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = idSchema.parse(req.params.id);
    const row = await ownedPack(orgId, id);
    if (row.status !== 'READY') {
      throw new AppError(400, 'Only a ready pack can be edited.');
    }
    const body = editSchema.parse(req.body);
    const { slides, ...scalarEdits } = body;
    const updated = await prisma.studioPack.update({
      where: { id: row.id },
      data: {
        ...scalarEdits,
        ...(slides ? { slides } : {}),
      },
    });
    sendSuccess(res, toDto(updated));
  })
);

router.delete(
  '/:id',
  editors,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = idSchema.parse(req.params.id);
    await ownedPack(orgId, id);
    await prisma.studioPack.delete({ where: { id } });
    sendSuccess(res, { ok: true });
  })
);

export const STUDIO_BRIEF_LIMIT = STUDIO_BRIEF_MAX;
export default router;
