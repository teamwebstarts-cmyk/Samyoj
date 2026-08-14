import { useEffect, useState, type RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import { getActiveWhatsappNumberId } from '../../services/api';

const HEARTBEAT_MS = 25_000;

export interface PresenceViewer {
  id: string;
  name: string;
}

interface PresenceDeps {
  socketRef: RefObject<Socket | null>;
  connected: boolean;
  conversationId: string | undefined;
  currentUserId: string | undefined;
}

/**
 * "X is viewing" presence for the open conversation: joins the conversation
 * room, heartbeats `conversation:viewing`, and tracks other viewers (self
 * excluded). Server entries expire ~60s after the last heartbeat.
 */
export function useConversationPresence({
  socketRef,
  connected,
  conversationId,
  currentUserId,
}: PresenceDeps): PresenceViewer[] {
  const [viewers, setViewers] = useState<PresenceViewer[]>([]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !connected || !conversationId) {
      setViewers([]);
      return;
    }

    const excludeSelf = (list: PresenceViewer[]) =>
      list.filter((viewer) => viewer.id !== currentUserId);

    const whatsappNumberId = getActiveWhatsappNumberId() || undefined;

    socket.emit('join:conversation', { conversationId, whatsappNumberId }, (reply: unknown) => {
      const ack = reply as { viewers?: PresenceViewer[] };
      setViewers(excludeSelf(ack?.viewers ?? []));
    });

    const beat = () => socket.emit('conversation:viewing', { conversationId, whatsappNumberId });
    beat();
    const heartbeat = window.setInterval(beat, HEARTBEAT_MS);

    const onJoin = (payload: { conversationId?: string; user?: PresenceViewer }) => {
      if (payload?.conversationId !== conversationId || !payload.user) return;
      if (payload.user.id === currentUserId) return;
      setViewers((prev) =>
        prev.some((v) => v.id === payload.user!.id) ? prev : [...prev, payload.user!]
      );
    };
    const onLeave = (payload: { conversationId?: string; userId?: string }) => {
      if (payload?.conversationId !== conversationId || !payload.userId) return;
      setViewers((prev) => prev.filter((v) => v.id !== payload.userId));
    };

    socket.on('conversation:presence', onJoin);
    socket.on('conversation:presence:left', onLeave);

    return () => {
      window.clearInterval(heartbeat);
      socket.off('conversation:presence', onJoin);
      socket.off('conversation:presence:left', onLeave);
      socket.emit('conversation:leave', { conversationId });
      setViewers([]);
    };
  }, [socketRef, connected, conversationId, currentUserId]);

  return viewers;
}
