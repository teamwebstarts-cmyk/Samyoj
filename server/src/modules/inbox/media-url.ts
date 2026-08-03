import crypto from 'crypto';
import { config } from '../../config';

/** How long a signed media URL stays valid (also used as the blob cache lifetime). */
export const MEDIA_URL_TTL_SECONDS = 60 * 60;

function sign(messageId: string, exp: number): string {
  return crypto
    .createHmac('sha256', config.jwt.secret)
    .update(`${messageId}.${exp}`)
    .digest('hex');
}

/** Build the token-scoped proxy path a client can cache until `expiresAt`. */
export function buildSignedMediaPath(messageId: string): { path: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + MEDIA_URL_TTL_SECONDS;
  return {
    path: `/api/inbox/messages/${messageId}/media?exp=${exp}&sig=${sign(messageId, exp)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyMediaSignature(messageId: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return false;
  const expected = sign(messageId, exp);
  const given = Buffer.from(sig, 'utf8');
  const want = Buffer.from(expected, 'utf8');
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}
