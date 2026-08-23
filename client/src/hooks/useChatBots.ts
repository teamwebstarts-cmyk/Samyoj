import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiBotApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import type { AiBot } from '../types';
import { useOnActiveNumberChange } from './useOnActiveNumberChange';

function isChatBot(bot: AiBot): boolean {
  return (bot.channel ?? 'CHAT') === 'CHAT';
}

function pickFallbackChatBotId(bots: AiBot[]): string | null {
  return (
    bots.find((bot) => bot.isDefault && isChatBot(bot))?.id ??
    bots.find((bot) => bot.isSystem && isChatBot(bot))?.id ??
    bots.find((bot) => bot.enabled && isChatBot(bot))?.id ??
    null
  );
}

/**
 * Chat AI bots for the Inbox page — mirrors useCallingBots for Calls.
 * Global on/off is stored per WhatsApp number and bulk-applied to conversations.
 */
export function useChatBots(options?: { onChanged?: () => void }) {
  const [chatBots, setChatBots] = useState<AiBot[]>([]);
  const [defaultChatBotId, setDefaultChatBotId] = useState<string | null>(null);
  const [chatAiEnabled, setChatAiEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await aiBotApi.list('CHAT');
      const bots = (data.data?.bots ?? []) as AiBot[];
      const enabled = Boolean(data.data?.chatAiEnabled);
      const serverBotId =
        (data.data?.defaultChatBotId as string | null | undefined) ??
        bots.find((bot) => bot.appliedToAll && bot.enabled && isChatBot(bot))?.id ??
        pickFallbackChatBotId(bots);
      setChatBots(bots);
      setChatAiEnabledState(enabled);
      setDefaultChatBotId(serverBotId);
    } catch {
      setChatBots([]);
      setDefaultChatBotId(null);
      setChatAiEnabledState(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useOnActiveNumberChange(() => {
    void load();
  });

  const enabledChatBots = useMemo(
    () => chatBots.filter((bot) => bot.enabled && isChatBot(bot)),
    [chatBots]
  );

  const activeChatBot = useMemo(
    () =>
      enabledChatBots.find((bot) => bot.id === defaultChatBotId) ??
      enabledChatBots.find((bot) => bot.isDefault) ??
      enabledChatBots[0] ??
      null,
    [enabledChatBots, defaultChatBotId]
  );

  const applyServerState = useCallback(
    (enabled: boolean, botId: string | null) => {
      setChatAiEnabledState(enabled);
      if (botId) setDefaultChatBotId(botId);
      setChatBots((prev) =>
        prev.map((bot) => ({
          ...bot,
          appliedToAll: enabled && bot.id === botId,
        }))
      );
      options?.onChanged?.();
    },
    [options]
  );

  const selectChatBot = useCallback(
    async (botId: string) => {
      if (assigning || (chatAiEnabled && botId === defaultChatBotId)) return;
      setAssigning(true);
      try {
        const { data } = await aiBotApi.setChatAi(true, botId);
        applyServerState(Boolean(data.data?.chatAiEnabled), data.data?.defaultChatBotId ?? botId);
        toastSuccess('Chat AI enabled for all conversations', { id: 'chat-bot-pick' });
      } catch {
        void load();
        toastError('Could not apply chat AI bot.', { id: 'chat-bot-pick' });
      } finally {
        setAssigning(false);
      }
    },
    [applyServerState, assigning, chatAiEnabled, defaultChatBotId, load]
  );

  const setChatAiEnabled = useCallback(
    async (next: boolean) => {
      if (assigning || next === chatAiEnabled) return;

      const botId =
        defaultChatBotId ??
        enabledChatBots.find((bot) => bot.isDefault)?.id ??
        enabledChatBots[0]?.id ??
        null;

      if (next && !botId) {
        toastError('Create and enable a chat agent first.', { id: 'chat-bot-on' });
        return;
      }

      setAssigning(true);
      try {
        const { data } = await aiBotApi.setChatAi(next, next ? botId ?? undefined : undefined);
        applyServerState(
          Boolean(data.data?.chatAiEnabled),
          (data.data?.defaultChatBotId as string | null | undefined) ?? botId
        );
        toastSuccess(next ? 'Chat AI enabled for all conversations' : 'Chat AI turned off', {
          id: next ? 'chat-bot-on' : 'chat-bot-off',
        });
      } catch {
        void load();
        toastError(next ? 'Could not enable chat AI.' : 'Could not turn off chat AI.', {
          id: next ? 'chat-bot-on' : 'chat-bot-off',
        });
      } finally {
        setAssigning(false);
      }
    },
    [applyServerState, assigning, chatAiEnabled, defaultChatBotId, enabledChatBots, load]
  );

  return {
    chatBots,
    enabledChatBots,
    defaultChatBotId,
    activeChatBot,
    chatAiEnabled,
    loading,
    assigning,
    load,
    selectChatBot,
    setChatAiEnabled,
    disableChatBot: () => void setChatAiEnabled(false),
  };
}
