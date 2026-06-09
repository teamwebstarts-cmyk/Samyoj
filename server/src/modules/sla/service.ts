import prisma from '../../config/database';
import { config } from '../../config';

export function computeSlaDueAt(from: Date = new Date()): Date {
  const due = new Date(from);
  due.setMinutes(due.getMinutes() + config.alerts.defaultSlaMinutes);
  return due;
}

export async function setSlaOnInbound(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { firstResponseAt: true, slaDueAt: true },
  });
  if (!conversation || conversation.firstResponseAt) return;

  if (!conversation.slaDueAt) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { slaDueAt: computeSlaDueAt() },
    });
  }
}

export async function markFirstResponse(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { firstResponseAt: true },
  });
  if (!conversation || conversation.firstResponseAt) return;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { firstResponseAt: new Date() },
  });
}

export async function checkSlaBreaches(): Promise<number> {
  const now = new Date();
  const result = await prisma.conversation.updateMany({
    where: {
      status: 'OPEN',
      firstResponseAt: null,
      slaDueAt: { lt: now },
      slaBreached: false,
    },
    data: { slaBreached: true },
  });
  return result.count;
}

export async function getSlaStats(organizationId: string) {
  const [breached, pending, avgResponse] = await Promise.all([
    prisma.conversation.count({
      where: { organizationId, slaBreached: true, status: 'OPEN' },
    }),
    prisma.conversation.count({
      where: {
        organizationId,
        status: 'OPEN',
        firstResponseAt: null,
        slaDueAt: { not: null },
      },
    }),
    prisma.conversation.findMany({
      where: {
        organizationId,
        firstResponseAt: { not: null },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true, firstResponseAt: true },
      take: 200,
    }),
  ]);

  const responseTimes = avgResponse
    .filter((c) => c.firstResponseAt)
    .map((c) => (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60000);

  const avgMinutes =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  return { breached, pending, avgFirstResponseMinutes: avgMinutes };
}
