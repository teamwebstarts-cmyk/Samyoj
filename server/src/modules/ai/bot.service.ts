import prisma from '../../config/database';
import type { AiBot, Conversation } from '@prisma/client';

export const DEFAULT_INSTRUCTIONS = `You are a helpful WhatsApp assistant.
- Be friendly, concise, and professional.
- Answer only from the FAQ/knowledge provided.
- If you don't know the answer, offer to connect the customer with the team.
- Keep replies short — suitable for WhatsApp chat.`;

const DEFAULT_HANDOFF_KEYWORDS = ['human', 'agent', 'representative', 'talk to someone', 'real person'];

export function getHandoffKeywords(botKeywords?: string[]): string[] {
  if (botKeywords && botKeywords.length > 0) return botKeywords;
  return DEFAULT_HANDOFF_KEYWORDS;
}

export async function listBots(organizationId: string) {
  return prisma.aiBot.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: { _count: { select: { knowledgeItems: true } } },
  });
}

export async function getBot(organizationId: string, botId: string) {
  return prisma.aiBot.findFirst({
    where: { id: botId, organizationId },
    include: { knowledgeItems: { orderBy: { createdAt: 'asc' } } },
  });
}

export async function ensureDefaultBot(organizationId: string): Promise<AiBot> {
  const existing = await prisma.aiBot.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  return prisma.aiBot.create({
    data: {
      organizationId,
      name: 'Support Bot',
      isDefault: true,
      instructions: DEFAULT_INSTRUCTIONS,
    },
  });
}

export async function resolveBotForConversation(
  organizationId: string,
  conversation: Conversation,
  message: string
): Promise<AiBot | null> {
  if (conversation.activeBotId) {
    const active = await prisma.aiBot.findFirst({
      where: { id: conversation.activeBotId, organizationId, enabled: true },
    });
    if (active) return active;
  }

  const bots = await prisma.aiBot.findMany({
    where: { organizationId, enabled: true },
    orderBy: { createdAt: 'asc' },
  });

  if (bots.length === 0) return null;

  const lower = message.toLowerCase();
  const keywordMatches = bots.filter((bot) =>
    bot.triggerKeywords.some((kw) => kw && lower.includes(kw.toLowerCase()))
  );

  if (keywordMatches.length === 1) return keywordMatches[0];
  if (keywordMatches.length > 1) {
    return keywordMatches.sort((a, b) => b.triggerKeywords.length - a.triggerKeywords.length)[0];
  }

  const defaultBot = bots.find((b) => b.isDefault);
  if (defaultBot) return defaultBot;

  if (bots.length === 1) return bots[0];

  return null;
}

export async function setConversationBot(conversationId: string, botId: string): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { activeBotId: botId },
  });
}

export async function clearDefaultFlag(organizationId: string, exceptBotId?: string): Promise<void> {
  await prisma.aiBot.updateMany({
    where: {
      organizationId,
      ...(exceptBotId ? { id: { not: exceptBotId } } : {}),
    },
    data: { isDefault: false },
  });
}

export async function hasEnabledBots(organizationId: string): Promise<boolean> {
  const count = await prisma.aiBot.count({
    where: { organizationId, enabled: true },
  });
  return count > 0;
}
