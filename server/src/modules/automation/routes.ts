import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { processAutomations, isBusinessHours } from './engine';
import { getAutomationAnalytics } from './analytics';
import { detectAutomationConflicts, previewAutomationConflicts } from './conflicts';

const router = Router();
const memberGuard = [authenticate, requireOrg] as const;
const adminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')] as const;

const automationSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum([
    'KEYWORD',
    'WELCOME',
    'AWAY',
    'BUSINESS_HOURS',
    'LEAD_CAPTURE',
    'AI_CHATBOT',
  ]),
  config: z.record(z.unknown()),
  enabled: z.boolean().default(true),
});

router.get(
  '/analytics',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const days = parseInt((req.query.days as string) || '30', 10);
    const analytics = await getAutomationAnalytics(orgId, days);
    sendSuccess(res, analytics);
  })
);

router.get(
  '/conflicts',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const conflicts = await detectAutomationConflicts(orgId);
    sendSuccess(res, { conflicts });
  })
);

const conflictPreviewSchema = z.object({
  kind: z.enum(['automation', 'flow']),
  excludeId: z.string().min(1).optional(),
  name: z.string().min(1),
  triggerType: z.string().min(1),
  config: z.record(z.unknown()).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

router.post(
  '/conflicts/preview',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const proposed = conflictPreviewSchema.parse(req.body);
    const conflicts = await previewAutomationConflicts(orgId, proposed);
    sendSuccess(res, { conflicts });
  })
);

router.get(
  '/',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { search, triggerType, enabled, page = '1', limit = '10' } = req.query;

    const where: Prisma.AutomationWhereInput = { organizationId: orgId };
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }
    if (triggerType) {
      where.triggerType = triggerType as Prisma.EnumTriggerTypeFilter['equals'];
    }
    if (enabled === 'true') where.enabled = true;
    if (enabled === 'false') where.enabled = false;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [automations, total, active, paused] = await Promise.all([
      prisma.automation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.automation.count({ where }),
      prisma.automation.count({ where: { organizationId: orgId, enabled: true } }),
      prisma.automation.count({ where: { organizationId: orgId, enabled: false } }),
    ]);

    sendSuccess(res, {
      automations,
      total,
      page: pageNum,
      limit: limitNum,
      summary: { total: active + paused, active, paused },
    });
  })
);

router.post(
  '/',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = automationSchema.parse(req.body);

    const automation = await prisma.automation.create({
      data: {
        organizationId: req.user!.organizationId!,
        name: data.name,
        triggerType: data.triggerType,
        config: data.config as Prisma.InputJsonValue,
        enabled: data.enabled,
      },
    });

    sendSuccess(res, automation, 201);
  })
);

const updateAutomationSchema = automationSchema.partial();

router.patch(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const existing = await prisma.automation.findFirst({
      where: { id, organizationId: req.user!.organizationId! },
    });
    if (!existing) throw new AppError(404, 'Automation not found');

    const data = updateAutomationSchema.parse(req.body);

    const automation = await prisma.automation.update({
      where: { id },
      data: {
        ...data,
        config: data.config ? (data.config as Prisma.InputJsonValue) : undefined,
      },
    });

    sendSuccess(res, automation);
  })
);

router.delete(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.automation.deleteMany({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
    });
    sendSuccess(res, { deleted: true });
  })
);

export default router;
export { processAutomations, isBusinessHours };
