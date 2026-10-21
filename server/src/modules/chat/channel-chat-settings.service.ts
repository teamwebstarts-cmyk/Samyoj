import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { AppError } from '../../utils/response';
import {
  DEFAULT_CHAT_NUMBER_SETTINGS,
  type ChatManualSnapshotEntry,
  type ChatNumberSettings,
  type OrgChatSettings,
} from './chat-settings.types';

function readOrgChatSettings(settings: Record<string, unknown> | null | undefined): OrgChatSettings {
  const raw = settings?.chat as Partial<OrgChatSettings> | undefined;
  return { byNumber: raw?.byNumber ?? {}, byChannel: raw?.byChannel ?? {} };
}

function normalizeSettings(stored: Partial<ChatNumberSettings> | undefined): ChatNumberSettings {
  return {
    aiEnabled: stored?.aiEnabled === true,
    botId: stored?.botId ?? null,
    manualSnapshot: stored?.manualSnapshot ?? {},
  };
}

export async function getChatSettingsForChannel(
  organizationId: string,
  channelId?: string
): Promise<ChatNumberSettings> {
  if (!channelId) {
    return { ...DEFAULT_CHAT_NUMBER_SETTINGS, manualSnapshot: {} };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const chat = readOrgChatSettings((org?.settings as Record<string, unknown>) || {});
  const stored = chat.byChannel?.[channelId];
  if (stored) return normalizeSettings(stored);

  return { ...DEFAULT_CHAT_NUMBER_SETTINGS, manualSnapshot: {} };
}

async function saveChatSettingsForChannel(
  organizationId: string,
  channelId: string,
  updates: Partial<ChatNumberSettings>
): Promise<ChatNumberSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const current = (org?.settings as Record<string, unknown>) || {};
  const chat = readOrgChatSettings(current);
  const byChannel = { ...(chat.byChannel ?? {}) };
  const existing = normalizeSettings(byChannel[channelId]);
  const merged: ChatNumberSettings = {
    aiEnabled: updates.aiEnabled ?? existing.aiEnabled,
    botId: updates.botId !== undefined ? updates.botId : existing.botId,
    manualSnapshot:
      updates.manualSnapshot !== undefined ? updates.manualSnapshot : existing.manualSnapshot,
  };

  byChannel[channelId] = merged;

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...current,
        chat: {
          ...chat,
          byChannel,
        },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return merged;
}

function channelConversationWhere(organizationId: string, channelId: string): Prisma.ConversationWhereInput {
  return { organizationId, channelId, whatsappNumberId: null };
}

async function captureManualChatSnapshotForChannel(
  organizationId: string,
  channelId: string
): Promise<Record<string, ChatManualSnapshotEntry>> {
  const rows = await prisma.conversation.findMany({
    where: {
      ...channelConversationWhere(organizationId, channelId),
      botAssignmentSource: 'MANUAL',
      botActive: true,
      activeBotId: { not: null },
    },
    select: { id: true, activeBotId: true },
  });

  const snapshot: Record<string, ChatManualSnapshotEntry> = {};
  for (const row of rows) {
    if (row.activeBotId) snapshot[row.id] = { botId: row.activeBotId };
  }
  return snapshot;
}

async function restoreManualChatSnapshotForChannel(
  organizationId: string,
  channelId: string,
  snapshot: Record<string, ChatManualSnapshotEntry>
): Promise<number> {
  let restored = 0;
  for (const [conversationId, entry] of Object.entries(snapshot)) {
    const updated = await prisma.conversation.updateMany({
      where: { id: conversationId, ...channelConversationWhere(organizationId, channelId) },
      data: {
        botActive: true,
        botAssignmentSource: 'MANUAL',
        activeBotId: entry.botId,
        botHandoffAt: null,
        botHandoffReason: null,
        botState: Prisma.DbNull,
      },
    });
    if (updated.count === 0) continue;
    restored += updated.count;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        botActive: true,
        botHandoffAt: true,
        activeBot: { select: { id: true, name: true } },
        channelId: true,
      },
    });
    if (!conversation) continue;

    emitToOrg(organizationId, 'conversation:bot', {
      conversationId: conversation.id,
      botActive: conversation.botActive,
      botHandoffAt: conversation.botHandoffAt,
      activeBot: conversation.activeBot,
      channelId: conversation.channelId,
    });
    emitToOrg(organizationId, 'conversation:updated', {
      conversationId: conversation.id,
      channelId: conversation.channelId,
      patch: {
        botActive: conversation.botActive,
        botHandoffAt: conversation.botHandoffAt,
        activeBot: conversation.activeBot,
      },
    });
  }
  return restored;
}

async function applyBotToAllChannelChats(input: {
  organizationId: string;
  channelId: string;
  botId: string;
  includeManual?: boolean;
}): Promise<{ updated: number }> {
  const { organizationId, channelId, botId, includeManual = true } = input;

  const bot = await prisma.aiBot.findFirst({
    where: { id: botId, organizationId },
    select: { id: true, channel: true },
  });
  if (!bot) throw new AppError(404, 'Bot not found');
  if (bot.channel === 'CALL') {
    throw new AppError(400, 'Apply to all chats is for chat bots only.');
  }

  const where: Prisma.ConversationWhereInput = includeManual
    ? channelConversationWhere(organizationId, channelId)
    : {
        ...channelConversationWhere(organizationId, channelId),
        OR: [{ botAssignmentSource: null }, { botAssignmentSource: 'APPLIED' }],
      };

  const result = await prisma.conversation.updateMany({
    where,
    data: {
      activeBotId: botId,
      botAssignmentSource: 'APPLIED',
      botActive: true,
    },
  });

  return { updated: result.count };
}

async function disableNonManualChatsForChannel(
  organizationId: string,
  channelId: string
): Promise<{ updated: number }> {
  const result = await prisma.conversation.updateMany({
    where: {
      ...channelConversationWhere(organizationId, channelId),
      NOT: { botAssignmentSource: 'MANUAL' },
    },
    data: {
      activeBotId: null,
      botAssignmentSource: null,
      botActive: false,
    },
  });
  return { updated: result.count };
}

export async function enableGlobalChatAiForChannel(input: {
  organizationId: string;
  channelId: string;
  botId: string;
}): Promise<{ updated: number; settings: ChatNumberSettings; remembered: number }> {
  const { organizationId, channelId, botId } = input;
  const manualSnapshot = await captureManualChatSnapshotForChannel(organizationId, channelId);
  const settings = await saveChatSettingsForChannel(organizationId, channelId, {
    aiEnabled: true,
    botId,
    manualSnapshot,
  });
  const { updated } = await applyBotToAllChannelChats({
    organizationId,
    channelId,
    botId,
    includeManual: true,
  });
  return { updated, settings, remembered: Object.keys(manualSnapshot).length };
}

export async function disableGlobalChatAiForChannel(input: {
  organizationId: string;
  channelId: string;
}): Promise<{ updated: number; restored: number; settings: ChatNumberSettings }> {
  const { organizationId, channelId } = input;
  const current = await getChatSettingsForChannel(organizationId, channelId);
  const snapshot = current.manualSnapshot ?? {};

  const settings = await saveChatSettingsForChannel(organizationId, channelId, {
    aiEnabled: false,
    botId: current.botId,
    manualSnapshot: snapshot,
  });

  const { updated } = await disableNonManualChatsForChannel(organizationId, channelId);
  const restored = await restoreManualChatSnapshotForChannel(organizationId, channelId, snapshot);

  return { updated, restored, settings };
}

/** Apply global channel bot when a new Meta DM conversation is created. */
export async function applyGlobalChatToChannelConversation(
  organizationId: string,
  conversationId: string,
  channelId: string
): Promise<boolean> {
  const settings = await getChatSettingsForChannel(organizationId, channelId);
  if (!settings.aiEnabled || !settings.botId) return false;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, ...channelConversationWhere(organizationId, channelId) },
    select: { id: true, botHandoffAt: true, botActive: true, activeBotId: true },
  });
  if (!conversation || conversation.botHandoffAt) return false;
  if (conversation.botActive && conversation.activeBotId === settings.botId) return false;

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      botActive: true,
      botAssignmentSource: 'APPLIED',
      activeBotId: settings.botId,
      botHandoffAt: null,
      botHandoffReason: null,
    },
    select: {
      id: true,
      botActive: true,
      botHandoffAt: true,
      activeBot: { select: { id: true, name: true } },
    },
  });

  emitToOrg(organizationId, 'conversation:bot', {
    conversationId: updated.id,
    botActive: updated.botActive,
    botHandoffAt: updated.botHandoffAt,
    activeBot: updated.activeBot,
    channelId,
  });
  emitToOrg(organizationId, 'conversation:updated', {
    conversationId: updated.id,
    channelId,
    patch: {
      botActive: updated.botActive,
      botHandoffAt: updated.botHandoffAt,
      activeBot: updated.activeBot,
    },
  });

  return true;
}
