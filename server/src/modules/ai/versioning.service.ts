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

export async function listBotVersions(botId: string) {
  return prisma.aiBotVersion.findMany({
    where: { botId },
    orderBy: { version: 'desc' },
    take: 20,
  });
}

export async function listBotAuditLogs(botId: string) {
  return prisma.aiBotAuditLog.findMany({
    where: { botId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function restoreBotVersion(
  botId: string,
  organizationId: string,
  version: number,
  userId?: string
): Promise<AiBot> {
  const record = await prisma.aiBotVersion.findFirst({
    where: { botId, version },
  });
  if (!record) throw new Error('Version not found');

  const snapshot = record.snapshot as Record<string, unknown>;
  const bot = await prisma.aiBot.update({
    where: { id: botId },
    data: {
      name: snapshot.name as string,
      enabled: snapshot.enabled as boolean,
      isDefault: snapshot.isDefault as boolean,
      instructions: snapshot.instructions as string,
      handoffMessage: snapshot.handoffMessage as string,
      triggerKeywords: snapshot.triggerKeywords as string[],
      handoffKeywords: snapshot.handoffKeywords as string[],
      businessHoursOnly: snapshot.businessHoursOnly as boolean,
      temperature: snapshot.temperature as number,
      maxTokens: snapshot.maxTokens as number,
      rateLimitPerMin: snapshot.rateLimitPerMin as number,
    },
  });

  await logBotAudit({
    botId,
    organizationId,
    userId,
    action: 'restore',
    changes: { version },
  });

  await createBotVersion(bot, userId, `Restored from v${version}`);
  return bot;
}
