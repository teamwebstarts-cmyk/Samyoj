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

/** Bots that currently have apply-all rows on this number (for the All-chats switch). */
export async function appliedBotIdsForNumber(
  organizationId: string,
  whatsappNumberId: string
): Promise<Set<string>> {
  if (!whatsappNumberId) return new Set();
  const rows = await prisma.conversation.findMany({
    where: {
      organizationId,
      whatsappNumberId,
      botAssignmentSource: 'APPLIED',
      activeBotId: { not: null },
    },
    select: { activeBotId: true },
    distinct: ['activeBotId'],
  });
  return new Set(rows.map((row) => row.activeBotId).filter((id): id is string => Boolean(id)));
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
    select: { id: true, channel: true },
  });
  if (!bot) throw new AppError(404, 'Bot not found');
  if (bot.channel === 'CALL') {
    throw new AppError(400, 'Apply to all chats is for chat bots only.');
  }

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
