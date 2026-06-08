import prisma from '../../config/database';

export async function getTemplateUsage(organizationId: string, templateName: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId, templateName },
    select: {
      id: true,
      name: true,
      status: true,
      totalContacts: true,
      sentCount: true,
      deliveredCount: true,
      failedCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const totals = campaigns.reduce(
    (acc, c) => ({
      campaignCount: acc.campaignCount + 1,
      totalSent: acc.totalSent + (c.sentCount || 0),
      totalDelivered: acc.totalDelivered + (c.deliveredCount || 0),
      totalFailed: acc.totalFailed + (c.failedCount || 0),
    }),
    { campaignCount: 0, totalSent: 0, totalDelivered: 0, totalFailed: 0 }
  );

  return { campaigns, totals };
}
