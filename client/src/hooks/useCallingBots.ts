import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiBotApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import type { AiBot } from '../types';

function isCallBot(bot: AiBot): boolean {
  return (bot.channel ?? 'CHAT') === 'CALL';
}

export function useCallingBots() {
  const [callBots, setCallBots] = useState<AiBot[]>([]);
  const [answeringCallBotId, setAnsweringCallBotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await aiBotApi.list('CALL');
      setCallBots((data.data?.bots ?? []) as AiBot[]);
      setAnsweringCallBotId(
        typeof data.data?.answeringCallBotId === 'string' ? data.data.answeringCallBotId : null
      );
    } catch {
      setCallBots([]);
      setAnsweringCallBotId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabledCallBots = useMemo(
    () => callBots.filter((bot) => bot.enabled && isCallBot(bot)),
    [callBots]
  );

  const activeCallBot = useMemo(() => {
    return (
      enabledCallBots.find((bot) => bot.id === answeringCallBotId) ??
      enabledCallBots.find((bot) => bot.answersCalls) ??
      enabledCallBots[0] ??
      null
    );
  }, [enabledCallBots, answeringCallBotId]);

  const selectCallBot = useCallback(
    async (botId: string) => {
      if (assigning || botId === answeringCallBotId) return;
      setAssigning(true);
      try {
        await aiBotApi.update(botId, { answersCalls: true });
        setAnsweringCallBotId(botId);
        setCallBots((prev) =>
          prev.map((bot) => ({
            ...bot,
            answersCalls: bot.id === botId,
          }))
        );
        toastSuccess('Calling agent updated', { id: 'calling-bot-pick' });
      } catch {
        toastError('Could not update calling agent.', { id: 'calling-bot-pick' });
      } finally {
        setAssigning(false);
      }
    },
    [answeringCallBotId, assigning]
  );

  return {
    callBots,
    enabledCallBots,
    answeringCallBotId,
    activeCallBot,
    loading,
    assigning,
    load,
    selectCallBot,
  };
}
