import getRedis from '../../config/redis';
import { MetaWhatsAppService } from '../whatsapp/meta.service';

const TTL_SEC = 300;

function cacheKey(orgId: string, wabaId: string, name: string) {
  return `tpl:${orgId}:${wabaId}:${name.toLowerCase()}`;
}

export async function getCachedMessageTemplate(
  orgId: string,
  wabaId: string,
  accessToken: string,
  name: string
) {
  const key = cacheKey(orgId, wabaId, name);
  try {
    const redis = getRedis();
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as Awaited<ReturnType<typeof MetaWhatsAppService.getMessageTemplate>>;
  } catch {
    /* fall through to Meta */
  }

  const template = await MetaWhatsAppService.getMessageTemplate(wabaId, accessToken, name);
  if (template) {
    try {
      const redis = getRedis();
      await redis.set(key, JSON.stringify(template), 'EX', TTL_SEC);
    } catch {
      /* cache optional */
    }
  }
  return template;
}

function listCacheKey(orgId: string, wabaId: string, status: string) {
  return `tpllist:${orgId}:${wabaId}:${status || 'any'}`;
}

export async function rememberTemplateList(
  orgId: string,
  wabaId: string,
  status: string,
  templates: unknown[]
) {
  try {
    const redis = getRedis();
    await redis.set(listCacheKey(orgId, wabaId, status), JSON.stringify(templates), 'EX', 86_400);
  } catch {
    /* cache optional */
  }
}

export async function recallTemplateList<T>(orgId: string, wabaId: string, status: string): Promise<T[] | null> {
  try {
    const redis = getRedis();
    const cached = await redis.get(listCacheKey(orgId, wabaId, status));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as T[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function invalidateTemplateCache(orgId: string, wabaId: string, name?: string) {
  try {
    const redis = getRedis();
    if (name) {
      await redis.del(cacheKey(orgId, wabaId, name));
      return;
    }
    const pattern = `tpl:${orgId}:${wabaId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch {
    /* cache optional */
  }
}
