import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { authenticateJwtOrApiKey } from '../../middleware/authenticate-jwt-or-api-key';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { Prisma } from '@prisma/client';
import { logCampaignAudit } from './audit';
import {
  cancelCampaign,
  canEditCampaign,
  duplicateCampaign,
  getCampaignAnalytics,
  pauseCampaign,
  persistRecipients,
  processScheduledCampaigns,
  queueCampaignSend,
  recipientsToCsv,
  resolveAudienceRecipients,
  resumeCampaign,
  retryFailedRecipients,
  sendTestMessage,
  syncRunningCampaignStatuses,
} from './service';
import { getDailySendUsage } from './quota';
import {
  createCampaignSchema,
  previewAudienceSchema,
  testSendSchema,
  updateCampaignSchema,
  type AudienceType,
} from './types';

const router = Router();
const adminGuard = [authenticateJwtOrApiKey, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')];
const readGuard = [authenticateJwtOrApiKey, requireOrg];

router.get(
  '/',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { search, status, page = '1', limit = '10' } = req.query;
    await syncRunningCampaignStatuses(orgId);

    const where: Prisma.CampaignWhereInput = { organizationId: orgId };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { templateName: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status as Prisma.EnumCampaignStatusFilter['equals'];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [campaigns, total, running, completed, sentAgg] = await Promise.all([
      prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.campaign.count({ where }),
      prisma.campaign.count({
        where: { organizationId: orgId, status: { in: ['RUNNING', 'SCHEDULED', 'PAUSED'] } },
      }),
      prisma.campaign.count({ where: { organizationId: orgId, status: 'COMPLETED' } }),
      prisma.campaign.aggregate({
        where: { organizationId: orgId },
        _sum: { sentCount: true },
      }),
    ]);

    const allTotal = await prisma.campaign.count({ where: { organizationId: orgId } });

    sendSuccess(res, {
      campaigns,
      total,
      page: pageNum,
      limit: limitNum,
      summary: {
        total: allTotal,
        running,
        completed,
        sent: sentAgg._sum.sentCount ?? 0,
      },
    });
  })
);

router.get(
  '/quota',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const usage = await getDailySendUsage(req.user!.organizationId!);
    sendSuccess(res, usage);
  })
);

router.post(
  '/preview-audience',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = previewAudienceSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const manualRecipients = (data.recipients || []).map((r) => ({
      phone: r.phone,
      name: r.name,
      variables: r.variables,
    }));

    const resolved = await resolveAudienceRecipients(
      orgId,
      data.audienceType,
      data.audienceConfig,
      manualRecipients
    );

    sendSuccess(res, { count: resolved.length });
  })
);

router.post(
  '/',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createCampaignSchema.parse(req.body);
    const orgId = req.user!.organizationId!;
    const userId = req.user!.userId;

    const manualRecipients = (data.recipients || []).map((r) => ({
      phone: r.phone,
      name: r.name,
      variables: r.variables,
    }));

    const resolved = await resolveAudienceRecipients(
      orgId,
      data.audienceType,
      data.audienceConfig,
      manualRecipients
    );

    if (!resolved.length) {
      throw new AppError(400, 'Campaign must have at least one recipient');
    }

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: orgId,
        name: data.name,
        templateName: data.templateName,
        templateLanguage: data.templateLanguage,
        templateParams: data.templateParams ? (data.templateParams as object) : undefined,
        audienceType: data.audienceType,
        audienceConfig: data.audienceConfig ? (data.audienceConfig as object) : undefined,
        whatsappNumberId: data.whatsappNumberId,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        timezone: data.timezone,
        totalContacts: resolved.length,
        createdById: userId,
        recipients: {
          create: resolved.map((r) => ({
            phone: r.phone,
            name: r.name,
            variables: r.variables ? (r.variables as object) : undefined,
          })),
        },
      },
      include: { recipients: true },
    });

    await logCampaignAudit(orgId, userId, 'campaign.create', { campaignId: campaign.id, name: campaign.name });
    sendSuccess(res, campaign, 201);
  })
);

router.get(
  '/:id',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
      include: {
        recipients: {
          orderBy: { createdAt: 'asc' },
          take: 500,
        },
      },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');
    sendSuccess(res, campaign);
  })
);

router.get(
  '/:id/recipients',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);
    const { status, page = '1', limit = '50' } = req.query;

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');

    const where: Prisma.CampaignRecipientWhereInput = { campaignId: id };
    if (status) where.status = status as Prisma.EnumMessageStatusFilter['equals'];

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const [recipients, total] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.campaignRecipient.count({ where }),
    ]);

    sendSuccess(res, { recipients, total, page: pageNum, limit: limitNum });
  })
);

router.patch(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateCampaignSchema.parse(req.body);
    const id = paramId(req);
    const orgId = req.user!.organizationId!;

    const existing = await prisma.campaign.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Campaign not found');
    if (!canEditCampaign(existing.status)) {
      throw new AppError(400, 'Only draft or scheduled campaigns can be edited');
    }

    let totalContacts = existing.totalContacts;

    if (data.recipients || data.audienceType || data.audienceConfig) {
      const audienceType = (data.audienceType || existing.audienceType) as AudienceType;
      const audienceConfig =
        data.audienceConfig ||
        (existing.audienceConfig as { tags?: string[]; contactIds?: string[] } | null) ||
        undefined;

      let manualRecipients: import('./recipients').ResolvedRecipient[] = [];
      if (data.recipients) {
        manualRecipients = data.recipients.map((r) => ({
          phone: r.phone,
          name: r.name,
          variables: r.variables,
        }));
      } else if (audienceType === 'MANUAL') {
        const existingRecipients = await prisma.campaignRecipient.findMany({
          where: { campaignId: id },
          select: { phone: true, name: true, variables: true },
        });
        manualRecipients = existingRecipients.map((r) => ({
          phone: r.phone,
          name: r.name ?? undefined,
          variables: r.variables as { body?: string[]; header?: string[] } | undefined,
        }));
      }

      const resolved = await resolveAudienceRecipients(
        orgId,
        audienceType,
        audienceConfig,
        manualRecipients
      );
      if (!resolved.length) throw new AppError(400, 'Campaign must have at least one recipient');
      totalContacts = await persistRecipients(id, resolved);
    }

    const scheduledAt =
      data.scheduledAt === null
        ? null
        : data.scheduledAt
          ? new Date(data.scheduledAt)
          : undefined;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: data.name,
        templateName: data.templateName,
        templateLanguage: data.templateLanguage,
        templateParams: data.templateParams ? (data.templateParams as object) : undefined,
        audienceType: data.audienceType,
        audienceConfig: data.audienceConfig ? (data.audienceConfig as object) : undefined,
        whatsappNumberId: data.whatsappNumberId === null ? null : data.whatsappNumberId,
        timezone: data.timezone,
        totalContacts,
        ...(scheduledAt !== undefined
          ? {
              scheduledAt,
              status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
            }
          : {}),
      },
      include: { recipients: true },
    });

    await logCampaignAudit(orgId, req.user!.userId, 'campaign.update', { campaignId: id });
    sendSuccess(res, campaign);
  })
);

router.delete(
  '/:id',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const orgId = req.user!.organizationId!;

    const existing = await prisma.campaign.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new AppError(404, 'Campaign not found');
    if (!canEditCampaign(existing.status)) {
      throw new AppError(400, 'Only draft or scheduled campaigns can be deleted');
    }

    await prisma.campaign.delete({ where: { id } });
    await logCampaignAudit(orgId, req.user!.userId, 'campaign.delete', { campaignId: id });
    sendSuccess(res, { deleted: true });
  })
);

router.post(
  '/:id/send',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const orgId = req.user!.organizationId!;

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: orgId },
      include: { recipients: true },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');

    const result = await queueCampaignSend(campaign, req.user!.userId);
    await logCampaignAudit(orgId, req.user!.userId, 'campaign.send', {
      campaignId: id,
      recipientCount: result.recipientCount,
    });

    sendSuccess(res, { message: 'Campaign queued for sending', ...result });
  })
);

router.post(
  '/:id/test',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const { phone } = testSendSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const campaign = await prisma.campaign.findFirst({
      where: { id: paramId(req), organizationId: orgId },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');

    const result = await sendTestMessage(campaign, phone, req.user!.userId);
    sendSuccess(res, { message: 'Test message sent', ...result });
  })
);

router.post(
  '/:id/pause',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    await pauseCampaign(paramId(req), req.user!.organizationId!, req.user!.userId);
    sendSuccess(res, { paused: true });
  })
);

router.post(
  '/:id/resume',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
      include: { recipients: true },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');
    await resumeCampaign(campaign, req.user!.userId);
    sendSuccess(res, { resumed: true });
  })
);

router.post(
  '/:id/cancel',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    await cancelCampaign(paramId(req), req.user!.organizationId!, req.user!.userId);
    sendSuccess(res, { cancelled: true });
  })
);

router.post(
  '/:id/retry-failed',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
      include: { recipients: true },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');
    const result = await retryFailedRecipients(campaign, req.user!.userId);
    sendSuccess(res, result);
  })
);

router.post(
  '/:id/duplicate',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
      include: { recipients: true },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');
    const copy = await duplicateCampaign(campaign, req.user!.userId);
    sendSuccess(res, copy, 201);
  })
);

router.get(
  '/:id/stats',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const analytics = await getCampaignAnalytics(paramId(req), req.user!.organizationId!);
    if (!analytics) throw new AppError(404, 'Campaign not found');
    sendSuccess(res, analytics.campaign);
  })
);

router.get(
  '/:id/analytics',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const analytics = await getCampaignAnalytics(paramId(req), req.user!.organizationId!);
    if (!analytics) throw new AppError(404, 'Campaign not found');
    sendSuccess(res, analytics);
  })
);

router.get(
  '/:id/export',
  ...readGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const id = paramId(req);

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: orgId },
      select: { name: true },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');

    const recipients = await prisma.campaignRecipient.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'asc' },
    });

    const csv = recipientsToCsv(recipients);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${campaign.name.replace(/[^a-z0-9-_]/gi, '_')}-results.csv"`
    );
    res.send(csv);
  })
);

router.post(
  '/process-scheduled',
  ...adminGuard,
  asyncHandler(async (_req: Request, res: Response) => {
    await processScheduledCampaigns();
    sendSuccess(res, { processed: true });
  })
);

export default router;
