import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import prisma from '../../config/database';
import { config } from '../../config';
import { signAccessToken, signRefreshToken, parseExpiry, type JwtPayload } from '../../utils/jwt';
import getRedis from '../../config/redis';
import logger from '../../utils/logger';
import { newCsrfToken, setTenantAuthCookies } from './cookies';

export function clientMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent']?.slice(0, 255) ?? null,
    ipAddress:
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null,
  };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function revokeRefreshSessionsForUser(
  userId: string,
  db: { refreshToken: { updateMany: typeof prisma.refreshToken.updateMany } } = prisma
) {
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function createSession(payload: JwtPayload, req: Request) {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const meta = clientMeta(req);

  await prisma.refreshToken.create({
    data: {
      token: hashRefreshToken(refreshToken),
      userId: payload.userId,
      organizationId: payload.organizationId ?? null,
      expiresAt: parseExpiry(config.jwt.refreshExpiresIn),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  return { accessToken, refreshToken };
}

/** Create a refresh session and set HttpOnly auth cookies on the response. */
export async function issueTenantSession(res: Response, payload: JwtPayload, req: Request) {
  const tokens = await createSession(payload, req);
  setTenantAuthCookies(res, tokens.accessToken, tokens.refreshToken, newCsrfToken());
  return tokens;
}

/** Rotate refresh session and refresh HttpOnly auth cookies. */
export async function rotateTenantSession(
  oldRefreshToken: string,
  req: Request,
  res: Response
) {
  const rotated = await rotateRefreshSession(oldRefreshToken, req);
  if (!rotated) return null;
  setTenantAuthCookies(res, rotated.accessToken, rotated.refreshToken, newCsrfToken());
  return rotated;
}

/** Rotate refresh token; revoke old; detect reuse by revoked token. */
export async function rotateRefreshSession(oldRefreshToken: string, req: Request) {
  const hashedToken = hashRefreshToken(oldRefreshToken);
  let stored = await prisma.refreshToken.findUnique({
    where: { token: hashedToken },
    include: { user: { include: { organizations: { take: 1 } } } },
  });
  let legacyPlaintext = false;
  if (!stored) {
    // One-time compatibility path for sessions created before hash-at-rest.
    stored = await prisma.refreshToken.findUnique({
      where: { token: oldRefreshToken },
      include: { user: { include: { organizations: { take: 1 } } } },
    });
    legacyPlaintext = Boolean(stored);
  }

  if (!stored) {
    return null;
  }

  if (stored.revokedAt) {
    // Possible theft — revoke all sessions for this user
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  if (stored.expiresAt < new Date()) {
    return null;
  }

  const orgMembership = stored.user.organizations[0];
  const payload: JwtPayload = {
    userId: stored.user.id,
    email: stored.user.email,
    organizationId: stored.organizationId ?? orgMembership?.organizationId,
  };

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: {
      ...(legacyPlaintext ? { token: hashedToken } : {}),
      revokedAt: new Date(),
    },
  });

  return createSession(payload, req);
}

const OAUTH_CODE_PREFIX = 'oauth:exchange:';
const OAUTH_STATE_PREFIX = 'oauth:state:';

export async function storeOAuthState(state: string, payload: Record<string, string>) {
  try {
    const redis = getRedis();
    await redis.set(`${OAUTH_STATE_PREFIX}${state}`, JSON.stringify(payload), 'EX', 600);
  } catch (err) {
    logger.warn('Redis unavailable for OAuth state — using memory fallback', {
      source: 'auth',
      error: err instanceof Error ? err.message : String(err),
    });
    memoryState.set(state, { payload, expiresAt: Date.now() + 600_000 });
  }
}

export async function consumeOAuthState(state: string): Promise<Record<string, string> | null> {
  try {
    const redis = getRedis();
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const raw = await redis.get(key);
    if (raw) await redis.del(key);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    const entry = memoryState.get(state);
    memoryState.delete(state);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.payload;
  }
}

const memoryState = new Map<string, { payload: Record<string, string>; expiresAt: number }>();
const memoryCodes = new Map<string, { tokens: SessionTokens; expiresAt: number }>();

export type SessionTokens = { accessToken: string; refreshToken: string };

export async function issueOAuthExchangeCode(tokens: SessionTokens): Promise<string> {
  const code = randomBytes(32).toString('hex');
  try {
    const redis = getRedis();
    await redis.set(`${OAUTH_CODE_PREFIX}${code}`, JSON.stringify(tokens), 'EX', 120);
  } catch {
    memoryCodes.set(code, { tokens, expiresAt: Date.now() + 120_000 });
  }
  return code;
}

export async function consumeOAuthExchangeCode(code: string): Promise<SessionTokens | null> {
  try {
    const redis = getRedis();
    const key = `${OAUTH_CODE_PREFIX}${code}`;
    const raw = await redis.get(key);
    if (raw) await redis.del(key);
    return raw ? (JSON.parse(raw) as SessionTokens) : null;
  } catch {
    const entry = memoryCodes.get(code);
    memoryCodes.delete(code);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.tokens;
  }
}

export function newOAuthState(): string {
  return randomBytes(24).toString('hex');
}
