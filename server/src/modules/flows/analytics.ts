import prisma from '../../config/database';
import type { FlowStats } from './types';
import { aggregateSkipReasons } from '../automation/skip-reasons';

export async function incrementFlowStat(
  flowId: string,
  field: 'starts' | 'completions' | 'handoffs' | 'dropoffs',
  nodeId?: string
): Promise<void> {
  const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { stats: true } });
  const stats = ((flow?.stats as unknown as FlowStats) || { starts: 0, completions: 0, handoffs: 0, dropoffs: {} });

  if (field === 'starts') stats.starts += 1;
  if (field === 'completions') stats.completions += 1;
  if (field === 'handoffs') stats.handoffs += 1;
  if (field === 'dropoffs' && nodeId) {
    stats.dropoffs[nodeId] = (stats.dropoffs[nodeId] || 0) + 1;
  }

  await prisma.flow.update({
    where: { id: flowId },
    data: { stats: stats as object },
  });
}

export async function getFlowAnalytics(flowId: string, organizationId: string) {
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, organizationId },
    select: { stats: true, name: true },
  });
  if (!flow) return null;

  const stats = (flow.stats as unknown as FlowStats) || { starts: 0, completions: 0, handoffs: 0, dropoffs: {} };

  const [recentRuns, successCount, failedCount, skippedLogs] = await Promise.all([
    prisma.automationLog.findMany({
      where: { flowId, organizationId, triggerType: 'FLOW' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        status: true,
        output: true,
        error: true,
        durationMs: true,
        createdAt: true,
        conversationId: true,
      },
    }),
    prisma.automationLog.count({
      where: { flowId, organizationId, triggerType: 'FLOW', status: 'success' },
    }),
    prisma.automationLog.count({
      where: { flowId, organizationId, triggerType: 'FLOW', status: 'failed' },
    }),
    prisma.automationLog.findMany({
      where: { flowId, organizationId, triggerType: 'FLOW', status: 'skipped' },
      select: { status: true, action: true, output: true, error: true },
    }),
  ]);

  const completionRate = stats.starts > 0 ? Math.round((stats.completions / stats.starts) * 100) : 0;

  return {
    name: flow.name,
    stats,
    completionRate,
    nodeRuns: { success: successCount, failed: failedCount },
    bySkipReason: aggregateSkipReasons(skippedLogs),
    recentRuns,
  };
}
