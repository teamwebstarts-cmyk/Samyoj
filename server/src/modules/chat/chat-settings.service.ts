import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import {
  applyBotToAllChats,
  appliedBotIdsForNumber,
  disableNonManualChatsForNumber,
} from '../ai/bot-assignment.service';
import {
  DEFAULT_CHAT_NUMBER_SETTINGS,
  type ChatNumberSettings,
  type OrgChatSettings,
} from './chat-settings.types';

function readOrgChatSettings(settings: Record<string, unknown> | null | undefined): OrgChatSettings {
  const raw = settings?.chat as Partial<OrgChatSettings> | undefined;
  return { byNumber: raw?.byNumber ?? {} };
}

export async function getChatSettingsForNumber(
  organizationId: string,
  whatsappNumberId?: string
): Promise<ChatNumberSettings> {
  if (!whatsappNumberId) {
    return { ...DEFAULT_CHAT_NUMBER_SETTINGS };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const chat = readOrgChatSettings((org?.settings as Record<string, unknown>) || {});
  const stored = chat.byNumber[whatsappNumberId];
  if (stored) {
    return {
      aiEnabled: stored.aiEnabled === true,
      botId: stored.botId ?? null,
    };
  }

  // Legacy: infer from APPLIED rows before durable settings existed.
  const applied = await appliedBotIdsForNumber(organizationId, whatsappNumberId);
  if (applied.size > 0) {
    return { aiEnabled: true, botId: [...applied][0] ?? null };
  }

  return { ...DEFAULT_CHAT_NUMBER_SETTINGS };
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
  const existing = chat.byNumber[whatsappNumberId] ?? { ...DEFAULT_CHAT_NUMBER_SETTINGS };
  const merged: ChatNumberSettings = {
    aiEnabled: updates.aiEnabled ?? existing.aiEnabled,
    botId: updates.botId !== undefined ? updates.botId : existing.botId,
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

export async function enableGlobalChatAi(input: {
  organizationId: string;
  whatsappNumberId: string;
  botId: string;
}): Promise<{ updated: number; settings: ChatNumberSettings }> {
  const { organizationId, whatsappNumberId, botId } = input;
  if (!whatsappNumberId) {
    throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
  }

  const settings = await saveChatSettingsForNumber(organizationId, whatsappNumberId, {
    aiEnabled: true,
    botId,
  });
  const { updated } = await applyBotToAllChats({
    organizationId,
    whatsappNumberId,
    botId,
    includeManual: true,
  });

  return { updated, settings };
}

export async function disableGlobalChatAi(input: {
  organizationId: string;
  whatsappNumberId: string;
}): Promise<{ updated: number; settings: ChatNumberSettings }> {
  const { organizationId, whatsappNumberId } = input;
  if (!whatsappNumberId) {
    throw new AppError(400, 'Connect a WhatsApp number before using this feature.');
  }

  const current = await getChatSettingsForNumber(organizationId, whatsappNumberId);
  const settings = await saveChatSettingsForNumber(organizationId, whatsappNumberId, {
    aiEnabled: false,
    botId: current.botId,
  });
  const { updated } = await disableNonManualChatsForNumber(organizationId, whatsappNumberId);

  return { updated, settings };
}

/** New chats always start with AI chat off until the user turns it on for that person. */
export const NEW_CONVERSATION_CHAT_DEFAULTS = {
  activeBotId: null,
  botAssignmentSource: null,
  botActive: false,
} as const;
