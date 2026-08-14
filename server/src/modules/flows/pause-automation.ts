import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { flowQueue } from '../../config/queues';
import { extractAbSticky } from './ab-sticky';
import { flowDelayJobId } from './inbound-wait';

export async function cancelFlowDelayJob(conversationId: string): Promise<void> {
  try {
    const existing = await flowQueue.getJob(flowDelayJobId(conversationId));
    if (existing) await existing.remove();
  } catch {
    /* job may already have been consumed */
  }
}

/** Drop in-flight journey state but keep A/B sticky assignments. */
export async function clearFlowWaitState(conversationId: string): Promise<void> {
  const current = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { botState: true },
  });
  const sticky = extractAbSticky(current?.botState);
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      botState: Object.keys(sticky).length
        ? ({ abSticky: sticky } as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

/** Stop queued delay + in-progress tree. Caller still sets `botActive: false`. */
export async function pauseConversationAutomations(conversationId: string): Promise<void> {
  await cancelFlowDelayJob(conversationId);
  await clearFlowWaitState(conversationId);
}
