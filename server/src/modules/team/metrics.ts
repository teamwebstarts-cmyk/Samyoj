import prisma from '../../config/database';

export interface AgentMetrics {
  assignedCount: number;
  openCount: number;
  closedLast7d: number;
  messagesSentLast7d: number;
  handoffsLast7d: number;
  avgFirstResponseMinutes: number | null;
  callsHandledLast7d: number;
}

export async function getAgentMetrics(
  organizationId: string,
  userId: string
): Promise<AgentMetrics> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [assignedCount, openCount, closedLast7d, messagesSentLast7d, handoffsLast7d, callsHandledLast7d] =
    await Promise.all([
      prisma.conversation.count({
        where: { organizationId, assignedAgentId: userId },
      }),
      prisma.conversation.count({
        where: {
          organizationId,
          assignedAgentId: userId,
          status: { in: ['OPEN', 'PENDING'] },
        },
      }),
      prisma.conversation.count({
        where: {
          organizationId,
          assignedAgentId: userId,
          status: 'CLOSED',
          updatedAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          createdAt: { gte: sevenDaysAgo },
          conversation: { organizationId, assignedAgentId: userId },
        },
      }),
      prisma.conversation.count({
        where: {
          organizationId,
          assignedAgentId: userId,
          botHandoffAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.call.count({
        where: {
          organizationId,
          assignedAgentId: userId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

  const conversations = await prisma.conversation.findMany({
    where: {
      organizationId,
      assignedAgentId: userId,
      messages: { some: { direction: 'OUTBOUND' } },
    },
    select: {
      createdAt: true,
      messages: {
        where: { direction: 'OUTBOUND' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { createdAt: true },
      },
    },
    take: 50,
    orderBy: { updatedAt: 'desc' },
  });

  const responseTimes: number[] = [];
  for (const conv of conversations) {
    const firstOutbound = conv.messages[0];
    if (firstOutbound) {
      const diff =
        (firstOutbound.createdAt.getTime() - conv.createdAt.getTime()) / 60000;
      if (diff >= 0 && diff < 24 * 60) responseTimes.push(diff);
    }
  }

  const avgFirstResponseMinutes =
    responseTimes.length > 0
      ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10
      : null;

  return {
    assignedCount,
    openCount,
    closedLast7d,
    messagesSentLast7d,
    handoffsLast7d,
    avgFirstResponseMinutes,
    callsHandledLast7d,
  };
}

export async function getMemberAssignedConversations(
  organizationId: string,
  userId: string,
  limit = 20
) {
  return prisma.conversation.findMany({
    where: { organizationId, assignedAgentId: userId },
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      lastMessageAt: true,
      unreadCount: true,
      contact: { select: { id: true, name: true, phone: true } },
    },
  });
}
