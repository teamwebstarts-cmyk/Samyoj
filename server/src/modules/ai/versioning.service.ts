import prisma from '../../config/database';
import type { AiBot } from '@prisma/client';

export async function logBotAudit(data: {
  botId: string;
  organizationId: string;
  userId?: string;
  action: string;
  changes?: unknown;
}): Promise<void> {
  await prisma.aiBotAuditLog.create({
    data: {
      botId: data.botId,
      organizationId: data.organizationId,
      userId: data.userId,
      action: data.action,
      changes: data.changes as object | undefined,
    },
  });
}

export async function createBotVersion(
  bot: AiBot,
  userId?: string,
  changeNote?: string
): Promise<void> {
  const latest = await prisma.aiBotVersion.findFirst({
    where: { botId: bot.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const snapshot = {
    name: bot.name,
    enabled: bot.enabled,
    isDefault: bot.isDefault,
    instructions: bot.instructions,
    handoffMessage: bot.handoffMessage,
    triggerKeywords: bot.triggerKeywords,
    handoffKeywords: bot.handoffKeywords,
    businessHoursOnly: bot.businessHoursOnly,
    temperature: bot.temperature,
    maxTokens: bot.maxTokens,
    rateLimitPerMin: bot.rateLimitPerMin,
  };

  await prisma.aiBotVersion.create({
    data: {
      botId: bot.id,
      version: (latest?.version || 0) + 1,
      snapshot,
      changedBy: userId,
      changeNote,
    },
  });
}

