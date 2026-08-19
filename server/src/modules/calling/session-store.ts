import getRedis from '../../config/redis';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('call-session-store');

const ACTIVE_PREFIX = 'call:active:';
const PENDING_PREFIX = 'call:pending:';
const PENDING_BY_CALL_PREFIX = 'call:pending-by-id:';
const CONNECT_LOCK_PREFIX = 'call:connect-lock:';
const HANGUP_PREFIX = 'call:hangup:';
const ORG_ACTIVE_PREFIX = 'call:org:';
const ACTIVE_TTL_SEC = 7200;
/** Default pending TTL. Outbound BIC may ring for >60s before answer — keep signaling alive. */
const DEFAULT_PENDING_TTL_SEC = 180;
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
    where: { ...where, organizationId: pending.organizationId, isActive: true },
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
    // Fail closed: without a lock, duplicate Meta connect webhooks can start two sessions.
    log.warn('Connect lock unavailable — rejecting connect to avoid duplicate sessions', {
      metaCallId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function releaseCallConnectLock(metaCallId: string): Promise<void> {
  try {
    await getRedis().del(`${CONNECT_LOCK_PREFIX}${metaCallId}`);
  } catch {
    // ignore
  }
}

/** Remember that Meta (or the agent) already hung up — late connect/accept must not revive the call. */
export async function markCallHungUp(metaCallId: string, ttlSec = 180): Promise<void> {
  if (!metaCallId) return;
  try {
    await getRedis().set(`${HANGUP_PREFIX}${metaCallId}`, '1', 'EX', ttlSec);
  } catch (err) {
    log.warn('Failed to mark call hung up in Redis', {
      metaCallId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function isCallHungUp(metaCallId: string): Promise<boolean> {
  if (!metaCallId) return false;
  try {
    return (await getRedis().get(`${HANGUP_PREFIX}${metaCallId}`)) === '1';
  } catch {
    return false;
  }
}

// ─── Outbound BIC unanswered cooldown (Meta quality / permission protection) ───

const BIC_UNANSWERED_PREFIX = 'call:bic:unanswered:';
const BIC_UNANSWERED_TTL_SEC = 7 * 24 * 60 * 60; // 7 days
/** Block further outbound calls at this consecutive unanswered count. */
export const BIC_UNANSWERED_BLOCK_AT = 2;
/** After this window, consecutive unanswered counter is treated as cooled down. */
export const BIC_UNANSWERED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildBicUnansweredKey(
  orgId: string,
  whatsappNumberId: string,
  contactPhone: string
): string {
  return `${BIC_UNANSWERED_PREFIX}${orgId}:${whatsappNumberId}:${normalizePhoneDigits(contactPhone)}`;
}

type BicUnansweredState = { count: number; lastAt: number };

async function readBicState(
  orgId: string,
  whatsappNumberId: string,
  contactPhone: string
): Promise<BicUnansweredState> {
  const redis = getRedis();
  const raw = await redis.get(buildBicUnansweredKey(orgId, whatsappNumberId, contactPhone));
  if (!raw) return { count: 0, lastAt: 0 };
  try {
    const parsed = JSON.parse(raw) as BicUnansweredState;
    if (typeof parsed?.count === 'number') {
      return { count: Math.max(0, parsed.count), lastAt: Number(parsed.lastAt) || 0 };
    }
  } catch {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return { count: n, lastAt: Date.now() };
  }
  return { count: 0, lastAt: 0 };
}

export async function getBicUnansweredCount(
  orgId: string,
  whatsappNumberId: string | undefined | null,
  contactPhone: string
): Promise<number> {
  if (!whatsappNumberId) return BIC_UNANSWERED_BLOCK_AT;
  try {
    const state = await readBicState(orgId, whatsappNumberId, contactPhone);
    if (state.count <= 0) return 0;
    // Time-based release: after cooldown, allow dialing again (counter soft-resets).
    if (
      state.count >= BIC_UNANSWERED_BLOCK_AT &&
      state.lastAt > 0 &&
      Date.now() - state.lastAt >= BIC_UNANSWERED_COOLDOWN_MS
    ) {
      await clearBicUnanswered(orgId, whatsappNumberId, contactPhone);
      return 0;
    }
    return state.count;
  } catch (err) {
    // Fail closed: without Redis we cannot track unanswered BIC quality — block dialing.
    log.warn('BIC unanswered count read failed — blocking outbound call', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return BIC_UNANSWERED_BLOCK_AT;
  }
}

/** Increment consecutive unanswered outbound BIC counter (TTL 7d). Returns new count. */
export async function incrBicUnanswered(
  orgId: string,
  whatsappNumberId: string,
  contactPhone: string
): Promise<number> {
  try {
    const redis = getRedis();
    const key = buildBicUnansweredKey(orgId, whatsappNumberId, contactPhone);
    const prev = await readBicState(orgId, whatsappNumberId, contactPhone);
    const next: BicUnansweredState = { count: prev.count + 1, lastAt: Date.now() };
    await redis.set(key, JSON.stringify(next), 'EX', BIC_UNANSWERED_TTL_SEC);
    return next.count;
  } catch (err) {
    log.warn('BIC unanswered incr failed', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/** Clear consecutive unanswered counter after a BIC call is answered. */
export async function clearBicUnanswered(
  orgId: string,
  whatsappNumberId: string | undefined | null,
  contactPhone: string
): Promise<void> {
  if (!whatsappNumberId) return;
  try {
    const redis = getRedis();
    await redis.del(buildBicUnansweredKey(orgId, whatsappNumberId, contactPhone));
  } catch (err) {
    log.warn('BIC unanswered clear failed', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Record an unanswered BUSINESS_INITIATED call for Meta quality cooldown.
 * No-op unless direction is BIC and the call was never answered.
 * Idempotent per call id so terminate route + Meta webhook do not double-count.
 */
export async function recordBicUnansweredIfNeeded(call: {
  id?: string;
  direction: string;
  answeredAt?: Date | null;
  organizationId: string;
  whatsappNumberId?: string | null;
  toPhone: string;
}): Promise<void> {
  if (call.direction !== 'BUSINESS_INITIATED') return;
  if (call.answeredAt) return;
  if (!call.whatsappNumberId) return;
  try {
    if (call.id) {
      const redis = getRedis();
      const once = await redis.set(
        `call:bic:unanswered:once:${call.id}`,
        '1',
        'EX',
        BIC_UNANSWERED_TTL_SEC,
        'NX'
      );
      if (once !== 'OK') return;
    }
  } catch (err) {
    log.warn('BIC unanswered once-guard failed — continuing to incr', {
      callId: call.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  await incrBicUnanswered(call.organizationId, call.whatsappNumberId, call.toPhone);
}
