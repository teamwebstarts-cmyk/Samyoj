import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { inboxApi } from '../../services/api';
import { toastError } from '../../utils/toast';
import { logError } from '../../utils/errors';
import type { Conversation, Message, ServiceWindowInfo } from '../../types';

const MESSAGE_PAGE_LIMIT = 50;

interface ThreadDeps {
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  refreshUnread: () => void;
}

export interface ConversationThread {
  selected: Conversation | null;
  setSelected: Dispatch<SetStateAction<Conversation | null>>;
  selectedRef: MutableRefObject<Conversation | null>;
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  serviceWindow: ServiceWindowInfo | undefined;
  setServiceWindow: Dispatch<SetStateAction<ServiceWindowInfo | undefined>>;
  threadLoading: boolean;
  threadError: boolean;
  hasEarlier: boolean;
  loadingEarlier: boolean;
  upsertConversation: (conv: Conversation, toTop?: boolean) => void;
  openConversation: (conv: Conversation) => Promise<void>;
  loadEarlierMessages: () => Promise<void>;
  markConversationRead: (conversationId: string) => void;
}

/** Open-thread state: selected conversation, messages, service window, history loading. */
export function useConversationThread({ setConversations, refreshUnread }: ThreadDeps): ConversationThread {
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [serviceWindow, setServiceWindow] = useState<ServiceWindowInfo | undefined>(undefined);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const selectedRef = useRef<Conversation | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const upsertConversation = useCallback(
    (conv: Conversation, toTop = false) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx === -1) return [conv, ...prev];
        const merged = { ...prev[idx], ...conv };
        const next = [...prev];
        next[idx] = merged;
        if (toTop && idx > 0) {
          next.splice(idx, 1);
          next.unshift(merged);
        }
        return next;
      });
      setSelected((prev) => (prev?.id === conv.id ? { ...prev, ...conv } : prev));
    },
    [setConversations]
  );

  const removeConversation = useCallback(
    (conversationId: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setSelected((prev) => (prev?.id === conversationId ? null : prev));
    },
    [setConversations]
  );

  const markConversationRead = useCallback(
    (conversationId: string) => {
      inboxApi.markRead(conversationId).catch((err) => {
        logError(err, { source: 'inbox', action: 'markRead', conversationId });
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
      void refreshUnread();
    },
    [refreshUnread, setConversations]
  );

  const openConversation = useCallback(
    async (conv: Conversation) => {
      const requestId = conv.id;
      setSelected(conv);
      setThreadError(false);
      setThreadLoading(true);
      setServiceWindow(undefined);
      setMessages([]);
      setHasEarlier(false);
      try {
        // Single fetch per chat open: thread + full conversation details in parallel.
        const [msgRes, convRes] = await Promise.all([
          inboxApi.messages(conv.id),
          inboxApi.get(conv.id),
        ]);
        // Ignore stale responses if user switched chats mid-flight.
        if (selectedRef.current?.id !== requestId) return;

        const payload = msgRes.data?.data;
        const msgs = (payload?.messages ?? []) as Message[];
        setMessages(msgs);
        setServiceWindow(payload?.serviceWindow ?? undefined);
        const hasMoreFlag = payload?.hasMore;
        setHasEarlier(
          typeof hasMoreFlag === 'boolean' ? hasMoreFlag : msgs.length >= MESSAGE_PAGE_LIMIT
        );
        const full = (convRes.data?.data ?? null) as Conversation | null;
        if (full) {
          setSelected((prev) => (prev?.id === conv.id ? { ...prev, ...full } : prev));
        }
      } catch (err) {
        const aborted =
          (err as { code?: string; name?: string; message?: string })?.code === 'ERR_CANCELED' ||
          (err as { name?: string })?.name === 'CanceledError' ||
          (err as { message?: string })?.message === 'canceled';
        if (aborted) return;
        // Only surface error if this chat is still selected.
        if (selectedRef.current?.id !== requestId) return;
        console.error(err);
        setThreadError(true);
      } finally {
        if (selectedRef.current?.id === requestId) {
          setThreadLoading(false);
        }
      }
      markConversationRead(conv.id);
    },
    [markConversationRead]
  );

  const loadEarlierMessages = useCallback(async () => {
    const conv = selectedRef.current;
    const oldest = messagesRef.current[0];
    if (!conv || !oldest || loadingEarlier || !hasEarlier) return;
    setLoadingEarlier(true);
    try {
      const { data } = await inboxApi.messages(conv.id, {
        before: oldest.createdAt,
        limit: String(MESSAGE_PAGE_LIMIT),
      });
      const older = (data.data.messages ?? []) as Message[];
      setMessages((prev) => [...older.filter((o) => !prev.some((m) => m.id === o.id)), ...prev]);
      const hasMoreFlag = data.data.hasMore;
      setHasEarlier(
        typeof hasMoreFlag === 'boolean' ? hasMoreFlag : older.length >= MESSAGE_PAGE_LIMIT
      );
    } catch {
      toastError('Could not load earlier messages');
    } finally {
      setLoadingEarlier(false);
    }
  }, [loadingEarlier, hasEarlier]);

  return {
    selected,
    setSelected,
    selectedRef,
    messages,
    setMessages,
    serviceWindow,
    setServiceWindow,
    threadLoading,
    threadError,
    hasEarlier,
    loadingEarlier,
    upsertConversation,
    removeConversation,
    openConversation,
    loadEarlierMessages,
    markConversationRead,
  };
}
