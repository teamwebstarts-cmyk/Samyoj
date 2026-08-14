import prisma from '../../config/database';

export interface CallAnalytics {
  total: number;
  today: number;
  live: number;
  aiAnswered: number;
  agentAnswered: number;
  missed: number;
  failed: number;
  avgDurationSec: number;
  totalDurationSec: number;
  inbound: number;
  outbound: number;
  byDay: Array<{ date: string; count: number; completed: number; missed: number }>;
  byHandler: Array<{ handler: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

export async function getCallAnalytics(
  organizationId: string,
  days = 30,
  whatsappNumberId?: string
): Promise<CallAnalytics> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const calls = await prisma.call.findMany({
    where: {
      organizationId,
      ...(whatsappNumberId ? { whatsappNumberId } : { id: { in: [] } }),
      createdAt: { gte: since },
    },
    select: {
      status: true,
      handler: true,
      direction: true,
      durationSeconds: true,
      createdAt: true,
    },
  });

  const now = new Date();
  const todayStr = now.toDateString();

  let aiAnswered = 0;
  let agentAnswered = 0;
  let missed = 0;
  let failed = 0;
  let inbound = 0;
  let outbound = 0;
  let totalDurationSec = 0;
  let durationCount = 0;

  const dayMap = new Map<string, { count: number; completed: number; missed: number }>();
  const handlerMap = new Map<string, number>();
  const statusMap = new Map<string, number>();

  for (const call of calls) {
    if (call.handler === 'AI') aiAnswered++;
    if (call.handler === 'AGENT') agentAnswered++;
    if (['MISSED', 'REJECTED'].includes(call.status)) missed++;
    if (call.status === 'FAILED') failed++;
    if (call.direction === 'USER_INITIATED') inbound++;
    else outbound++;

    if ((call.durationSeconds ?? 0) > 0) {
      totalDurationSec += call.durationSeconds!;
      durationCount++;
    }

    const dateKey = call.createdAt.toISOString().slice(0, 10);
    const day = dayMap.get(dateKey) || { count: 0, completed: 0, missed: 0 };
    day.count++;
    if (['COMPLETED', 'TERMINATED'].includes(call.status)) day.completed++;
    if (['MISSED', 'REJECTED', 'FAILED'].includes(call.status)) day.missed++;
    dayMap.set(dateKey, day);

    handlerMap.set(call.handler, (handlerMap.get(call.handler) || 0) + 1);
    statusMap.set(call.status, (statusMap.get(call.status) || 0) + 1);
  }

  const today = calls.filter((c) => new Date(c.createdAt).toDateString() === todayStr).length;
  const live = calls.filter((c) => ['CONNECTED', 'CONNECTING', 'RINGING'].includes(c.status)).length;

  const byDay = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  return {
    total: calls.length,
    today,
    live,
    aiAnswered,
    agentAnswered,
    missed,
    failed,
    avgDurationSec: durationCount > 0 ? Math.round(totalDurationSec / durationCount) : 0,
    totalDurationSec,
    inbound,
    outbound,
    byDay,
    byHandler: Array.from(handlerMap.entries()).map(([handler, count]) => ({ handler, count })),
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
  };
}
