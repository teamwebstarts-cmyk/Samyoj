import { Server } from 'socket.io';
import Redis from 'ioredis';
import { config } from './config';
import { getRedis } from './config/redis';

const REALTIME_CHANNEL = 'samyoj:realtime:emit';

let io: Server | null = null;
let subscriberStarted = false;

type RealtimePayload =
  | { target: 'org'; id: string; event: string; data: unknown }
  | { target: 'user'; id: string; event: string; data: unknown };

function deliver(payload: RealtimePayload): void {
  if (!io) return;
  const room = payload.target === 'org' ? `org:${payload.id}` : `user:${payload.id}`;
  io.to(room).emit(payload.event, payload.data);
}

function publish(payload: RealtimePayload): void {
  void getRedis()
    .publish(REALTIME_CHANNEL, JSON.stringify(payload))
    .catch(() => {
      // Redis publish failed — realtime event dropped (logged elsewhere if critical)
    });
}

/** Wire Socket.IO and subscribe to Redis so worker processes can emit via pub/sub. */
export function setRealtimeIO(server: Server): void {
  io = server;
  if (subscriberStarted) return;
  subscriberStarted = true;

  const sub = new Redis(config.redisUrl);
  void sub.subscribe(REALTIME_CHANNEL);
  sub.on('message', (_channel, raw) => {
    try {
      deliver(JSON.parse(raw) as RealtimePayload);
    } catch {
      // Ignore malformed payloads
    }
  });
}

function emit(target: 'org' | 'user', id: string, event: string, data: unknown): void {
  const payload: RealtimePayload = { target, id, event, data };
  if (io) {
    deliver(payload);
  } else {
    // Worker process (no Socket.IO) — publish for the API process to deliver.
    publish(payload);
  }
}

export function emitToOrg(organizationId: string, event: string, data: unknown): void {
  emit('org', organizationId, event, data);
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  emit('user', userId, event, data);
}

export function emitToUsers(userIds: string[], event: string, data: unknown): void {
  for (const userId of userIds) {
    emitToUser(userId, event, data);
  }
}
