import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg } from '../../middleware/auth';
import { AppError, sendSuccess, asyncHandler, paramId } from '../../utils/response';
import { phoneFieldSchema } from '../../utils/phone';
import { broadcastQueue } from '../../config/queues';
import { finalizeCampaignIfDone, syncRunningCampaignStatuses } from '../messages/service';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const router = Router();

router.get(
  '/',
  authenticate,
  requireOrg,
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
        where: { organizationId: orgId, status: { in: ['RUNNING', 'SCHEDULED'] } },
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

const recipientSchema = z.object({
  phone: phoneFieldSchema,
  name: z.string().optional(),
});

const createCampaignSchema = z.object({
  name: z.string().min(1),
  templateName: z.string().min(1),
  recipients: z.array(recipientSchema).min(1),
  scheduledAt: z.string().datetime().optional(),
});

router.post(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = createCampaignSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: orgId,
        name: data.name,
        templateName: data.templateName,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        totalContacts: data.recipients.length,
        recipients: {
          create: data.recipients.map((r) => ({
            phone: r.phone,
            name: r.name,
          })),
        },
      },
      include: { recipients: true },
    });

    sendSuccess(res, campaign, 201);
  })
);

router.get(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
      include: { recipients: true },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');
    sendSuccess(res, campaign);
  })
);

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  templateName: z.string().min(1).optional(),
  recipients: z.array(recipientSchema).min(1).optional(),
});

router.patch(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = updateCampaignSchema.parse(req.body);
    const id = paramId(req);
    const orgId = req.user!.organizationId!;

    const existing = await prisma.campaign.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Campaign not found');
    if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
      throw new AppError(400, 'Only draft or scheduled campaigns can be edited');
    }

    const campaign = await prisma.$transaction(async (tx) => {
      if (data.recipients) {
        await tx.campaignRecipient.deleteMany({ where: { campaignId: id } });
        await tx.campaignRecipient.createMany({
          data: data.recipients.map((r) => ({
            campaignId: id,
            phone: r.phone,
            name: r.name,
          })),
        });
      }

      return tx.campaign.update({
        where: { id },
        data: {
          name: data.name,
          templateName: data.templateName,
          totalContacts: data.recipients ? data.recipients.length : undefined,
        },
        include: { recipients: true },
      });
    });

    sendSuccess(res, campaign);
  })
);

router.delete(
  '/:id',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const orgId = req.user!.organizationId!;

    const existing = await prisma.campaign.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Campaign not found');
    if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
      throw new AppError(400, 'Only draft or scheduled campaigns can be deleted');
    }

    await prisma.campaign.delete({ where: { id } });
    sendSuccess(res, { deleted: true });
  })
);

router.post(
  '/:id/send',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const id = paramId(req);
    const orgId = req.user!.organizationId!;

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: orgId },
      include: { recipients: true },
    });

    if (!campaign) throw new AppError(404, 'Campaign not found');
    if (campaign.status === 'RUNNING') throw new AppError(400, 'Campaign already running');

    if (campaign.recipients.length === 0) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED' },
      });
      throw new AppError(400, 'Campaign has no recipients');
    }

    const { getOrgWhatsappContext } = await import('../whatsapp/context');
    const { MetaWhatsAppService, getTemplateDisplayText } = await import('../whatsapp/meta.service');
    const { whatsappNumber, wabaId, accessToken } = await getOrgWhatsappContext(orgId);

    await MetaWhatsAppService.ensureWabaSubscribed(wabaId, accessToken);

    const template = await MetaWhatsAppService.getMessageTemplate(
      wabaId,
      accessToken,
      campaign.templateName
    );
    if (!template) {
      throw new AppError(
        400,
        `Template "${campaign.templateName}" not found or not approved on your WhatsApp account.`
      );
    }
    if (template.status !== 'APPROVED') {
      throw new AppError(400, `Template "${campaign.templateName}" is not approved (status: ${template.status}).`);
    }
    const templateLanguage = template.language || 'en_US';
    const templateContent = getTemplateDisplayText(template, campaign.templateName);

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'RUNNING', sentCount: 0, failedCount: 0 },
    });

    const batchSize = 50;
    const totalBatches = Math.ceil(campaign.recipients.length / batchSize);

    for (let i = 0; i < campaign.recipients.length; i += batchSize) {
      const batch = campaign.recipients.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);
      await broadcastQueue.add(
        'send-broadcast-batch',
        {
          campaignId: campaign.id,
          organizationId: orgId,
          whatsappNumberDbId: whatsappNumber.id,
          phoneNumberId: whatsappNumber.phoneNumberId,
          encryptedToken: whatsappNumber.accessToken,
          wabaId,
          templateName: campaign.templateName,
          templateLanguage,
          templateContent,
          recipients: batch.map((r: { id: string; phone: string; name?: string | null }) => ({
            id: r.id,
            phone: r.phone,
            name: r.name ?? undefined,
          })),
          isLastBatch: batchIndex === totalBatches - 1,
        },
        { delay: i * 1000 }
      );
    }

    sendSuccess(res, { message: 'Campaign queued for sending', recipientCount: campaign.recipients.length });
  })
);

router.get(
  '/:id/stats',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findFirst({
      where: { id: paramId(req), organizationId: req.user!.organizationId! },
    });
    if (!campaign) throw new AppError(404, 'Campaign not found');

    sendSuccess(res, {
      total: campaign.totalContacts,
      sent: campaign.sentCount,
      delivered: campaign.deliveredCount,
      failed: campaign.failedCount,
      deliveryRate: campaign.totalContacts
        ? ((campaign.deliveredCount / campaign.totalContacts) * 100).toFixed(1)
        : '0',
    });
  })
);

export default router;
