import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../config/database', () => ({
  default: {
    organizationUser: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../config/database';
import { requireOrg } from './auth';
import { AppError } from '../utils/response';

const findUnique = vi.mocked(prisma.organizationUser.findUnique);

function invoke(req: Partial<Request>) {
  return new Promise<unknown>((resolve) => {
    const next: NextFunction = (err?: unknown) => resolve(err);
    void requireOrg(req as Request, {} as Response, next);
  });
}

describe('requireOrg membership check', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('rejects requests without an organization claim', async () => {
    const err = await invoke({ user: { userId: 'u1', email: 'a@b.c' } });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('allows API keys without an OrganizationUser row', async () => {
    const err = await invoke({
      user: { userId: 'api-key', email: 'api@integration', organizationId: 'org-1' },
    });
    expect(err).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects JWT org claims when membership is gone', async () => {
    findUnique.mockResolvedValue(null);
    const err = await invoke({
      user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' },
    });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).message).toMatch(/not a member/i);
  });

  it('allows active OrganizationUser membership', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1' } as never);
    const err = await invoke({
      user: { userId: 'u1', email: 'a@b.c', organizationId: 'org-1' },
    });
    expect(err).toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: 'org-1', userId: 'u1' } },
      select: { id: true },
    });
  });
});
