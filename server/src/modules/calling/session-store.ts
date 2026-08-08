import getRedis from '../../config/redis';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('call-session-store');

const ACTIVE_PREFIX = 'call:active:';
const PENDING_PREFIX = 'call:pending:';
const PENDING_BY_CALL_PREFIX = 'call:pending-by-id:';
const CONNECT_LOCK_PREFIX = 'call:connect-lock:';
const ORG_ACTIVE_PREFIX = 'call:org:';
const ACTIVE_TTL_SEC = 7200;
/** Default pending TTL (60s). Override per-call for ring scenarios that exceed this. */
const DEFAULT_PENDING_TTL_SEC = 60;
/** Fail-closed sentinel when Redis is unavailable for concurrency checks. */
const REDIS_DOWN_ACTIVE_COUNT = Number.MAX_SAFE_INTEGER;

export function getPendingTtl(ringTimeoutSec: number = 25): number {
  return Math.max(ringTimeoutSec + 5, DEFAULT_PENDING_TTL_SEC);
}

export interface PendingCallSignaling {
  callId: string;
  metaCallId: string;
  organizationId: string;
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  /** Internal whatsapp number id (encrypted token stays in DB, never Redis). */
  whatsappNumberId?: string;
  fromPhone: string;
  toPhone: string;
  direction: 'USER_INITIATED' | 'BUSINESS_INITIATED';
  sdpOffer: string;
  sdpAnswer?: string;
  createdAt: string;
}

export async function registerActiveCall(metaCallId: string, orgId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(`${ACTIVE_PREFIX}${metaCallId}`, orgId, 'EX', ACTIVE_TTL_SEC);
    await redis.sadd(`call:org:${orgId}:active`, metaCallId);
    await redis.expire(`call:org:${orgId}:active`, ACTIVE_TTL_SEC);
  } catch (err) {
    log.warn('Failed to register active call in Redis', {
      metaCallId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function unregisterActiveCall(metaCallId: string, orgId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(`${ACTIVE_PREFIX}${metaCallId}`);
    await redis.srem(`call:org:${orgId}:active`, metaCallId);
  } catch (err) {
    log.warn('Failed to unregister active call in Redis', {
      metaCallId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function getOrgActiveCallCount(orgId: string): Promise<number> {
  try {
    const redis = getRedis();
    return await redis.scard(`${ORG_ACTIVE_PREFIX}${orgId}:active`);
  } catch (err) {
    // Fail closed: treat as at capacity so we do not over-admit calls when Redis is down.
    log.warn('Active call count unavailable — failing closed', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return REDIS_DOWN_ACTIVE_COUNT;
  }
}

async function indexPendingByCallId(
  callId: string,
  metaCallId: string,
  ttlSec: number
): Promise<void> {
  const redis = getRedis();
  await redis.set(`${PENDING_BY_CALL_PREFIX}${callId}`, metaCallId, 'EX', ttlSec);
}

export async function storePendingCall(
  metaCallId: string,
  payload: PendingCallSignaling
): Promise<void> {
  const redis = getRedis();
  await redis.set(`${PENDING_PREFIX}${metaCallId}`, JSON.stringify(payload), 'EX', DEFAULT_PENDING_TTL_SEC);
  await indexPendingByCallId(payload.callId, metaCallId, DEFAULT_PENDING_TTL_SEC);
}

export async function storePendingCallWithTtl(
  metaCallId: string,
  payload: PendingCallSignaling,
  ringTimeoutSec: number
): Promise<void> {
  const redis = getRedis();
  const ttl = getPendingTtl(ringTimeoutSec);
  await redis.set(`${PENDING_PREFIX}${metaCallId}`, JSON.stringify(payload), 'EX', ttl);
  await indexPendingByCallId(payload.callId, metaCallId, ttl);
}

export async function getPendingCall(metaCallId: string): Promise<PendingCallSignaling | null> {
  const redis = getRedis();
  const raw = await redis.get(`${PENDING_PREFIX}${metaCallId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingCallSignaling;
  } catch {
    return null;
  }
}

/**
 * Resolve a WhatsApp number's decrypted Meta token for a pending call.
 * The token is never stored in Redis — it is re-derived from the DB each time.
 */
export async function resolvePendingCallAccessToken(
  pending: PendingCallSignaling
): Promise<string | null> {
  const prisma = (await import('../../config/database')).default;
  const where = pending.whatsappNumberId
    ? { id: pending.whatsappNumberId }
    : { phoneNumberId: pending.phoneNumberId };
  const number = await prisma.whatsappNumber.findFirst({
    where: { ...where, organizationId: pending.organizationId },
  });
  if (!number) return null;
  const { MetaWhatsAppService } = await import('../whatsapp/meta.service');
  return MetaWhatsAppService.decryptToken(number.accessToken);
}

export async function getPendingCallByCallId(callId: string): Promise<PendingCallSignaling | null> {
  const redis = getRedis();
  const metaCallId = await redis.get(`${PENDING_BY_CALL_PREFIX}${callId}`);
  if (metaCallId) {
    return getPendingCall(metaCallId);
  }
  return null;
}

export async function removePendingCall(metaCallId: string): Promise<void> {
  const redis = getRedis();
  const pending = await getPendingCall(metaCallId);
  await redis.del(`${PENDING_PREFIX}${metaCallId}`);
  if (pending?.callId) {
    await redis.del(`${PENDING_BY_CALL_PREFIX}${pending.callId}`);
  }
}

/** Acquire a short-lived lock so duplicate Meta connect webhooks do not start two sessions. */
export async function tryAcquireCallConnectLock(metaCallId: string, ttlSec = 30): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.set(`${CONNECT_LOCK_PREFIX}${metaCallId}`, '1', 'EX', ttlSec, 'NX');
    return result === 'OK';
  } catch (err) {
    log.warn('Connect lock unavailable — proceeding without Redis lock', {
      metaCallId,
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}
