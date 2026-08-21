import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiBotApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import type { AiBot } from '../types';

function isChatBot(bot: AiBot): boolean {
  return (bot.channel ?? 'CHAT') === 'CHAT';
}

/**
 * Chat AI bots for the Inbox page — mirrors useCallingBots for Calls.
 * "AI on" = an org-wide default chat bot is applied to all conversations.
 */
export function useChatBots() {
  const [chatBots, setChatBots] = useState<AiBot[]>([]);
  const [defaultChatBotId, setDefaultChatBotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await aiBotApi.list('CHAT');
      const bots = (data.data?.bots ?? []) as AiBot[];
      setChatBots(bots);
      const dflt =
        bots.find((bot) => bot.isDefault)?.id ??
        bots.find((bot) => bot.isSystem)?.id ??
        bots.find((bot) => bot.enabled)?.id ??
        null;
      setDefaultChatBotId(dflt);
    } catch {
      setChatBots([]);
      setDefaultChatBotId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  /** True when an org-wide chat bot is applied. */
  const chatAiEnabled = Boolean(activeChatBot);

  const selectChatBot = useCallback(
    async (botId: string) => {
      if (assigning || botId === defaultChatBotId) return;
      setAssigning(true);
      try {
        await aiBotApi.applyToAllChats(botId);
        setDefaultChatBotId(botId);
        setChatBots((prev) =>
          prev.map((bot) => ({
            ...bot,
            isDefault: bot.id === botId,
          }))
        );
        toastSuccess('Chat AI bot applied to all conversations', {
          id: 'chat-bot-pick',
        });
      } catch {
        toastError('Could not apply chat AI bot.', { id: 'chat-bot-pick' });
      } finally {
        setAssigning(false);
      }
    },
    [assigning, defaultChatBotId]
  );

  const disableChatBot = useCallback(async () => {
    if (assigning) return;
    setAssigning(true);
    try {
      const botIdForRemove = defaultChatBotId;
      if (!botIdForRemove) return;
      await aiBotApi.removeFromAllChats(botIdForRemove);
      setDefaultChatBotId(null);
      setChatBots((prev) => prev.map((bot) => ({ ...bot, isDefault: false })));
      toastSuccess('Chat AI bot removed from all conversations', {
        id: 'chat-bot-off',
      });
    } catch {
      toastError('Could not turn off chat AI.', { id: 'chat-bot-off' });
    } finally {
      setAssigning(false);
    }
  }, [assigning]);

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
    disableChatBot,
  };
}
