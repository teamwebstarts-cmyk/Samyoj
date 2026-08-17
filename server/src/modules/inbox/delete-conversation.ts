import prisma from '../../config/database';
import { cancelFlowDelayJob } from '../flows/pause-automation';

/**
 * Remove an Inbox conversation without wiping Calls / Tickets / Orders history.
 *
 * Those tables use composite FKs with ON DELETE Restrict (SetNull would also
 * null organizationId). Unlink conversationId first, then delete the chat.
 * Messages, notes, and labels still cascade at the DB.
 */
export async function deleteConversationKeepingHistory(
  conversationId: string,
  organizationId: string
): Promise<void> {
  await cancelFlowDelayJob(conversationId);
  await prisma.$transaction(async (tx) => {
    await tx.call.updateMany({
      where: { conversationId, organizationId },
      data: { conversationId: null },
    });
    await tx.ticket.updateMany({
      where: { conversationId, organizationId },
      data: { conversationId: null },
    });
    await tx.order.updateMany({
      where: { conversationId, organizationId },
      data: { conversationId: null },
    });
    await tx.conversation.delete({
      where: { id: conversationId },
    });
  });
}
