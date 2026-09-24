import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { processAutomations, isBusinessHours } from './engine';
import { getAutomationAnalytics } from './analytics';
import {
  automationScopeFilter,
  detectAutomationConflicts,
  previewAutomationConflicts,
  assertNoBlockingConflicts,
} from './conflicts';
import { sendAutomationTestToPhone } from './test-send';
import { checkQuota } from '../billing/entitlements.service';
import { requireActiveCommercialOnMutation } from '../../middleware/plan-guard';
import {
  resolveActiveWhatsappNumberId,
} from '../whatsapp/active-number';

const router = Router();

const resolveOptionalAutomationNumber = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (req.user?.organizationId) {
      req.activeWhatsappNumberId = await resolveActiveWhatsappNumberId(
        req.user.organizationId,
        req.headers['x-whatsapp-number-id']
      );
    }
    next();
  } catch (err) {
    next(err);
  }
};

const memberGuard = [
  authenticate,
  requireOrg,
  resolveOptionalAutomationNumber,
  requireActiveCommercialOnMutation(),
] as const;
const adminGuard = [
  authenticate,
  requireOrg,
  resolveOptionalAutomationNumber,
  requireActiveCommercialOnMutation(),
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
  loadPermissions,
  requirePermission('manageAutomations'),
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

function isInstagramKeyword(triggerType: string, config: unknown): boolean {
  return (
    triggerType === 'KEYWORD' &&
    Boolean(config && typeof config === 'object' && (config as Record<string, unknown>).platform === 'IG')
  );
}

function requireWhatsappNumber(numberId: string | undefined): string {
  if (!numberId) {
    throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
  }
  return numberId;
}

async function requireInstagramChannel(
  db: typeof prisma | Prisma.TransactionClient,
  organizationId: string
): Promise<void> {
  const channel = await db.channel.findFirst({
    where: { organizationId, platform: 'IG', isActive: true },
    select: { id: true },
  });
  if (!channel) {
    throw new AppError(400, 'Connect Instagram before creating an Instagram automation.');
  }
}

router.get(
  '/analytics',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = requireWhatsappNumber(req.activeWhatsappNumberId);
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
    const conflicts = await detectAutomationConflicts(orgId, req.activeWhatsappNumberId);
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
    if (!req.activeWhatsappNumberId && (proposed.kind === 'flow' || proposed.config?.platform !== 'IG')) {
      throw new AppError(400, 'Connect a WhatsApp number for WhatsApp automation conflicts.');
    }
    const conflicts = await previewAutomationConflicts(orgId, proposed, req.activeWhatsappNumberId);
    sendSuccess(res, { conflicts });
  })
);

router.get(
  '/',
  ...memberGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = req.activeWhatsappNumberId;
    const { search, triggerType, enabled, page = '1', limit = '10' } = req.query;

    const where: Prisma.AutomationWhereInput = {
      organizationId: orgId,
      ...automationScopeFilter(numberId),
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
      prisma.automation.count({ where: { organizationId: orgId, ...automationScopeFilter(numberId), enabled: true } }),
      prisma.automation.count({ where: { organizationId: orgId, ...automationScopeFilter(numberId), enabled: false } }),
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
    const instagramKeyword = isInstagramKeyword(data.triggerType, data.config);
    const numberIdForStorage = instagramKeyword ? undefined : requireWhatsappNumber(numberId);

    const automation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
      if (instagramKeyword) await requireInstagramChannel(tx, orgId);
      if (data.enabled) {
        await assertNoBlockingConflicts(
          orgId,
          {
            kind: 'automation',
            name: data.name,
            triggerType: data.triggerType,
            config: data.config,
            enabled: true,
          },
          numberIdForStorage,
          tx
        );
      }
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
          whatsappNumberId: numberIdForStorage,
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
    const numberId = req.activeWhatsappNumberId;
    const data = updateAutomationSchema.parse(req.body);

    const automation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId} FOR UPDATE`;
      const existing = await tx.automation.findFirst({
        where: { organizationId: orgId, id, ...automationScopeFilter(numberId) },
      });
      if (!existing) throw new AppError(404, 'Automation not found');

      const nextTriggerType = data.triggerType ?? existing.triggerType;
      const nextConfig = data.config ?? (existing.config as Record<string, unknown>);
      const nextInstagramKeyword = isInstagramKeyword(nextTriggerType, nextConfig);
      const nextNumberId = nextInstagramKeyword ? null : requireWhatsappNumber(numberId);
      if (nextInstagramKeyword) await requireInstagramChannel(tx, orgId);
      const nextEnabled = data.enabled ?? existing.enabled;
      if (nextEnabled) {
        await assertNoBlockingConflicts(
          orgId,
          {
            kind: 'automation',
            excludeId: id,
            name: data.name ?? existing.name,
            triggerType: nextTriggerType,
            config: nextConfig,
            enabled: true,
          },
          nextNumberId ?? undefined,
          tx
        );
      }

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
          whatsappNumberId: nextNumberId,
          config: nextConfig as Prisma.InputJsonValue,
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
      where: {
        organizationId: req.user!.organizationId!,
        id: paramId(req),
        ...automationScopeFilter(req.activeWhatsappNumberId),
      },
    });
    sendSuccess(res, { deleted: true });
  })
);

const automationTestSchema = z.object({
  phone: z.string().min(8),
});

router.post(
  '/:id/test',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const numberId = requireWhatsappNumber(req.activeWhatsappNumberId);
    const body = automationTestSchema.parse(req.body);
    const automation = await prisma.automation.findFirst({
      where: { organizationId: orgId, id: paramId(req), ...automationScopeFilter(numberId) },
      select: { config: true },
    });
    if (isInstagramKeyword('KEYWORD', automation?.config)) {
      throw new AppError(400, 'Instagram comment automations cannot send a WhatsApp test message.');
    }
    const result = await sendAutomationTestToPhone({
      organizationId: orgId,
      whatsappNumberId: numberId!,
      automationId: paramId(req),
      phone: body.phone,
    });
    sendSuccess(res, result);
  })
);

export default router;
export { processAutomations, isBusinessHours };
