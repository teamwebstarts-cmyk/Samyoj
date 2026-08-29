import prisma from '../../config/database';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('billing-usage');

const USD_TO_INR = 83;

/**
 * Single source of truth for Meta per-conversation benchmark rates (INR).
 * The UI explainer card mirrors these values — update both together.
 * Source: docs/billing/01-PRICING-CATALOG.md (Meta India benchmarks).
 */
export const META_CATEGORY_RATES_INR: Record<string, number> = {
  MARKETING: 0.78,
  UTILITY: 0.3,
  AUTHENTICATION: 0.3,
  SERVICE: 0,
  USER_INITIATED: 0,
  BUSINESS_INITIATED: 0.35,
};

// Kept as an alias for existing imports.
const CATEGORY_RATES_INR = META_CATEGORY_RATES_INR;

export async function pollConversationAnalytics(): Promise<void> {
  const numbers = await prisma.whatsappNumber.findMany({
    where: { isActive: true },
    select: {
      id: true,
      organizationId: true,
      wabaId: true,
      phoneNumberId: true,
      accessToken: true,
    },
  });

  for (let daysAgo = 1; daysAgo <= 7; daysAgo += 1) {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - daysAgo);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);
    const startTs = Math.floor(periodStart.getTime() / 1000);
    const endTs = Math.floor(periodEnd.getTime() / 1000);

    for (const number of numbers) {
      try {
        const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
        const analytics = await MetaWhatsAppService.getConversationAnalytics(
          number.wabaId,
          accessToken,
          startTs,
          endTs
        );

        for (const entry of analytics) {
          const category = (entry.conversation_category || 'SERVICE').toUpperCase();
          const count = entry.conversation || 0;
          const costUsd = entry.cost || 0;
          const costInr = costUsd > 0 ? costUsd * USD_TO_INR : count * (CATEGORY_RATES_INR[category] ?? 0.35);

          await prisma.conversationCharge.upsert({
            where: {
              organizationId_wabaId_phoneNumberId_category_periodStart: {
                organizationId: number.organizationId,
                wabaId: number.wabaId,
                phoneNumberId: number.phoneNumberId,
                category,
                periodStart,
              },
            },
            create: {
              organizationId: number.organizationId,
              wabaId: number.wabaId,
              phoneNumberId: number.phoneNumberId,
              category,
              country: 'IN',
              conversationCount: count,
              costUsd,
              costInr,
              periodStart,
              periodEnd,
            },
            update: {
              conversationCount: count,
              costUsd,
              costInr,
            },
          });
        }
      } catch (err) {
        log.warn('Failed to poll conversation analytics', {
          wabaId: number.wabaId,
          daysAgo,
          error: String(err),
        });
      }
    }
  }
}

export async function pollQualityRatings(): Promise<void> {
  const numbers = await prisma.whatsappNumber.findMany({
    where: { isActive: true },
    select: { id: true, phoneNumberId: true, accessToken: true },
  });

  for (const number of numbers) {
    try {
      const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
      const health = await MetaWhatsAppService.getPhoneNumberHealth(
        number.phoneNumberId,
        accessToken
      );
      const data: {
        qualityRating?: string;
        officialBusinessAccount?: boolean;
        messagingLimitTier?: string;
      } = {};
      if (health.qualityRating) data.qualityRating = health.qualityRating;
      if (health.officialBusinessAccount !== null) {
        data.officialBusinessAccount = health.officialBusinessAccount;
      }
      if (health.messagingLimitTier) data.messagingLimitTier = health.messagingLimitTier;
      if (Object.keys(data).length) {
        await prisma.whatsappNumber.update({
          where: { id: number.id },
          data,
        });
      }
    } catch (err) {
      log.warn('Failed to poll quality rating', {
        phoneNumberId: number.phoneNumberId,
        error: String(err),
      });
    }
  }
}

export async function pollTemplateRejections(): Promise<void> {
  const numbers = await prisma.whatsappNumber.findMany({
    where: { isActive: true },
    select: {
      id: true,
      organizationId: true,
      phoneNumber: true,
      phoneNumberId: true,
      wabaId: true,
      accessToken: true,
    },
  });

  for (const number of numbers) {
    try {
      const accessToken = MetaWhatsAppService.decryptToken(number.accessToken);
      const synced = await MetaWhatsAppService.syncWhatsappConnection(number, accessToken);
      if (synced.updated) {
        await prisma.whatsappNumber.update({
          where: { id: number.id },
          data: {
            wabaId: synced.wabaId,
            phoneNumberId: synced.phoneNumberId,
            phoneNumber: synced.phoneNumber,
          },
        });
      }
      const rejected = await MetaWhatsAppService.listMessageTemplates(synced.wabaId, accessToken, {
        status: 'REJECTED',
        limit: 20,
      });

      if (!rejected.templates.length) continue;

      const { emitProductEvent } = await import('../platform/events');
      emitProductEvent({
        organizationId: number.organizationId,
        name: 'TEMPLATE_REJECTED',
        count: rejected.templates.length,
      });

      const org = await prisma.organization.findUnique({
        where: { id: number.organizationId },
        select: { settings: true },
      });
      const settings = (org?.settings as Record<string, unknown>) || {};
      const alerts = (settings.alerts as Record<string, unknown[]>) || {};
      const existing = (alerts.templateRejections as Record<string, unknown>[]) || [];
      const existingNames = new Set(existing.map((a) => a.templateName));

      const newAlerts = rejected.templates
        .filter((t) => !existingNames.has(t.name))
        .map((t) => ({
          templateName: t.name,
          status: t.status,
          reason: t.rejected_reason,
          severity: 'error' as const,
          createdAt: new Date().toISOString(),
        }));

      if (!newAlerts.length) continue;

      await prisma.organization.update({
        where: { id: number.organizationId },
        data: {
          settings: {
            ...settings,
            alerts: {
              ...alerts,
              templateRejections: [...newAlerts, ...existing].slice(0, 20),
            },
          } as object,
        },
      });
    } catch (err) {
      log.warn('Failed to poll template rejections', {
        wabaId: number.wabaId,
        error: String(err),
      });
    }
  }
}

export async function getOrgUsage(organizationId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [charges, numbers, messagePricing] = await Promise.all([
    prisma.conversationCharge.findMany({
      where: { organizationId, periodStart: { gte: thirtyDaysAgo } },
      orderBy: { periodStart: 'desc' },
    }),
    prisma.whatsappNumber.findMany({
      where: { organizationId, isActive: true },
      select: { phoneNumber: true, qualityRating: true, wabaId: true },
    }),
    prisma.message.findMany({
      where: {
        conversation: { organizationId },
        direction: 'OUTBOUND',
        createdAt: { gte: thirtyDaysAgo },
        metadata: { not: undefined },
      },
      select: { metadata: true },
      take: 1000,
    }),
  ]);

  const byCategory: Record<string, { count: number; costInr: number }> = {};
  let totalCostInr = 0;
  let totalConversations = 0;

  for (const charge of charges) {
    if (!byCategory[charge.category]) {
      byCategory[charge.category] = { count: 0, costInr: 0 };
    }
    byCategory[charge.category].count += charge.conversationCount;
    byCategory[charge.category].costInr += charge.costInr;
    totalCostInr += charge.costInr;
    totalConversations += charge.conversationCount;
  }

  const pricingFromMessages = messagePricing.filter((m) => {
    const meta = m.metadata as { pricing?: unknown } | null;
    return meta?.pricing;
  }).length;

  return {
    period: '30d',
    totalConversations,
    totalCostInr: Math.round(totalCostInr * 100) / 100,
    byCategory,
    qualityRatings: numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      qualityRating: n.qualityRating || 'UNKNOWN',
      wabaId: n.wabaId,
    })),
    messagesWithPricing: pricingFromMessages,
  };
}

export function estimateCampaignCost(
  recipientCount: number,
  category: string = 'MARKETING'
): { recipientCount: number; estimatedCostInr: number; category: string } {
  const rate = CATEGORY_RATES_INR[category.toUpperCase()] ?? CATEGORY_RATES_INR.MARKETING;
  return {
    recipientCount,
    estimatedCostInr: Math.round(recipientCount * rate * 100) / 100,
    category: category.toUpperCase(),
  };
}
