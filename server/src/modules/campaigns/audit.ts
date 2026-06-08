import prisma from '../../config/database';

export async function logCampaignAudit(
  organizationId: string,
  userId: string | undefined,
  action: string,
  details: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: userId ?? null,
      action,
      resource: 'campaign',
      details: details as object,
    },
  });
}
