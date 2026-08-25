import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { flowQueue } from '../../config/queues';
import { extractAbSticky } from './ab-sticky';
import { flowDelayJobId } from './inbound-wait';
import { withConversationLock } from './lock';

export async function cancelFlowDelayJob(conversationId: string): Promise<void> {
  try {
    const existing = await flowQueue.getJob(flowDelayJobId(conversationId));
    if (existing) await existing.remove();
  } catch {
    /* job may already have been consumed */
  }
}

/** Drop in-flight journey state but keep A/B sticky assignments. */
export async function clearFlowWaitState(
  conversationId: string,
  scope?: { organizationId: string; whatsappNumberId: string }
): Promise<void> {
  const current = await prisma.conversation.findFirst({
    where: scope
      ? { id: conversationId, organizationId: scope.organizationId, whatsappNumberId: scope.whatsappNumberId }
      : { id: conversationId },
    select: { botState: true },
  });
  const sticky = extractAbSticky(current?.botState);
  await prisma.conversation.updateMany({
    where: scope
      ? { id: conversationId, organizationId: scope.organizationId, whatsappNumberId: scope.whatsappNumberId }
      : { id: conversationId },
    data: {
      botState: Object.keys(sticky).length
        ? ({ abSticky: sticky } as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

/** Stop queued delay + in-progress tree. Caller still sets `botActive: false`. */
export async function pauseConversationAutomations(
  conversationId: string,
  scope: { organizationId: string; whatsappNumberId: string }
): Promise<boolean> {
  await cancelFlowDelayJob(conversationId);
  const cleared = await withConversationLock(conversationId, () =>
    clearFlowWaitState(conversationId, scope)
  );
  return cleared !== null;
}
