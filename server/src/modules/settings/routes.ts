import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { z } from 'zod';
import { DEFAULT_BUSINESS_HOURS } from '../flows/types';
import {
  getOrgAiSettings,
  getOrgUsageSummary,
  saveOrgAiSettings,
  sanitizeSettingsForClient,
} from '../ai/org-ai.service';
import { DEFAULT_CAMPAIGN_SETTINGS, type CampaignSettings } from '../campaigns/types';
import { getOrgCallingSettings } from '../calling/settings.service';
import { getOrgFeatureFlags, setFeatureFlag } from './feature-flags';
import { resolveActiveWhatsappNumberId } from '../whatsapp/active-number';

const router = Router();

const campaignSettingsSchema = z.object({
  dailySendLimit: z.number().int().min(1).max(100000).optional(),
  dailyBudgetInr: z.number().min(0).max(1000000).optional(),
  batchSize: z.number().int().min(1).max(500).optional(),
  batchDelayMs: z.number().int().min(0).max(60000).optional(),
  mapFirstBodyVariableToName: z.boolean().optional(),
});

const businessHoursSchema = z.object({
  startHour: z.number().min(0).max(23),
  endHour: z.number().min(1).max(24),
  days: z.array(z.number().min(0).max(6)),
  timezone: z.string().optional(),
});

const aiSettingsSchema = z.object({
  brainProvider: z.enum(['sarvam', 'azure']).optional(),
  useCustomConfig: z.boolean().optional(),
  endpoint: z.string().url().optional().or(z.literal('')),
  apiKey: z.string().optional(),
  deployment: z.string().optional(),
  embeddingDeployment: z.string().optional(),
  apiVersion: z.string().optional(),
  monthlyTokenLimit: z.number().int().min(0).optional(),
});

const adminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER', 'ADMIN')];

router.get(
  '/',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const settings = (org?.settings as Record<string, unknown>) || {};
    const aiSettings = sanitizeSettingsForClient((settings.ai as Record<string, unknown>) || {});

    const calling = await getOrgCallingSettings(orgId);

    sendSuccess(res, {
      businessHours: settings.businessHours || DEFAULT_BUSINESS_HOURS,
      ai: aiSettings,
      campaigns: { ...DEFAULT_CAMPAIGN_SETTINGS, ...(settings.campaigns as CampaignSettings) },
      calling,
    });
  })
);

router.get(
  '/ai/usage',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const days = parseInt(String(req.query.days || '30'), 10);
    const numberId = await resolveActiveWhatsappNumberId(
      orgId,
      req.headers['x-whatsapp-number-id']
    );
    const usage = await getOrgUsageSummary(orgId, days, numberId);
    sendSuccess(res, usage);
  })
);

router.patch(
  '/business-hours',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = businessHoursSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const current = (org?.settings as Record<string, unknown>) || {};

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: {
          ...current,
          businessHours: data,
        },
      },
      select: { settings: true },
    });

    const settings = (updated.settings as Record<string, unknown>) || {};
    sendSuccess(res, { businessHours: settings.businessHours });
  })
);

router.patch(
  '/ai',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const data = aiSettingsSchema.parse(req.body);
    const saved = await saveOrgAiSettings(orgId, data);
    sendSuccess(res, { ai: sanitizeSettingsForClient(saved) });
  })
);

router.get(
  '/ai',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const settings = await getOrgAiSettings(orgId);
    sendSuccess(res, { ai: sanitizeSettingsForClient(settings) });
  })
);

router.patch(
  '/campaigns',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = campaignSettingsSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const current = (org?.settings as Record<string, unknown>) || {};
    const existingCampaigns = (current.campaigns as CampaignSettings) || {};

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: {
          ...current,
          campaigns: { ...DEFAULT_CAMPAIGN_SETTINGS, ...existingCampaigns, ...data },
        },
      },
      select: { settings: true },
    });

    const settings = (updated.settings as Record<string, unknown>) || {};
    sendSuccess(res, {
      campaigns: { ...DEFAULT_CAMPAIGN_SETTINGS, ...(settings.campaigns as CampaignSettings) },
    });
  })
);

router.get(
  '/feature-flags',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const flags = await getOrgFeatureFlags(req.user!.organizationId!);
    sendSuccess(res, { flags });
  })
);

router.patch(
  '/feature-flags/:flag',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const { enabled, metadata } = z
      .object({
        enabled: z.boolean(),
        metadata: z.record(z.unknown()).optional(),
      })
      .parse(req.body);

    const flag = await setFeatureFlag(
      req.user!.organizationId!,
      req.params.flag as string,
      enabled,
      metadata
    );
    sendSuccess(res, { flag: flag.flag, enabled: flag.enabled, metadata: flag.metadata });
  })
);

router.get(
  '/alerts',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: { settings: true },
    });
    const settings = (org?.settings as Record<string, unknown>) || {};
    const alerts = (settings.alerts as Record<string, unknown[]>) || {};
    sendSuccess(res, {
      templateRejections: alerts.templateRejections || [],
      qualityRating: alerts.qualityRating || [],
      accountAlerts: alerts.accountAlerts || [],
    });
  })
);

export default router;
