import { Router, Request, Response } from 'express';
import prisma from '../../config/database';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { loadPermissions, requirePermission } from '../../middleware/permissions';
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
import {
  BUSINESS_INDUSTRIES,
  clearProfileSource,
  getOrgProfile,
  saveOrgProfile,
  saveProfileSource,
} from './org-profile';
import { extractPdfText } from '../ai/ingest.service';
import {
  requireActiveCommercialOnMutation,
  requireFeatureOnMutation,
} from '../../middleware/plan-guard';

const router = Router();

const profilePatchSchema = z.object({
  companyName: z.string().min(2).max(120).optional(),
  description: z.string().max(512).optional(),
  industry: z.string().max(64).optional(),
  website: z.string().max(256).optional(),
  email: z.string().email().max(128).optional().or(z.literal('')),
  address: z.string().max(256).optional(),
  aiNotes: z.string().max(2000).optional(),
  audience: z.string().max(500).optional().nullable(),
  valueProps: z.array(z.string().max(200)).max(8).optional(),
  defaultLocale: z.string().max(16).optional(),
  timezone: z.string().max(64).optional(),
});

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
  awayMessageEnabled: z.boolean().optional(),
  awayMessage: z.string().max(1000).optional(),
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
  customChatCreditsIncluded: z.number().int().min(0).optional(),
  customCallingMinutesIncluded: z.number().int().min(0).optional(),
});

const adminGuard = [
  authenticate,
  requireOrg,
  requireActiveCommercialOnMutation(),
  loadOrgRole,
  requireOrgRole('OWNER', 'ADMIN'),
  loadPermissions,
  requirePermission('manageSettings'),
];
const aiAdminGuard = [
  ...adminGuard,
  requireFeatureOnMutation('ai'),
];

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
  ...adminGuard,
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
  ...aiAdminGuard,
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
  '/profile',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await getOrgProfile(req.user!.organizationId!);
    sendSuccess(res, { profile, industries: BUSINESS_INDUSTRIES });
  })
);

router.post(
  '/profile/source',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length < 32) {
      throw new AppError('Upload a PDF (max 2 MB)', 400);
    }
    const rawName = String(req.headers['x-file-name'] || 'business.pdf');
    const fileName = rawName.replace(/[^\w.\- ()]+/g, '').slice(0, 120) || 'business.pdf';
    let text = '';
    try {
      text = await extractPdfText(body);
    } catch {
      throw new AppError('Could not read that PDF. Export it as a text PDF and try again.', 400);
    }
    try {
      const profile = await saveProfileSource(req.user!.organizationId!, {
        fileName,
        bytes: body.length,
        text,
      });
      sendSuccess(res, { profile, industries: BUSINESS_INDUSTRIES });
    } catch (error) {
      throw new AppError(error instanceof Error ? error.message : 'Could not save the PDF', 400);
    }
  })
);

router.delete(
  '/profile/source',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await clearProfileSource(req.user!.organizationId!);
    sendSuccess(res, { profile, industries: BUSINESS_INDUSTRIES });
  })
);

router.patch(
  '/profile',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = profilePatchSchema.parse(req.body);
    const profile = await saveOrgProfile(req.user!.organizationId!, data);
    sendSuccess(res, { profile, industries: BUSINESS_INDUSTRIES });
  })
);

const uiTogglesSchema = z.object({
  hiddenModules: z.array(z.string()).optional(),
  hiddenSettingsTabs: z.array(z.string()).optional(),
});

router.get(
  '/ui-toggles',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId! },
      select: { settings: true },
    });
    const settings = (org?.settings as Record<string, unknown>) || {};
    const uiToggles = (settings.uiToggles as Record<string, unknown>) || {
      hiddenModules: [],
      hiddenSettingsTabs: [],
    };
    sendSuccess(res, {
      hiddenModules: Array.isArray(uiToggles.hiddenModules) ? uiToggles.hiddenModules : [],
      hiddenSettingsTabs: Array.isArray(uiToggles.hiddenSettingsTabs)
        ? uiToggles.hiddenSettingsTabs
        : [],
    });
  })
);

router.patch(
  '/ui-toggles',
  ...adminGuard,
  asyncHandler(async (req: Request, res: Response) => {
    const data = uiTogglesSchema.parse(req.body);
    const orgId = req.user!.organizationId!;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });

    const current = (org?.settings as Record<string, unknown>) || {};
    const currentUiToggles = (current.uiToggles as Record<string, unknown>) || {};

    const updatedToggles = {
      hiddenModules: data.hiddenModules ?? currentUiToggles.hiddenModules ?? [],
      hiddenSettingsTabs: data.hiddenSettingsTabs ?? currentUiToggles.hiddenSettingsTabs ?? [],
    };

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: {
          ...current,
          uiToggles: updatedToggles,
        },
      },
      select: { settings: true },
    });

    const settings = (updated.settings as Record<string, unknown>) || {};
    sendSuccess(res, settings.uiToggles);
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
    const { sanitizeTemplateRejectionAlert } = await import('../templates/customer-rejection-reason');
    const templateRejections = (alerts.templateRejections || []).map((row) =>
      sanitizeTemplateRejectionAlert(row as Record<string, unknown>)
    );
    sendSuccess(res, {
      templateRejections,
      qualityRating: alerts.qualityRating || [],
      accountAlerts: alerts.accountAlerts || [],
    });
  })
);

router.delete(
  '/alerts/template-rejections',
  authenticate,
  requireOrg,
  requireOrgRole('ADMIN', 'OWNER'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const current = (org?.settings as Record<string, unknown>) || {};
    const alerts = (current.alerts as Record<string, unknown>) || {};
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        settings: {
          ...current,
          alerts: { ...alerts, templateRejections: [] },
        } as object,
      },
    });
    sendSuccess(res, { cleared: true });
  })
);

export default router;

