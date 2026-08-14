import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { signAccessToken, verifyAccessToken, verifyRefreshToken } from './jwt';

describe('JWT algorithm pinning', () => {
  it('accepts HS256 access tokens', () => {
    const token = signAccessToken({ userId: 'u1', email: 'a@b.c', organizationId: 'o1' });
    expect(verifyAccessToken(token)).toMatchObject({ userId: 'u1', email: 'a@b.c' });
  });

  it('rejects access tokens signed with a different HMAC algorithm', () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.c' }, config.jwt.secret, {
      algorithm: 'HS384',
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects refresh tokens signed with a different HMAC algorithm', () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.c' }, config.jwt.refreshSecret, {
      algorithm: 'HS384',
    });
    expect(() => verifyRefreshToken(token)).toThrow();
  });
});
