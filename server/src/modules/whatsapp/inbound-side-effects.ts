import type { Prisma } from '@prisma/client';
import { computeSlaDueAt } from '../sla/service';

/** True when a duplicate inbound insert must still repair conversation timestamps/unread. */
export function needsInboundConversationRepair(
  lastMessageAt: Date | null | undefined,
  inboundTimestamp: Date
): boolean {
  if (!lastMessageAt) return true;
  return lastMessageAt.getTime() < inboundTimestamp.getTime();
}

export function inboundConversationSideEffectData(
  inboundTimestamp: Date,
  conversationState: { firstResponseAt: Date | null; slaDueAt: Date | null } | null
): Prisma.ConversationUpdateInput {
  const updateData: Prisma.ConversationUpdateInput = {
    lastMessageAt: inboundTimestamp,
    cs24hWindowOpensAt: inboundTimestamp,
    unreadCount: { increment: 1 },
  };
  if (!conversationState?.firstResponseAt && !conversationState?.slaDueAt) {
    updateData.slaDueAt = computeSlaDueAt(inboundTimestamp);
  }
  return updateData;
}

export function inboundConversationRepairWhere(
  conversationId: string,
  inboundTimestamp: Date
): Prisma.ConversationWhereInput {
  return {
    id: conversationId,
    OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: inboundTimestamp } }],
  };
}
