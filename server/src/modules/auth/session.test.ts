import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';

vi.mock('../../config/database', () => ({
  default: {
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../../config', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret-do-not-use-in-production-ok',
      refreshSecret: 'test-refresh-secret-do-not-use-in-prod-ok',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    },
  },
}));

vi.mock('../../config/redis', () => ({
  default: vi.fn(),
}));

import prisma from '../../config/database';
import { createSession, rotateRefreshSession, revokeRefreshSessionsForUser, clientMeta } from './session';

const refreshTokenCreate = vi.mocked(prisma.refreshToken.create);
const refreshTokenFindUnique = vi.mocked(prisma.refreshToken.findUnique);
const refreshTokenUpdate = vi.mocked(prisma.refreshToken.update);
const refreshTokenUpdateMany = vi.mocked(prisma.refreshToken.updateMany);

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { 'user-agent': 'TestAgent/1.0', 'x-forwarded-for': '1.2.3.4' },
    ip: '127.0.0.1',
    ...overrides,
  } as Request;
}

describe('clientMeta', () => {
  it('extracts user-agent and IP from x-forwarded-for', () => {
    const meta = clientMeta(mockReq());
    expect(meta.userAgent).toBe('TestAgent/1.0');
    expect(meta.ipAddress).toBe('1.2.3.4');
  });

  it('falls back to req.ip when x-forwarded-for is absent', () => {
    const meta = clientMeta(mockReq({ headers: { 'user-agent': 'Bot' } } as Partial<Request>));
    expect(meta.ipAddress).toBe('127.0.0.1');
  });

  it('truncates user-agent to 255 characters', () => {
    const longUA = 'A'.repeat(300);
    const meta = clientMeta(mockReq({ headers: { 'user-agent': longUA } } as Partial<Request>));
    expect(meta.userAgent).toHaveLength(255);
  });

  it('handles missing user-agent', () => {
    const meta = clientMeta(mockReq({ headers: {} } as Partial<Request>));
    expect(meta.userAgent).toBeNull();
  });
});

describe('createSession', () => {
  beforeEach(() => {
    refreshTokenCreate.mockReset();
    refreshTokenCreate.mockResolvedValue({} as never);
  });

  it('returns access and refresh tokens', async () => {
    const result = await createSession(
      { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' },
      mockReq()
    );
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(typeof result.accessToken).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
  });

  it('persists the refresh token in the database', async () => {
    await createSession(
      { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' },
      mockReq()
    );
    expect(refreshTokenCreate).toHaveBeenCalledTimes(1);
    const call = refreshTokenCreate.mock.calls[0][0];
    expect(call.data.userId).toBe('u1');
    expect(call.data.token).toBeTruthy();
    expect(call.data.userAgent).toBe('TestAgent/1.0');
    expect(call.data.ipAddress).toBe('1.2.3.4');
  });
});

describe('rotateRefreshSession', () => {
  beforeEach(() => {
    refreshTokenFindUnique.mockReset();
    refreshTokenUpdate.mockReset();
    refreshTokenUpdateMany.mockReset();
    refreshTokenCreate.mockReset();
    refreshTokenCreate.mockResolvedValue({} as never);
  });

  it('returns null for unknown token', async () => {
    refreshTokenFindUnique.mockResolvedValue(null);
    const result = await rotateRefreshSession('unknown-token', mockReq());
    expect(result).toBeNull();
  });

  it('returns null and revokes ALL user sessions when a revoked token is reused (theft detection)', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'rt-1',
      token: 'stolen-token',
      userId: 'u1',
      revokedAt: new Date('2026-01-01'),
      expiresAt: new Date('2099-01-01'),
      user: { id: 'u1', email: 'a@b.c', organizations: [{ organizationId: 'org-1' }] },
    } as never);

    const result = await rotateRefreshSession('stolen-token', mockReq());
    expect(result).toBeNull();
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('returns null for expired token', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'rt-1',
      token: 'expired-token',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date('2020-01-01'),
      user: { id: 'u1', email: 'a@b.c', organizations: [{ organizationId: 'org-1' }] },
    } as never);

    const result = await rotateRefreshSession('expired-token', mockReq());
    expect(result).toBeNull();
    expect(refreshTokenUpdate).not.toHaveBeenCalled();
  });

  it('revokes old token and creates new session for valid token', async () => {
    refreshTokenFindUnique.mockResolvedValue({
      id: 'rt-1',
      token: 'valid-token',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date('2099-01-01'),
      user: { id: 'u1', email: 'a@b.c', organizations: [{ organizationId: 'org-1' }] },
    } as never);

    const result = await rotateRefreshSession('valid-token', mockReq());
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBeTruthy();
    expect(result!.refreshToken).toBeTruthy();
    expect(result!.refreshToken).not.toBe('valid-token');

    expect(refreshTokenUpdate).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(refreshTokenCreate).toHaveBeenCalledTimes(1);
  });
});

describe('revokeRefreshSessionsForUser', () => {
  beforeEach(() => {
    refreshTokenUpdateMany.mockReset();
  });

  it('revokes all active sessions for a user', async () => {
    await revokeRefreshSessionsForUser('u1');
    expect(refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
