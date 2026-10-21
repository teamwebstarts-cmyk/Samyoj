import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiBotApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import type { AiBot } from '../types';

function isChatBot(bot: AiBot): boolean {
  return (bot.channel ?? 'CHAT') === 'CHAT';
}

type ChannelChatAiApi = {
  getChatAi: () => Promise<{
    data: {
      data: {
        chatAiEnabled?: boolean;
        defaultChatBotId?: string | null;
        connected?: boolean;
      };
    };
  }>;
  setChatAi: (
    enabled: boolean,
    botId?: string
  ) => Promise<{
    data: {
      data: {
        chatAiEnabled?: boolean;
        defaultChatBotId?: string | null;
      };
    };
  }>;
};

/**
 * Global AI chat for Instagram / Messenger inboxes (all DMs on the connected channel).
 */
export function useChannelChatBots(
  channelApi: ChannelChatAiApi,
  options?: { onChanged?: () => void; label?: string }
) {
  const [chatBots, setChatBots] = useState<AiBot[]>([]);
  const [defaultChatBotId, setDefaultChatBotId] = useState<string | null>(null);
  const [chatAiEnabled, setChatAiEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const scopeLabel = options?.label ?? 'this inbox';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: botRes }, { data: channelRes }] = await Promise.all([
        aiBotApi.list('CHAT'),
        channelApi.getChatAi(),
      ]);
      const bots = (botRes.data?.bots ?? []) as AiBot[];
      const channelPayload =
        (channelRes as { data?: { chatAiEnabled?: boolean; defaultChatBotId?: string | null } })
          .data ?? (channelRes as { chatAiEnabled?: boolean; defaultChatBotId?: string | null });
      const enabled = Boolean(channelPayload.chatAiEnabled);
      const botId =
        channelPayload.defaultChatBotId ??
        bots.find((bot) => bot.isDefault && isChatBot(bot))?.id ??
        bots.find((bot) => bot.enabled && isChatBot(bot))?.id ??
        null;
      setChatBots(bots);
      setChatAiEnabledState(enabled);
      setDefaultChatBotId(botId);
    } catch {
      setChatBots([]);
      setDefaultChatBotId(null);
      setChatAiEnabledState(false);
    } finally {
      setLoading(false);
    }
  }, [channelApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledChatBots = useMemo(
    () => chatBots.filter((bot) => bot.enabled && isChatBot(bot)),
    [chatBots]
  );

  const applyServerState = useCallback(
    (enabled: boolean, botId: string | null) => {
      setChatAiEnabledState(enabled);
      if (botId) setDefaultChatBotId(botId);
      options?.onChanged?.();
    },
    [options]
  );

  const selectChatBot = useCallback(
    async (botId: string) => {
      if (assigning || (chatAiEnabled && botId === defaultChatBotId)) return;
      setAssigning(true);
      try {
        const { data } = await channelApi.setChatAi(true, botId);
        applyServerState(
          Boolean(data.data?.chatAiEnabled),
          (data.data?.defaultChatBotId as string | null | undefined) ?? botId
        );
        toastSuccess(`AI enabled for all ${scopeLabel}`, { id: 'channel-chat-bot-pick' });
      } catch {
        void load();
        toastError('Could not apply chat AI bot.', { id: 'channel-chat-bot-pick' });
      } finally {
        setAssigning(false);
      }
    },
    [applyServerState, assigning, channelApi, chatAiEnabled, defaultChatBotId, load, scopeLabel]
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
        toastError('Create and enable a chat agent first.', { id: 'channel-chat-bot-on' });
        return;
      }

      setAssigning(true);
      try {
        const { data } = await channelApi.setChatAi(next, next ? botId ?? undefined : undefined);
        applyServerState(
          Boolean(data.data?.chatAiEnabled),
          (data.data?.defaultChatBotId as string | null | undefined) ?? botId
        );
        toastSuccess(
          next ? `AI enabled for all ${scopeLabel}` : `AI turned off for ${scopeLabel}`,
          { id: next ? 'channel-chat-bot-on' : 'channel-chat-bot-off' }
        );
      } catch {
        void load();
        toastError(next ? 'Could not enable chat AI.' : 'Could not turn off chat AI.', {
          id: next ? 'channel-chat-bot-on' : 'channel-chat-bot-off',
        });
      } finally {
        setAssigning(false);
      }
    },
    [
      applyServerState,
      assigning,
      channelApi,
      chatAiEnabled,
      defaultChatBotId,
      enabledChatBots,
      load,
      scopeLabel,
    ]
  );

  return {
    chatBots,
    enabledChatBots,
    defaultChatBotId,
    chatAiEnabled,
    loading,
    assigning,
    load,
    selectChatBot,
    setChatAiEnabled,
  };
}
