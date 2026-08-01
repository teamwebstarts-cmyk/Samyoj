import jwt from 'jsonwebtoken';
import { config } from '../config';

const ACCESS_ALGORITHMS: jwt.Algorithm[] = ['HS256'];
const REFRESH_ALGORITHMS: jwt.Algorithm[] = ['HS256'];

export interface JwtPayload {
  userId: string;
  email: string;
  organizationId?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret, {
    algorithms: ACCESS_ALGORITHMS,
  }) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.refreshSecret, {
    algorithms: REFRESH_ALGORITHMS,
  }) as JwtPayload;
}

export function parseExpiry(expiry: string): Date {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return new Date(Date.now() + value * multipliers[unit]);
}
