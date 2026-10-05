import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supportApi } from '../../services/api';
import { SUPPORT_WELCOME, type SupportChatMessage, type SupportStatusPayload, type SupportStatusReason } from './types';

function chatStorageKey(userId: string) {
  return `samyoj.support.chat.${userId}`;
}

function loadMessages(userId: string | undefined): SupportChatMessage[] {
  if (!userId || typeof sessionStorage === 'undefined') return [SUPPORT_WELCOME];
  try {
    const raw = sessionStorage.getItem(chatStorageKey(userId));
    if (!raw) return [SUPPORT_WELCOME];
    const parsed = JSON.parse(raw) as SupportChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [SUPPORT_WELCOME];
    return parsed;
  } catch {
    return [SUPPORT_WELCOME];
  }
}

export function applySupportStatusPayload(data: SupportStatusPayload): {
  assistantOnline: boolean;
  reason: SupportStatusReason;
  dailyCap: number | null;
  dailyUsed: number;
} {
  const dailyCap = data.dailyCap ?? null;
  const dailyUsed = typeof data.dailyUsed === 'number' && data.dailyUsed >= 0 ? data.dailyUsed : 0;
  const assistantOnline = Boolean(data.assistantOnline);
  const reason: SupportStatusReason =
    data.reason || (assistantOnline ? 'ready' : 'ai_unconfigured');
  return { assistantOnline, reason, dailyCap, dailyUsed };
}

export function statusCopy(
  reason: SupportStatusReason,
  assistantOnline: boolean | null,
  usage?: { dailyCap: number | null; dailyUsed: number }
) {
  if (reason === 'checking' || assistantOnline === null) return 'Checking…';
  if (reason === 'disabled') return 'Turned off for this workspace';
  if (reason === 'daily_cap') return 'Daily limit reached';
  if (reason === 'ai_unconfigured' || assistantOnline === false) return 'Temporarily unavailable';
  if (usage?.dailyCap != null && usage.dailyCap > 0) {
    const used = Math.max(0, usage.dailyUsed);
    return `Ready · ${used}/${usage.dailyCap} today`;
  }
  return 'Ready to help';
}

export function useSupportChat(active: boolean) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportChatMessage[]>(() => loadMessages(user?.id));
  const [assistantOnline, setAssistantOnline] = useState<boolean | null>(null);
  const [reason, setReason] = useState<SupportStatusReason>('checking');
  const [dailyCap, setDailyCap] = useState<number | null>(null);
  const [dailyUsed, setDailyUsed] = useState(0);

  const resetChat = useCallback(() => {
    setMessages([SUPPORT_WELCOME]);
    if (user?.id && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(chatStorageKey(user.id));
      } catch {
        // ignore
      }
    }
  }, [user?.id]);

  const refreshStatus = useCallback(() => {
    return supportApi
      .status()
      .then((res) => {
        const data = (res.data?.data || {}) as SupportStatusPayload;
        const next = applySupportStatusPayload(data);
        setAssistantOnline(next.assistantOnline);
        setReason(next.reason);
        setDailyCap(next.dailyCap);
        setDailyUsed(next.dailyUsed);
      })
      .catch(() => {
        setAssistantOnline(false);
        setReason('ai_unconfigured');
      });
  }, []);

  useEffect(() => {
    setMessages(loadMessages(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!active) return;
    setAssistantOnline(null);
    setReason('checking');
    void refreshStatus();
  }, [active, refreshStatus]);

  useEffect(() => {
    if (!user?.id || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(chatStorageKey(user.id), JSON.stringify(messages));
    } catch {
      // Private mode / quota — chat still works in memory.
    }
  }, [messages, user?.id]);

  return {
    user,
    messages,
    setMessages,
    assistantOnline,
    reason,
    dailyCap,
    dailyUsed,
    refreshStatus,
    resetChat,
    hasChat: messages.some((m) => m.role === 'user'),
  };
}
