import { randomBytes } from 'crypto';
import getRedis from '../../config/redis';

const CONNECT_PENDING_PREFIX = 'whatsapp:connect:pending:';
const CONNECT_PENDING_TTL_SECONDS = 15 * 60;

const consumeScript = `
  local value = redis.call('get', KEYS[1])
  if not value then return nil end
  local session = cjson.decode(value)
  if session.organizationId ~= ARGV[1] or session.userId ~= ARGV[2] then
    return nil
  end
  redis.call('del', KEYS[1])
  return value
`;

interface StoredWhatsappConnectPending {
  organizationId: string;
  userId: string;
  accessToken: string;
  connectMode?: 'standard' | 'coexistence';
}

export interface WhatsappConnectPendingSession {
  organizationId: string;
  userId: string;
  accessToken: string;
  connectMode?: 'standard' | 'coexistence';
}

const memorySessions = new Map<
  string,
  StoredWhatsappConnectPending & { expiresAt: number }
>();

function keyFor(token: string): string {
  return `${CONNECT_PENDING_PREFIX}${token}`;
}

/**
 * Issue an opaque browser token while keeping the Meta access token server-side.
 * Redis is the primary store; the process-local fallback preserves the same
 * server-side boundary when Redis is temporarily unavailable.
 */
export async function createConnectPending(payload: {
  organizationId: string;
  userId: string;
  accessToken: string;
  connectMode?: 'standard' | 'coexistence';
}): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const session: StoredWhatsappConnectPending = {
    organizationId: payload.organizationId,
    userId: payload.userId,
    accessToken: payload.accessToken,
    connectMode: payload.connectMode,
  };

  try {
    const redis = getRedis();
    await redis.set(
      keyFor(token),
      JSON.stringify(session),
      'EX',
      CONNECT_PENDING_TTL_SECONDS,
      'NX'
    );
  } catch {
    memorySessions.set(token, {
      ...session,
      expiresAt: Date.now() + CONNECT_PENDING_TTL_SECONDS * 1000,
    });
  }

  return token;
}

/**
 * Atomically consume a pending session for its owning user and organization.
 * A mismatched owner does not consume the session.
 */
export async function consumeConnectPending(
  token: string,
  owner: { organizationId: string; userId: string }
): Promise<WhatsappConnectPendingSession | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  try {
    const redis = getRedis();
    const raw = await redis.eval(
      consumeScript,
      1,
      keyFor(token),
      owner.organizationId,
      owner.userId
    );
    if (!raw || typeof raw !== 'string') return null;
    return JSON.parse(raw) as WhatsappConnectPendingSession;
  } catch {
    const session = memorySessions.get(token);
    if (!session) return null;
    memorySessions.delete(token);
    if (session.expiresAt < Date.now()) return null;
    if (
      session.organizationId !== owner.organizationId ||
      session.userId !== owner.userId
    ) {
      memorySessions.set(token, session);
      return null;
    }
    return session;
  }
}
