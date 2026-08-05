import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import { inboxApi } from '../../services/api';
import { useSocket, type SocketState } from '../../hooks/useSocket';
import { logError } from '../../utils/errors';
import type { Conversation, Message, ServiceWindowInfo } from '../../types';
import { emitChatNotice } from './chatNoticeBus';

function softCatch(action: string, conversationId?: string) {
  return (err: unknown) => {
    logError(err, { source: 'inbox', action, conversationId });
  };
}

interface RealtimeDeps {
  selectedRef: MutableRefObject<Conversation | null>;
  conversationsRef: MutableRefObject<Conversation[]>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setSelected: Dispatch<SetStateAction<Conversation | null>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setServiceWindow: Dispatch<SetStateAction<ServiceWindowInfo | undefined>>;
  upsertConversation: (conv: Conversation, toTop?: boolean) => void;
  markConversationRead: (conversationId: string) => void;
  refreshUnread: () => Promise<void>;
  reloadList: () => void;
}

/**
 * Socket wiring for the inbox: surgical single-conversation upserts instead of
 * full list refetches, plus a catch-up refetch after reconnect.
 */
export function useInboxRealtime({
  selectedRef,
  conversationsRef,
  setConversations,
  setSelected,
  setMessages,
  setServiceWindow,
  upsertConversation,
  markConversationRead,
  refreshUnread,
  reloadList,
}: RealtimeDeps): { socketState: SocketState; socketRef: RefObject<Socket | null> } {
  const handleSocketEvent = useCallback(
    (event: string, data: unknown) => {
      const payload = data as {
        conversationId: string;
        message?: Message;
        messageId?: string;
        status?: string;
        snoozedUntil?: string | null;
        conversation?: Conversation;
        patch?: Partial<Conversation>;
        assignedAgent?: { id: string; name: string } | null;
        botActive?: boolean;
        botHandoffAt?: string | null;
        activeBot?: { id: string; name: string } | null;
        reason?: string;
      };
      const openId = selectedRef.current?.id;

      if (event === 'message:new') {
        // The socket summary is partial (no contact) — safe to merge into a
        // row already in the list, but a brand-new conversation needs a full
        // fetch or the row would render without a contact.
        const known = conversationsRef.current.some((c) => c.id === payload.conversationId);
        if (payload.conversation && known) {
          upsertConversation(payload.conversation, true);
        } else if (payload.conversationId) {
          inboxApi
            .get(payload.conversationId)
            .then(({ data: res }) => upsertConversation(res.data as Conversation, true))
            .catch(softCatch('realtime.fetchConversation', payload.conversationId));
        }
        void refreshUnread();
        if (openId === payload.conversationId && payload.message) {
          const msg = payload.message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            // Drop matching optimistic rows so socket ack doesn't double-render.
            const withoutOptimistic = prev.filter((m) => {
              if (!m.id.startsWith('optimistic-')) return true;
              if (m.direction !== msg.direction || m.type !== msg.type) return true;
              const sameContent = (m.content || '') === (msg.content || '');
              const ageMs = Math.abs(
                new Date(msg.createdAt).getTime() - new Date(m.createdAt).getTime()
              );
              return !(sameContent && ageMs < 60_000);
            });
            return [...withoutOptimistic, msg];
          });
          if (msg.direction === 'INBOUND') {
            markConversationRead(payload.conversationId);
            // Server stays the source of truth for the 24h window — silent refresh.
            inboxApi
              .messages(payload.conversationId)
              .then(({ data: res }) => {
                const win = res.data.serviceWindow as ServiceWindowInfo | undefined;
                if (win) setServiceWindow(win);
              })
              .catch(softCatch('realtime.refreshServiceWindow', payload.conversationId));
          }
        }
        return;
      }

      if (event === 'message:status' && openId === payload.conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId
              ? { ...m, status: (payload.status || m.status).toUpperCase() }
              : m
          )
        );
        return;
      }

      if (event === 'message:reaction' && openId === payload.conversationId && payload.messageId) {
        const raw = payload as {
          reactions?: Array<{ emoji: string; from: string }>;
          metadata?: { reactions?: Array<{ emoji: string; from: string }> };
        };
        const reactions = raw.reactions ?? raw.metadata?.reactions;
        if (!reactions) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId
              ? { ...m, metadata: { ...m.metadata, reactions } }
              : m
          )
        );
        return;
      }

      if (event === 'conversation:read') {
        setConversations((prev) =>
          prev.map((c) => (c.id === payload.conversationId ? { ...c, unreadCount: 0 } : c))
        );
        void refreshUnread();
        return;
      }

      if (event === 'conversation:status') {
        if (!payload.status) return;
        const status = payload.status;
        setConversations((prev) => prev.map((c) => (c.id === payload.conversationId ? { ...c, status } : c)));
        setSelected((prev) => (prev?.id === payload.conversationId ? { ...prev, status } : prev));
        return;
      }

      if (event === 'conversation:snooze') {
        // Server emits only snoozedUntil (date or null) — derive display status
        // locally without clobbering an unrelated CLOSED/PENDING state.
        const until = payload.snoozedUntil ?? null;
        const applySnooze = (c: Conversation): Conversation => ({
          ...c,
          snoozedUntil: until,
          status: until ? 'SNOOZED' : c.status === 'SNOOZED' ? 'OPEN' : c.status,
        });
        setConversations((prev) => prev.map((c) => (c.id === payload.conversationId ? applySnooze(c) : c)));
        setSelected((prev) => (prev?.id === payload.conversationId ? applySnooze(prev) : prev));
        return;
      }

      if (event === 'conversation:updated') {
        if (payload.patch) {
          const patch = payload.patch;
          setConversations((prev) =>
            prev.map((c) => (c.id === payload.conversationId ? { ...c, ...patch } : c))
          );
          setSelected((prev) =>
            prev?.id === payload.conversationId ? { ...prev, ...patch } : prev
          );
        } else if (payload.conversation) {
          upsertConversation(payload.conversation);
        } else if (payload.conversationId) {
          inboxApi
            .get(payload.conversationId)
            .then(({ data: res }) => upsertConversation(res.data as Conversation))
            .catch(softCatch('realtime.conversationUpdated', payload.conversationId));
        }
        return;
      }

      if (event === 'conversation:assigned') {
        const patch = { assignedAgent: payload.assignedAgent || undefined };
        setConversations((prev) => prev.map((c) => (c.id === payload.conversationId ? { ...c, ...patch } : c)));
        setSelected((prev) => (prev?.id === payload.conversationId ? { ...prev, ...patch } : prev));
        return;
      }

      if (event === 'conversation:bot' || event === 'conversation:handoff') {
        const isHandoff = event === 'conversation:handoff';
        const patch = (c: Conversation): Conversation => ({
          ...c,
          botActive: payload.botActive ?? (isHandoff ? false : c.botActive),
          botHandoffAt: isHandoff ? new Date().toISOString() : payload.botHandoffAt,
          botHandoffReason: isHandoff ? payload.reason : c.botHandoffReason,
          status: isHandoff ? 'PENDING' : c.status,
          activeBot: payload.activeBot ?? c.activeBot,
          assignedAgent: payload.assignedAgent || c.assignedAgent,
        });
        setConversations((prev) => prev.map((c) => (c.id === payload.conversationId ? patch(c) : c)));
        if (openId === payload.conversationId) {
          setSelected((prev) => (prev ? patch(prev) : prev));
          if (isHandoff) {
            emitChatNotice(payload.conversationId, {
              kind: 'handoff',
              message: payload.assignedAgent
                ? `Handed off to ${payload.assignedAgent.name}`
                : 'Customer handed off to your team',
              icon: 'users',
              tone: 'orange',
            });
          }
        }
      }
    },
    [
      selectedRef,
      conversationsRef,
      setConversations,
      setSelected,
      setMessages,
      setServiceWindow,
      upsertConversation,
      markConversationRead,
      refreshUnread,
    ]
  );

  const { socketRef, state: socketState } = useSocket(handleSocketEvent);

  const prevStatusRef = useRef(socketState.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = socketState.status;
    // Catch up after a real disconnect. Reconnect goes disconnected → connecting
    // → connected, so excluding `connecting` previously skipped every reconnect
    // and left the open thread stale until a hard refresh.
    if (
      socketState.status === 'connected' &&
      prev !== 'connected' &&
      socketState.totalDisconnects > 0
    ) {
      reloadList();
      const openId = selectedRef.current?.id;
      if (openId) {
        inboxApi
          .messages(openId)
          .then(({ data }) => {
            setMessages((data.data.messages ?? []) as Message[]);
            setServiceWindow(data.data.serviceWindow ?? undefined);
          })
          .catch(softCatch('realtime.reconnectCatchUp', openId));
      }
    }
  }, [
    socketState.status,
    socketState.totalDisconnects,
    reloadList,
    selectedRef,
    setMessages,
    setServiceWindow,
  ]);

  return { socketState, socketRef };
}
