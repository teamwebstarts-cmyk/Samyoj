import type { BotAssignmentSource } from '@prisma/client';
import prisma from '../../config/database';
import { emitToOrg } from '../../realtime';
import { getChatSettingsForNumber } from './chat-settings.service';

export type ConversationChatAiRow = {
  id: string;
  botActive?: boolean | null;
  whatsappNumberId?: string | null;
  activeBotId?: string | null;
  botAssignmentSource?: BotAssignmentSource | null;
  botHandoffAt?: Date | null;
};

/**
 * Effective Inbox chat AI for an inbound message.
 * - Personal ON always wins.
 * - Global ON also counts as ON (even when personal row is still false until sync).
 */
export function isChatAiEffectivelyOn(
  botActive: boolean | null | undefined,
  globalAiEnabled: boolean
): boolean {
  if (botActive === true) return true;
  return globalAiEnabled === true;
}

export async function resolveChatAiEffectivelyOn(
  organizationId: string,
  conversation: ConversationChatAiRow
): Promise<{ live: boolean; globalAiEnabled: boolean; botId: string | null }> {
  if (!conversation.whatsappNumberId) {
    return { live: conversation.botActive === true, globalAiEnabled: false, botId: null };
  }
  const settings = await getChatSettingsForNumber(organizationId, conversation.whatsappNumberId);
  return {
    live: isChatAiEffectivelyOn(conversation.botActive, settings.aiEnabled),
    globalAiEnabled: settings.aiEnabled,
    botId: settings.botId,
  };
}

/**
 * When global chat AI is on, align the conversation row + UI (APPLIED) before automations run.
 * Skips handoff threads — those stay human until reset.
 */
export async function syncConversationChatAiFromGlobal(
  organizationId: string,
  conversation: ConversationChatAiRow
): Promise<ConversationChatAiRow> {
  if (!conversation.whatsappNumberId || conversation.botHandoffAt) {
    return conversation;
  }

  const settings = await getChatSettingsForNumber(organizationId, conversation.whatsappNumberId);
  if (!settings.aiEnabled || conversation.botActive === true) {
    return conversation;
  }

  const botId = settings.botId ?? conversation.activeBotId;
  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      botActive: true,
      botAssignmentSource: 'APPLIED' satisfies BotAssignmentSource,
      ...(botId ? { activeBotId: botId } : {}),
      botHandoffAt: null,
      botHandoffReason: null,
    },
    select: {
      id: true,
      botActive: true,
      whatsappNumberId: true,
      activeBotId: true,
      botAssignmentSource: true,
      botHandoffAt: true,
      activeBot: { select: { id: true, name: true } },
    },
  });

  emitToOrg(organizationId, 'conversation:bot', {
    conversationId: updated.id,
    botActive: updated.botActive,
    botHandoffAt: updated.botHandoffAt,
    activeBot: updated.activeBot,
  });
  emitToOrg(organizationId, 'conversation:updated', {
    conversationId: updated.id,
    patch: {
      botActive: updated.botActive,
      botHandoffAt: updated.botHandoffAt,
      activeBot: updated.activeBot,
    },
  });

  return updated;
}
