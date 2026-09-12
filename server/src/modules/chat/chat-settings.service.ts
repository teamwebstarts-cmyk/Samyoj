import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { AppError } from '../../utils/response';
import {
  applyBotToAllChats,
  appliedBotIdsForNumber,
  disableNonManualChatsForNumber,
} from '../ai/bot-assignment.service';
import {
  DEFAULT_CHAT_NUMBER_SETTINGS,
  type ChatManualSnapshotEntry,
  type ChatNumberSettings,
  type OrgChatSettings,
} from './chat-settings.types';

function readOrgChatSettings(settings: Record<string, unknown> | null | undefined): OrgChatSettings {
  const raw = settings?.chat as Partial<OrgChatSettings> | undefined;
  return { byNumber: raw?.byNumber ?? {} };
}

function normalizeChatNumberSettings(
  stored: Partial<ChatNumberSettings> | undefined
): ChatNumberSettings {
  return {
    aiEnabled: stored?.aiEnabled === true,
    botId: stored?.botId ?? null,
    manualSnapshot: stored?.manualSnapshot ?? {},
  };
}

export async function getChatSettingsForNumber(
  organizationId: string,
  whatsappNumberId?: string
): Promise<ChatNumberSettings> {
  if (!whatsappNumberId) {
    return { ...DEFAULT_CHAT_NUMBER_SETTINGS, manualSnapshot: {} };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const chat = readOrgChatSettings((org?.settings as Record<string, unknown>) || {});
  const stored = chat.byNumber[whatsappNumberId];
  if (stored) {
    return normalizeChatNumberSettings(stored);
  }

  const applied = await appliedBotIdsForNumber(organizationId, whatsappNumberId);
  if (applied.size > 0) {
    return {
      aiEnabled: true,
      botId: [...applied][0] ?? null,
      manualSnapshot: {},
    };
  }

  return { ...DEFAULT_CHAT_NUMBER_SETTINGS, manualSnapshot: {} };
}

async function saveChatSettingsForNumber(
  organizationId: string,
  whatsappNumberId: string,
  updates: Partial<ChatNumberSettings>
): Promise<ChatNumberSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const current = (org?.settings as Record<string, unknown>) || {};
  const chat = readOrgChatSettings(current);
  const existing = normalizeChatNumberSettings(chat.byNumber[whatsappNumberId]);
  const merged: ChatNumberSettings = {
    aiEnabled: updates.aiEnabled ?? existing.aiEnabled,
    botId: updates.botId !== undefined ? updates.botId : existing.botId,
    manualSnapshot:
      updates.manualSnapshot !== undefined ? updates.manualSnapshot : existing.manualSnapshot,
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...current,
        chat: {
          byNumber: {
            ...chat.byNumber,
            [whatsappNumberId]: merged,
          },
        },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return merged;
}

async function captureManualChatSnapshot(
  organizationId: string,
  whatsappNumberId: string
): Promise<Record<string, ChatManualSnapshotEntry>> {
  const rows = await prisma.conversation.findMany({
    where: {
      organizationId,
      whatsappNumberId,
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

async function restoreManualChatSnapshot(
  organizationId: string,
  whatsappNumberId: string,
  snapshot: Record<string, ChatManualSnapshotEntry>
): Promise<number> {
  let restored = 0;
  for (const [conversationId, entry] of Object.entries(snapshot)) {
    const updated = await prisma.conversation.updateMany({
      where: { id: conversationId, organizationId, whatsappNumberId },
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
      },
    });
    if (!conversation) continue;

    emitToOrg(organizationId, 'conversation:bot', {
      conversationId: conversation.id,
      botActive: conversation.botActive,
      botHandoffAt: conversation.botHandoffAt,
      activeBot: conversation.activeBot,
      whatsappNumberId,
    });
    emitToOrg(organizationId, 'conversation:updated', {
      conversationId: conversation.id,
      whatsappNumberId,
      patch: {
        botActive: conversation.botActive,
        botHandoffAt: conversation.botHandoffAt,
        activeBot: conversation.activeBot,
      },
    });
  }
  return restored;
}

/** Apply global bot to one conversation when global AI is on (new chats + sync). */
export async function applyGlobalChatToConversation(
  organizationId: string,
  conversationId: string,
  whatsappNumberId: string
): Promise<boolean> {
  const settings = await getChatSettingsForNumber(organizationId, whatsappNumberId);
  if (!settings.aiEnabled || !settings.botId) return false;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId, whatsappNumberId },
    select: { id: true, botHandoffAt: true, botActive: true, activeBotId: true },
  });
  if (!conversation || conversation.botHandoffAt) return false;
  if (
    conversation.botActive &&
    conversation.activeBotId === settings.botId
  ) {
    return false;
  }

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
    whatsappNumberId,
  });
  emitToOrg(organizationId, 'conversation:updated', {
    conversationId: updated.id,
    whatsappNumberId,
    patch: {
      botActive: updated.botActive,
      botHandoffAt: updated.botHandoffAt,
      activeBot: updated.activeBot,
    },
  });

  return true;
}

export async function enableGlobalChatAi(input: {
  organizationId: string;
  whatsappNumberId: string;
  botId: string;
}): Promise<{ updated: number; settings: ChatNumberSettings; remembered: number }> {
  const { organizationId, whatsappNumberId, botId } = input;
  if (!whatsappNumberId) {
    throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
  }

  const manualSnapshot = await captureManualChatSnapshot(organizationId, whatsappNumberId);
  const settings = await saveChatSettingsForNumber(organizationId, whatsappNumberId, {
    aiEnabled: true,
    botId,
    manualSnapshot,
  });
  const { updated } = await applyBotToAllChats({
    organizationId,
    whatsappNumberId,
    botId,
    includeManual: true,
  });

  return { updated, settings, remembered: Object.keys(manualSnapshot).length };
}

export async function disableGlobalChatAi(input: {
  organizationId: string;
  whatsappNumberId: string;
}): Promise<{ updated: number; restored: number; settings: ChatNumberSettings }> {
  const { organizationId, whatsappNumberId } = input;
  if (!whatsappNumberId) {
    throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
  }

  const current = await getChatSettingsForNumber(organizationId, whatsappNumberId);
  const snapshot = current.manualSnapshot ?? {};

  const settings = await saveChatSettingsForNumber(organizationId, whatsappNumberId, {
    aiEnabled: false,
    botId: current.botId,
    manualSnapshot: snapshot,
  });

  const { updated } = await disableNonManualChatsForNumber(organizationId, whatsappNumberId);
  const restored = await restoreManualChatSnapshot(organizationId, whatsappNumberId, snapshot);

  return { updated, restored, settings };
}

export const NEW_CONVERSATION_CHAT_DEFAULTS = {
  activeBotId: null,
  botAssignmentSource: null,
  botActive: false,
} as const;
