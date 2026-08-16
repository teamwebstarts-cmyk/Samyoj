import type { BotAssignmentSource, Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';

/** Chats that follow default or were set by apply-all — never Inbox MANUAL picks. */
export function applyAllConversationWhere(
  organizationId: string,
  whatsappNumberId: string
): Prisma.ConversationWhereInput {
  return {
    organizationId,
    whatsappNumberId,
    OR: [{ botAssignmentSource: null }, { botAssignmentSource: 'APPLIED' }],
  };
}

export function removeAppliedConversationWhere(
  organizationId: string,
  whatsappNumberId: string,
  botId: string
): Prisma.ConversationWhereInput {
  return {
    organizationId,
    whatsappNumberId,
    botAssignmentSource: 'APPLIED',
    activeBotId: botId,
  };
}

export async function applyBotToAllChats(input: {
  organizationId: string;
  whatsappNumberId: string;
  botId: string;
}): Promise<{ updated: number }> {
  const { organizationId, whatsappNumberId, botId } = input;
  if (!whatsappNumberId) {
    throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
  }

  const bot = await prisma.aiBot.findFirst({
    where: { id: botId, organizationId },
    select: { id: true },
  });
  if (!bot) throw new AppError(404, 'Bot not found');

  const result = await prisma.conversation.updateMany({
    where: applyAllConversationWhere(organizationId, whatsappNumberId),
    data: {
      activeBotId: botId,
      botAssignmentSource: 'APPLIED' satisfies BotAssignmentSource,
      botActive: true,
    },
  });

  return { updated: result.count };
}

export async function removeBotFromAllChats(input: {
  organizationId: string;
  whatsappNumberId: string;
  botId: string;
}): Promise<{ updated: number }> {
  const { organizationId, whatsappNumberId, botId } = input;
  if (!whatsappNumberId) {
    throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
  }

  const bot = await prisma.aiBot.findFirst({
    where: { id: botId, organizationId },
    select: { id: true },
  });
  if (!bot) throw new AppError(404, 'Bot not found');

  const result = await prisma.conversation.updateMany({
    where: removeAppliedConversationWhere(organizationId, whatsappNumberId, botId),
    data: {
      activeBotId: null,
      botAssignmentSource: null,
    },
  });

  return { updated: result.count };
}
