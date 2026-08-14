import type { Server, Socket } from 'socket.io';
import prisma from '../../config/database';
import logger from '../../utils/logger';
import {
  conversationRoomAllowed,
  parseConversationJoinPayload,
  resolveSocketWhatsappNumberId,
} from './conversation-room';

// Ephemeral, in-memory conversation presence ("X is viewing"). No DB writes:
// entries live only while clients heartbeat via `conversation:viewing`.
const HEARTBEAT_TTL_MS = 60_000;
const SWEEP_INTERVAL_MS = 30_000;

interface Viewer {
  name: string;
  lastSeen: number;
}

// conversationId → userId → viewer
const viewers = new Map<string, Map<string, Viewer>>();
// userId → name (JWT only carries id/email, so resolve names once)
const userNames = new Map<string, string>();

const roomOf = (conversationId: string) => `conversation:${conversationId}`;

function viewersList(conversationId: string): { id: string; name: string }[] {
  const map = viewers.get(conversationId);
  if (!map) return [];
  return [...map.entries()].map(([id, v]) => ({ id, name: v.name }));
}

async function resolveUserName(userId: string): Promise<string> {
  const cached = userNames.get(userId);
  if (cached) return cached;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const name = user?.name || user?.email || 'Agent';
  userNames.set(userId, name);
  return name;
}

function handshakeWhatsappNumberId(socket: Socket): string | undefined {
  const raw = socket.handshake.auth?.whatsappNumberId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

async function canJoinConversationRoom(
  socket: Socket,
  organizationId: string,
  conversationId: string,
  requestedNumberId?: string
): Promise<boolean> {
  const numberId = await resolveSocketWhatsappNumberId(
    organizationId,
    requestedNumberId || handshakeWhatsappNumberId(socket) || socket.data.activeWhatsappNumberId
  );
  socket.data.activeWhatsappNumberId = numberId;
  return conversationRoomAllowed(conversationId, organizationId, numberId);
}

function removeViewer(
  io: Server,
  conversationId: string,
  userId: string,
  broadcast: boolean
) {
  const map = viewers.get(conversationId);
  if (!map?.delete(userId)) return;
  if (map.size === 0) viewers.delete(conversationId);
  if (broadcast) {
    io.to(roomOf(conversationId)).emit('conversation:presence:left', {
      conversationId,
      userId,
    });
  }
}

export function startPresenceSweeper(io: Server): void {
  setInterval(() => {
    const now = Date.now();
    for (const [conversationId, map] of viewers) {
      for (const [userId, viewer] of map) {
        if (now - viewer.lastSeen > HEARTBEAT_TTL_MS) {
          removeViewer(io, conversationId, userId, true);
        }
      }
    }
  }, SWEEP_INTERVAL_MS).unref();
}

export function registerPresenceHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as { userId?: string; organizationId?: string } | undefined;
  const userId = user?.userId;
  const organizationId = user?.organizationId;
  if (!userId || !organizationId) return;

  // Conversations this socket marked as viewing (for disconnect cleanup)
  const viewing = new Set<string>();

  socket.on(
    'join:conversation',
    async (payload: unknown, ack?: (reply: unknown) => void) => {
      const parsed = parseConversationJoinPayload(payload);
      const reply = (body: unknown) => {
        if (typeof ack === 'function') ack(body);
      };
      if (!parsed) {
        reply({ viewers: [] });
        return;
      }
      try {
        const allowed = await canJoinConversationRoom(
          socket,
          organizationId,
          parsed.conversationId,
          parsed.whatsappNumberId
        );
        if (!allowed) {
          reply({ viewers: [] });
          return;
        }
        socket.join(roomOf(parsed.conversationId));
        reply({ viewers: viewersList(parsed.conversationId) });
      } catch (err) {
        logger.error('join:conversation failed', {
          source: 'presence',
          conversationId: parsed.conversationId,
          error: err instanceof Error ? err.message : err,
        });
        reply({ viewers: [] });
      }
    }
  );

  socket.on('conversation:viewing', async (payload: { conversationId?: string; whatsappNumberId?: string }) => {
    const conversationId = payload?.conversationId;
    if (typeof conversationId !== 'string' || !conversationId) return;
    try {
      const allowed = await canJoinConversationRoom(
        socket,
        organizationId,
        conversationId,
        payload?.whatsappNumberId
      );
      if (!allowed) return;

      socket.join(roomOf(conversationId));
      viewing.add(conversationId);

      const name = await resolveUserName(userId);
      let map = viewers.get(conversationId);
      if (!map) {
        map = new Map();
        viewers.set(conversationId, map);
      }
      const alreadyViewing = map.has(userId);
      map.set(userId, { name, lastSeen: Date.now() });

      if (!alreadyViewing) {
        socket.to(roomOf(conversationId)).emit('conversation:presence', {
          conversationId,
          user: { id: userId, name },
        });
      }
    } catch (err) {
      logger.error('conversation:viewing failed', {
        source: 'presence',
        conversationId,
        userId,
        error: err instanceof Error ? err.message : err,
      });
    }
  });

  socket.on('conversation:leave', async (payload: { conversationId?: string }) => {
    const conversationId = payload?.conversationId;
    if (typeof conversationId !== 'string' || !conversationId) return;
    viewing.delete(conversationId);
    socket.leave(roomOf(conversationId));
    // Another tab of the same user may still be in the room with a live heartbeat
    const remaining = await io.in(roomOf(conversationId)).fetchSockets();
    const stillViewing = remaining.some((s) => s.data.user?.userId === userId);
    if (!stillViewing) removeViewer(io, conversationId, userId, true);
  });

  socket.on('disconnect', () => {
    const viewed = [...viewing];
    viewing.clear();
    void (async () => {
      for (const conversationId of viewed) {
        // Multi-tab: keep the entry if another live socket of this user is
        // still in the room; the sweeper is the backstop for any race.
        const remaining = await io.in(roomOf(conversationId)).fetchSockets();
        const stillViewing = remaining.some((s) => s.data.user?.userId === userId);
        if (!stillViewing) removeViewer(io, conversationId, userId, true);
      }
    })().catch((err) =>
      logger.error('presence disconnect cleanup failed', {
        source: 'presence',
        userId,
        error: err instanceof Error ? err.message : err,
      })
    );
  });
}
