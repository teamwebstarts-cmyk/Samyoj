import getRedis from '../../config/redis';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('flow-lock');
const LOCK_TTL_SEC = 30;
const LOCK_HEARTBEAT_MS = 10_000;
const LOCK_PREFIX = 'flow:conv:';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 80;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryAcquireLock(conversationId: string, token: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${LOCK_PREFIX}${conversationId}`;
  const acquired = await redis.set(key, token, 'EX', LOCK_TTL_SEC, 'NX');
  return acquired === 'OK';
}

async function releaseLock(conversationId: string, token: string): Promise<void> {
  const redis = getRedis();
  const key = `${LOCK_PREFIX}${conversationId}`;
  const current = await redis.get(key);
  if (current === token) {
    await redis.del(key);
  }
}

export async function withConversationLock<T>(
  conversationId: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const acquired = await tryAcquireLock(conversationId, token);
    if (acquired) {
      const redis = getRedis();
      const key = `${LOCK_PREFIX}${conversationId}`;
      const heartbeat = setInterval(() => {
        void redis
          .get(key)
          .then((current) => (current === token ? redis.expire(key, LOCK_TTL_SEC) : undefined))
          .catch(() => undefined);
      }, LOCK_HEARTBEAT_MS);
      heartbeat.unref?.();
      try {
        return await fn();
      } finally {
        clearInterval(heartbeat);
        await releaseLock(conversationId, token);
      }
    }
    if (attempt < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  log.warn('Conversation lock busy after retries, skipping flow processing', { conversationId });
  return null;
}
