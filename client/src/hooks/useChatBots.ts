import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiBotApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import type { AiBot } from '../types';

function isChatBot(bot: AiBot): boolean {
  return (bot.channel ?? 'CHAT') === 'CHAT';
}

function pickChatBotId(bots: AiBot[]): string | null {
  const applied = bots.find((bot) => bot.appliedToAll && bot.enabled && isChatBot(bot));
  if (applied) return applied.id;
  return (
    bots.find((bot) => bot.isDefault && isChatBot(bot))?.id ??
    bots.find((bot) => bot.isSystem && isChatBot(bot))?.id ??
    bots.find((bot) => bot.enabled && isChatBot(bot))?.id ??
    null
  );
}

/**
 * Chat AI bots for the Inbox page — mirrors useCallingBots for Calls.
 * "AI on" = an org-wide chat bot is applied to all conversations (appliedToAll).
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
      setDefaultChatBotId(pickChatBotId(bots));
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

  const appliedChatBotId = useMemo(
    () =>
      chatBots.find((bot) => bot.appliedToAll && bot.enabled && isChatBot(bot))?.id ?? null,
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

  /** True when a chat bot is actively applied to all conversations on this number. */
  const chatAiEnabled = appliedChatBotId !== null;

  const selectChatBot = useCallback(
    async (botId: string) => {
      if (assigning || botId === appliedChatBotId) return;
      setAssigning(true);
      setChatBots((prev) =>
        prev.map((bot) => ({
          ...bot,
          isDefault: bot.id === botId,
          appliedToAll: bot.id === botId,
        }))
      );
      try {
        await aiBotApi.applyToAllChats(botId);
        setDefaultChatBotId(botId);
        toastSuccess('Chat AI bot applied to all conversations', {
          id: 'chat-bot-pick',
        });
      } catch {
        void load();
        toastError('Could not apply chat AI bot.', { id: 'chat-bot-pick' });
      } finally {
        setAssigning(false);
      }
    },
    [appliedChatBotId, assigning, load]
  );

  /** Toggle org-wide chat AI on/off. On = assign an enabled chat bot; off = remove. */
  const setChatAiEnabled = useCallback(
    async (next: boolean) => {
      if (assigning) return;
      if (next === chatAiEnabled) return;

      const botId =
        defaultChatBotId ??
        enabledChatBots.find((bot) => bot.isDefault)?.id ??
        enabledChatBots[0]?.id ??
        null;
      const removeId = appliedChatBotId ?? botId;

      if (next && !botId) {
        toastError('Create and enable a chat agent first.', { id: 'chat-bot-on' });
        return;
      }
      if (!next && !removeId) return;

      setAssigning(true);
      setChatBots((prev) =>
        prev.map((bot) => ({
          ...bot,
          appliedToAll: next && bot.id === botId,
        }))
      );

      try {
        if (next) {
          await aiBotApi.applyToAllChats(botId!);
          setDefaultChatBotId(botId);
          setChatBots((prev) =>
            prev.map((bot) => ({
              ...bot,
              isDefault: bot.id === botId,
              appliedToAll: bot.id === botId,
            }))
          );
          toastSuccess('Chat AI enabled for all conversations', { id: 'chat-bot-on' });
        } else {
          await aiBotApi.removeFromAllChats(removeId!);
          setChatBots((prev) =>
            prev.map((bot) => ({
              ...bot,
              appliedToAll: false,
            }))
          );
          toastSuccess('Chat AI removed from all conversations', {
            id: 'chat-bot-off',
          });
        }
      } catch {
        void load();
        toastError(next ? 'Could not enable chat AI.' : 'Could not turn off chat AI.', {
          id: next ? 'chat-bot-on' : 'chat-bot-off',
        });
      } finally {
        setAssigning(false);
      }
    },
    [appliedChatBotId, assigning, chatAiEnabled, defaultChatBotId, enabledChatBots, load]
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
