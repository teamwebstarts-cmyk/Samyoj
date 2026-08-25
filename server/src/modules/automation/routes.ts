import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { processAutomations, isBusinessHours } from './engine';
import { getAutomationAnalytics } from './analytics';
import { detectAutomationConflicts, previewAutomationConflicts } from './conflicts';
import { checkQuota } from '../billing/entitlements.service';
import { requireActiveCommercialOnMutation } from '../../middleware/plan-guard';
import {
  resolveActiveWhatsappNumber,
  automationsForNumberFilter,
  scopedAutomationWhere,
} from '../whatsapp/active-number';

const router = Router();
const memberGuard = [
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  requireActiveCommercialOnMutation(),
] as const;
const adminGuard = [
  authenticate,
  requireOrg,
  resolveActiveWhatsappNumber,
  requireActiveCommercialOnMutation(),
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
] as const;

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
    const numberId = req.activeWhatsappNumberId!;
    const requestedDays = Number.parseInt((req.query.days as string) || '30', 10);
    const days = Number.isFinite(requestedDays) ? Math.min(Math.max(1, requestedDays), 3650) : 30;
    const analytics = await getAutomationAnalytics(orgId, days, numberId);
    sendSuccess(res, analytics);
  })
);

router.get(
  '/conflicts',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const conflicts = await detectAutomationConflicts(orgId, req.activeWhatsappNumberId!);
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
    const conflicts = await previewAutomationConflicts(orgId, proposed, req.activeWhatsappNumberId!);
    sendSuccess(res, { conflicts });
  })
);

router.get(
  '/',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId!;
    const { search, triggerType, enabled, page = '1', limit = '10' } = req.query;

    const where: Prisma.AutomationWhereInput = {
      organizationId: orgId,
      ...automationsForNumberFilter(numberId),
    };
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }
    if (triggerType) {
      where.triggerType = triggerType as Prisma.EnumTriggerTypeFilter['equals'];
    }
    if (enabled === 'true') where.enabled = true;
    if (enabled === 'false') where.enabled = false;

    const requestedPage = Number.parseInt(page as string, 10);
    const requestedLimit = Number.parseInt(limit as string, 10);
    const pageNum = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
    const limitNum = Number.isFinite(requestedLimit) ? Math.min(Math.max(1, requestedLimit), 100) : 10;
    const skip = (pageNum - 1) * limitNum;

    const [automations, total, active, paused] = await Promise.all([
      prisma.automation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.automation.count({ where }),
      prisma.automation.count({ where: { organizationId: orgId, ...automationsForNumberFilter(numberId), enabled: true } }),
      prisma.automation.count({ where: { organizationId: orgId, ...automationsForNumberFilter(numberId), enabled: false } }),
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
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    if (!numberId) {
      throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
    }

    const automation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
      if (data.enabled) {
        const quotaCheck = await checkQuota(orgId, 'publishedWorkflows', 1);
        if (!quotaCheck.allowed) {
          throw new AppError(
            402,
            quotaCheck.reason ||
              `Active workflow limit reached (${quotaCheck.used}/${quotaCheck.limit}). Upgrade to Growth for unlimited workflows.`,
            quotaCheck.code
          );
        }
      }
      return tx.automation.create({
        data: {
          organizationId: orgId,
          whatsappNumberId: numberId,
          name: data.name,
          triggerType: data.triggerType,
          config: data.config as Prisma.InputJsonValue,
          enabled: data.enabled,
        },
      });
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
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId!;
    const data = updateAutomationSchema.parse(req.body);

    const automation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
      const existing = await tx.automation.findFirst({
        where: scopedAutomationWhere(orgId, numberId, id),
      });
      if (!existing) throw new AppError(404, 'Automation not found');

      if (data.enabled === true && !existing.enabled) {
        const quotaCheck = await checkQuota(orgId, 'publishedWorkflows', 1);
        if (!quotaCheck.allowed) {
          throw new AppError(
            402,
            quotaCheck.reason ||
              `Active workflow limit reached (${quotaCheck.used}/${quotaCheck.limit}). Upgrade to Growth for unlimited workflows.`,
            quotaCheck.code
          );
        }
      }

      return tx.automation.update({
        where: { id },
        data: {
          ...data,
          config: data.config ? (data.config as Prisma.InputJsonValue) : undefined,
        },
      });
    });

    sendSuccess(res, automation);
  })
);

router.delete(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.automation.deleteMany({
      where: scopedAutomationWhere(req.user!.organizationId!, req.activeWhatsappNumberId, paramId(req)),
    });
    sendSuccess(res, { deleted: true });
  })
);

export default router;
export { processAutomations, isBusinessHours };
