import prisma from '../../config/database';

export async function getAutomationAnalytics(organizationId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await prisma.automationLog.findMany({
    where: { organizationId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const byTrigger: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const dailyMap = new Map<string, { total: number; success: number; failed: number }>();

  for (const log of logs) {
    byTrigger[log.triggerType] = (byTrigger[log.triggerType] || 0) + 1;
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byStatus[log.status] = (byStatus[log.status] || 0) + 1;

    const day = log.createdAt.toISOString().slice(0, 10);
    const entry = dailyMap.get(day) || { total: 0, success: 0, failed: 0 };
    entry.total++;
    if (log.status === 'success') entry.success++;
    if (log.status === 'failed') entry.failed++;
    dailyMap.set(day, entry);
  }

  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  const recent = logs.slice(0, 50).map((l) => ({
    id: l.id,
    triggerType: l.triggerType,
    action: l.action,
    status: l.status,
    flowId: l.flowId,
    conversationId: l.conversationId,
    error: l.error,
    createdAt: l.createdAt,
  }));

  return {
    days,
    total: logs.length,
    success: logs.filter((l) => l.status === 'success').length,
    failed: logs.filter((l) => l.status === 'failed').length,
    skipped: logs.filter((l) => l.status === 'skipped').length,
    byTrigger,
    byAction,
    byStatus,
    daily,
    recent,
  };
}
