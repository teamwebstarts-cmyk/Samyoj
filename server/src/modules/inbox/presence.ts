import type { Server, Socket } from 'socket.io';
import prisma from '../../config/database';
import logger from '../../utils/logger';

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

async function ownsConversation(
  conversationId: string,
  organizationId: string
): Promise<boolean> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
    select: { id: true },
  });
  return Boolean(conversation);
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
    async (conversationId: string, ack?: (reply: unknown) => void) => {
      socket.join(roomOf(conversationId));
      if (typeof ack === 'function') {
        try {
          const allowed = await ownsConversation(conversationId, organizationId);
          ack(allowed ? { viewers: viewersList(conversationId) } : { viewers: [] });
        } catch (err) {
          logger.error('join:conversation ack failed', {
            source: 'presence',
            conversationId,
            error: err instanceof Error ? err.message : err,
          });
          ack({ viewers: [] });
        }
      }
    }
  );

  socket.on('conversation:viewing', async (payload: { conversationId?: string }) => {
    const conversationId = payload?.conversationId;
    if (typeof conversationId !== 'string' || !conversationId) return;
    try {
      if (!(await ownsConversation(conversationId, organizationId))) return;

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
