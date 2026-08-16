import type { Request } from 'express';
import prisma from '../../config/database';
import {
  hashPlatformToken,
  parseCookieHeader,
  PLATFORM_SESSION_COOKIE,
  randomOpaqueToken,
} from './security';

const AUTHENTICATED_SESSION_MS = 8 * 60 * 60 * 1000;
const MFA_ENROLLMENT_SESSION_MS = 10 * 60 * 1000;

export interface IssuedPlatformSession {
  id: string;
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
}

export async function createPlatformSession(
  operatorId: string,
  mfaVerified: boolean
): Promise<IssuedPlatformSession> {
  const sessionToken = randomOpaqueToken();
  const csrfToken = randomOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() +
      (mfaVerified ? AUTHENTICATED_SESSION_MS : MFA_ENROLLMENT_SESSION_MS)
  );

  const session = await prisma.platformSession.create({
    data: {
      operatorId,
      tokenHash: hashPlatformToken(sessionToken),
      csrfTokenHash: hashPlatformToken(csrfToken),
      mfaVerifiedAt: mfaVerified ? now : null,
      expiresAt,
    },
    select: { id: true },
  });

  return {
    id: session.id,
    sessionToken,
    csrfToken,
    expiresAt,
  };
}

export async function rotatePlatformCsrf(
  sessionId: string,
  expiresAt: Date
): Promise<{ csrfToken: string; expiresAt: Date }> {
  const csrfToken = randomOpaqueToken();
  await prisma.platformSession.update({
    where: { id: sessionId },
    data: { csrfTokenHash: hashPlatformToken(csrfToken) },
  });
  return { csrfToken, expiresAt };
}

export async function revokePlatformSession(sessionId: string): Promise<void> {
  await prisma.platformSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function platformSessionToken(req: Request): string | null {
  return parseCookieHeader(req.headers.cookie)[PLATFORM_SESSION_COOKIE] ?? null;
}

export function authenticatedPlatformSessionExpiry(from = new Date()): Date {
  return new Date(from.getTime() + AUTHENTICATED_SESSION_MS);
}
