import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../config/database', () => ({
  default: {
    organizationUser: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../utils/jwt', () => ({
  verifyAccessToken: vi.fn(),
}));

import prisma from '../config/database';
import { verifyAccessToken } from '../utils/jwt';
import { authenticate, loadOrgRole, requireOrgRole, hasActiveOrgMembership, requireOrg, requireAdminOnMutation } from './auth';
import { AppError } from '../utils/response';

const findUnique = vi.mocked(prisma.organizationUser.findUnique);
const mockVerify = vi.mocked(verifyAccessToken);

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as Request;
}

function mockRes(): Response {
  return {} as Response;
}

function invokeAuth(req: Partial<Request>) {
  return new Promise<unknown>((resolve) => {
    const next: NextFunction = (err?: unknown) => resolve(err);
    void authenticate(req as Request, mockRes(), next);
  });
}

function invokeLoadOrgRole(req: Partial<Request>) {
  return new Promise<unknown>((resolve) => {
    const next: NextFunction = (err?: unknown) => resolve(err);
    void loadOrgRole(req as Request, mockRes(), next);
  });
}

function invokeRequireOrg(req: Partial<Request>) {
  return new Promise<unknown>((resolve) => {
    const next: NextFunction = (err?: unknown) => resolve(err);
    void requireOrg(req as Request, mockRes(), next);
  });
}

function invokeRequireOrgRole(...roles: Array<'ADMIN' | 'OWNER' | 'AGENT'>) {
  return (req: Partial<Request>) =>
    new Promise<unknown>((resolve) => {
      const gate = requireOrgRole(...roles);
      const next: NextFunction = (err?: unknown) => resolve(err);
      gate(req as Request, mockRes(), next);
    });
}

describe('authenticate middleware', () => {
  beforeEach(() => {
    mockVerify.mockReset();
  });

  it('rejects requests without Authorization header or access cookie', async () => {
    const err = await invokeAuth(mockReq({}));
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects requests with non-Bearer auth', async () => {
    const err = await invokeAuth(mockReq({ headers: { authorization: 'Basic abc123' } }));
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it('rejects when verifyAccessToken throws (expired token)', async () => {
    mockVerify.mockImplementation(() => { throw new Error('jwt expired'); });
    const err = await invokeAuth(mockReq({ headers: { authorization: 'Bearer expired.token.here' } }));
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
    expect((err as AppError).message).toMatch(/invalid or expired/i);
  });

  it('rejects malformed tokens', async () => {
    mockVerify.mockImplementation(() => { throw new Error('malformed token'); });
    const err = await invokeAuth(mockReq({ headers: { authorization: 'Bearer bad.token' } }));
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(401);
    expect((err as AppError).message).toMatch(/invalid or expired/i);
  });

  it('sets req.user and calls next on valid token', async () => {
    const payload = { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' };
    mockVerify.mockReturnValue(payload);
    const req = mockReq({ headers: { authorization: 'Bearer valid.token.here' } });
    const err = await new Promise<unknown>((resolve) => {
      const next: NextFunction = (e?: unknown) => resolve(e);
      authenticate(req, mockRes(), next);
    });
    expect(req.user).toEqual(payload);
    expect(err).toBeUndefined();
  });

  it('sets req.user from samyoj_access cookie when Authorization is absent', async () => {
    const payload = { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' };
    mockVerify.mockReturnValue(payload);
    const req = mockReq({ headers: { cookie: 'samyoj_access=cookie.jwt.token' } });
    const err = await new Promise<unknown>((resolve) => {
      const next: NextFunction = (e?: unknown) => resolve(e);
      authenticate(req, mockRes(), next);
    });
    expect(req.user).toEqual(payload);
    expect(err).toBeUndefined();
    expect(mockVerify).toHaveBeenCalledWith('cookie.jwt.token');
  });

  it('prefers Authorization Bearer over access cookie', async () => {
    const payload = { userId: 'u1', email: 'a@b.c' };
    mockVerify.mockReturnValue(payload);
    await invokeAuth(mockReq({
      headers: {
        authorization: 'Bearer header.jwt.token',
        cookie: 'samyoj_access=cookie.jwt.token',
      },
    }));
    expect(mockVerify).toHaveBeenCalledWith('header.jwt.token');
  });
});

describe('loadOrgRole middleware', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('rejects when no organizationId in JWT', async () => {
    const err = await invokeLoadOrgRole({ user: { userId: 'u1', email: 'a@b.c' } });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects when user is not a member', async () => {
    findUnique.mockResolvedValue(null);
    const err = await invokeLoadOrgRole({ user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' } });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).message).toMatch(/not a member/i);
  });

  it('sets req.orgRole for active members', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1', role: 'ADMIN' } as never);
    const req = mockReq({ user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' } });
    const err = await new Promise<unknown>((resolve) => {
      const next: NextFunction = (e?: unknown) => resolve(e);
      void loadOrgRole(req, mockRes(), next);
    });
    expect(req.orgRole).toBe('ADMIN');
    expect(err).toBeUndefined();
  });

  it('queries with correct compound key', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1', role: 'OWNER' } as never);
    await invokeLoadOrgRole({ user: { userId: 'u99', email: 'x@y.z', organizationId: 'org-42' } });
    expect(findUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: 'org-42', userId: 'u99' } },
    });
  });

  it('api-key is not an org role', async () => {
    const err = await invokeLoadOrgRole({
      user: { userId: 'api-key', email: 'api@integration', organizationId: 'org-1' },
    });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('requireOrgRole middleware', () => {
  it('rejects when orgRole is not set', async () => {
    const err = await invokeRequireOrgRole('ADMIN', 'OWNER')({
      user: { userId: 'u1', email: 'a@b.c' },
    });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  it('rejects when orgRole does not match', async () => {
    const err = await invokeRequireOrgRole('OWNER')({
      user: { userId: 'u1', email: 'a@b.c' },
      orgRole: 'ADMIN',
    });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  it('allows when orgRole matches one of the required roles', async () => {
    const err = await invokeRequireOrgRole('ADMIN', 'OWNER')({
      user: { userId: 'u1', email: 'a@b.c' },
      orgRole: 'ADMIN',
    });
    expect(err).toBeUndefined();
  });

  it('allows when orgRole matches the single required role', async () => {
    const err = await invokeRequireOrgRole('OWNER')({
      user: { userId: 'u1', email: 'a@b.c' },
      orgRole: 'OWNER',
    });
    expect(err).toBeUndefined();
  });
});

describe('requireAdminOnMutation', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  function invoke(req: Partial<Request>) {
    return new Promise<unknown>((resolve) => {
      const next: NextFunction = (err?: unknown) => resolve(err);
      requireAdminOnMutation(req as Request, mockRes(), next);
    });
  }

  it('lets GET through without loading a role', async () => {
    const err = await invoke({ method: 'GET', user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' } });
    expect(err).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects AGENT POST', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1', role: 'AGENT' } as never);
    const err = await invoke({
      method: 'POST',
      user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' },
    });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
  });

  it('allows ADMIN POST', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1', role: 'ADMIN' } as never);
    const err = await invoke({
      method: 'POST',
      user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' },
    });
    expect(err).toBeUndefined();
  });

  it('rejects api-key POST', async () => {
    const err = await invoke({
      method: 'POST',
      user: { userId: 'api-key', email: 'api@integration', organizationId: 'org-1' },
    });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe('hasActiveOrgMembership', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('returns true immediately for API key userId without querying DB', async () => {
    const result = await hasActiveOrgMembership('api-key', 'org-1');
    expect(result).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns true when membership row exists', async () => {
    findUnique.mockResolvedValue({ id: 'm1' } as never);
    const result = await hasActiveOrgMembership('u1', 'org-1');
    expect(result).toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: 'org-1', userId: 'u1' } },
      select: { id: true },
    });
  });

  it('returns false when membership row does not exist', async () => {
    findUnique.mockResolvedValue(null);
    const result = await hasActiveOrgMembership('u1', 'org-1');
    expect(result).toBe(false);
  });
});

describe('requireOrg middleware', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('rejects requests without an organization claim', async () => {
    const err = await invokeRequireOrg({ user: { userId: 'u1', email: 'a@b.c' } });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('allows API keys without an OrganizationUser row', async () => {
    const err = await invokeRequireOrg({
      user: { userId: 'api-key', email: 'api@integration', organizationId: 'org-1' },
    });
    expect(err).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects JWT org claims when membership is gone', async () => {
    findUnique.mockResolvedValue(null);
    const err = await invokeRequireOrg({
      user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' },
    });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).message).toMatch(/not a member/i);
  });

  it('allows active OrganizationUser membership', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1' } as never);
    const err = await invokeRequireOrg({
      user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' },
    });
    expect(err).toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: 'org-1', userId: 'u1' } },
      select: { id: true, mustResetPassword: true },
    });
  });
});
