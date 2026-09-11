import crypto from 'crypto';
import { config } from '../../config';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function mediaSecret() {
  const secret = config.jwt.secret;
  if (!secret) {
    throw new Error('JWT_SECRET required to sign media URLs');
  }
  return secret;
}

function hmac(relativePath: string, exp: number) {
  return crypto.createHmac('sha256', mediaSecret()).update(`${relativePath}:${exp}`).digest('hex');
}

export function signPublicMediaQuery(relativePath: string, nowMs = Date.now()) {
  const exp = Math.floor(nowMs / 1000) + DEFAULT_TTL_SECONDS;
  return { exp, sig: hmac(relativePath, exp) };
}

export function isValidPublicMediaSig(relativePath: string, expRaw: unknown, sigRaw: unknown) {
  const exp = Number(expRaw);
  const sig = typeof sigRaw === 'string' ? sigRaw : '';
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  if (!/^[a-f0-9]{64}$/i.test(sig)) return false;
  const expected = hmac(relativePath, exp);
  const left = Buffer.from(sig.toLowerCase());
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
