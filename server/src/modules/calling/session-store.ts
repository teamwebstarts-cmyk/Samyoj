import getRedis from '../../config/redis';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('call-session-store');

const ACTIVE_PREFIX = 'call:active:';
const PENDING_PREFIX = 'call:pending:';
const ACTIVE_TTL_SEC = 7200;
const PENDING_TTL_SEC = 60;

export interface PendingCallSignaling {
  callId: string;
  metaCallId: string;
  organizationId: string;
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  accessToken: string;
  fromPhone: string;
  toPhone: string;
  direction: 'USER_INITIATED' | 'BUSINESS_INITIATED';
  sdpOffer: string;
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
    return await redis.scard(`call:org:${orgId}:active`);
  } catch {
    return 0;
  }
}

export async function storePendingCall(
  metaCallId: string,
  payload: PendingCallSignaling
): Promise<void> {
  const redis = getRedis();
  await redis.set(`${PENDING_PREFIX}${metaCallId}`, JSON.stringify(payload), 'EX', PENDING_TTL_SEC);
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

export async function getPendingCallByCallId(callId: string): Promise<PendingCallSignaling | null> {
  const redis = getRedis();
  const keys = await redis.keys(`${PENDING_PREFIX}*`);
  for (const key of keys) {
    const raw = await redis.get(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as PendingCallSignaling;
      if (parsed.callId === callId) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

export async function removePendingCall(metaCallId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${PENDING_PREFIX}${metaCallId}`);
}
