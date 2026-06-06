import Redis from 'ioredis';
import { config } from '../../config';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  }
  return redis;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds = 60
): Promise<{ allowed: boolean; remaining: number }> {
  const client = getRedis();
  const redisKey = `rate:${key}`;
  const count = await client.incr(redisKey);

  if (count === 1) {
    await client.expire(redisKey, windowSeconds);
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  };
}
