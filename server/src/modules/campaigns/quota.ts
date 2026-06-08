import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { DEFAULT_CAMPAIGN_SETTINGS, type CampaignSettings } from './types';

export async function getCampaignSettings(organizationId: string): Promise<CampaignSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings as Record<string, unknown>) || {};
  const campaigns = (settings.campaigns as CampaignSettings) || {};
  return { ...DEFAULT_CAMPAIGN_SETTINGS, ...campaigns };
}

export async function getDailySendUsage(organizationId: string) {
  const settings = await getCampaignSettings(organizationId);
  const limit = settings.dailySendLimit ?? DEFAULT_CAMPAIGN_SETTINGS.dailySendLimit!;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sentToday = await prisma.campaignRecipient.count({
    where: {
      campaign: { organizationId },
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      sentAt: { gte: startOfDay },
    },
  });

  return {
    sentToday,
    limit,
    remaining: Math.max(0, limit - sentToday),
    batchSize: settings.batchSize ?? DEFAULT_CAMPAIGN_SETTINGS.batchSize!,
    batchDelayMs: settings.batchDelayMs ?? DEFAULT_CAMPAIGN_SETTINGS.batchDelayMs!,
  };
}

export async function assertDailySendQuota(organizationId: string, recipientCount: number) {
  const settings = await getCampaignSettings(organizationId);
  const limit = settings.dailySendLimit ?? DEFAULT_CAMPAIGN_SETTINGS.dailySendLimit!;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const sentToday = await prisma.campaignRecipient.count({
    where: {
      campaign: { organizationId },
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      sentAt: { gte: startOfDay },
    },
  });

  if (sentToday + recipientCount > limit) {
    throw new AppError(
      429,
      `Daily campaign send limit exceeded (${sentToday}/${limit} sent today, ${recipientCount} requested).`
    );
  }
}
