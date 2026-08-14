import prisma from '../../config/database';

/** One start (or one static reply) per conversation per flow/rule in this window. */
export const FREQUENCY_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

export function frequencyCapSince(now = Date.now()): Date {
  return new Date(now - FREQUENCY_CAP_WINDOW_MS);
}

export async function hasRecentFlowStart(params: {
  organizationId: string;
  conversationId: string;
  flowId: string;
}): Promise<boolean> {
  const found = await prisma.automationLog.findFirst({
    where: {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      flowId: params.flowId,
      action: 'start',
      status: 'success',
      createdAt: { gte: frequencyCapSince() },
    },
    select: { id: true },
  });
  return Boolean(found);
}

export async function hasRecentStaticReply(params: {
  organizationId: string;
  conversationId: string;
  automationId: string;
}): Promise<boolean> {
  const found = await prisma.automationLog.findFirst({
    where: {
      organizationId: params.organizationId,
      conversationId: params.conversationId,
      automationId: params.automationId,
      action: 'send_reply',
      status: 'success',
      createdAt: { gte: frequencyCapSince() },
    },
    select: { id: true },
  });
  return Boolean(found);
}
