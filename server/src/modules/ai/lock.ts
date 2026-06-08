import getRedis from '../../config/redis';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('ai-bot-lock');
const LOCK_TTL_SEC = 45;
const LOCK_PREFIX = 'ai-bot:conv:';

export async function withAiBotConversationLock<T>(
  conversationId: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const redis = getRedis();
  const key = `${LOCK_PREFIX}${conversationId}`;
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const acquired = await redis.set(key, token, 'EX', LOCK_TTL_SEC, 'NX');
  if (acquired !== 'OK') {
    log.warn('AI bot conversation lock busy', { conversationId });
    return null;
  }

  try {
    return await fn();
  } finally {
    const current = await redis.get(key);
    if (current === token) {
      await redis.del(key);
    }
  }
}
