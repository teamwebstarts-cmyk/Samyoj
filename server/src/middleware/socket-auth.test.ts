import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';

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

vi.mock('../errors', () => ({
  logError: vi.fn(),
}));

import prisma from '../config/database';
import { verifyAccessToken } from '../utils/jwt';
import { socketAuthMiddleware } from './socket-auth';

const findUnique = vi.mocked(prisma.organizationUser.findUnique);
const verify = vi.mocked(verifyAccessToken);

function fakeSocket(token: unknown): Socket {
  return {
    handshake: { auth: { token } },
    data: {},
  } as unknown as Socket;
}

function invoke(socket: Socket) {
  return new Promise<Error | undefined>((resolve) => {
    void socketAuthMiddleware(socket, (err?: Error) => resolve(err));
  });
}

describe('socketAuthMiddleware membership check', () => {
  beforeEach(() => {
    findUnique.mockReset();
    verify.mockReset();
  });

  it('rejects a missing token', async () => {
    const err = await invoke(fakeSocket(undefined));
    expect(err?.message).toMatch(/authentication required/i);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const err = await invoke(fakeSocket('bad'));
    expect(err?.message).toBe('Invalid token');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('allows a JWT without an organization claim (no org room)', async () => {
    verify.mockReturnValue({ userId: 'u1', email: 'a@b.c' });
    const socket = fakeSocket('ok');
    const err = await invoke(socket);
    expect(err).toBeUndefined();
    expect(socket.data.user).toEqual({ userId: 'u1', email: 'a@b.c' });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('allows API keys without an OrganizationUser row', async () => {
    verify.mockReturnValue({
      userId: 'api-key',
      email: 'api@integration',
      organizationId: 'org-1',
    });
    const err = await invoke(fakeSocket('ok'));
    expect(err).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects JWT org claims when membership is gone', async () => {
    verify.mockReturnValue({ userId: 'u1', email: 'a@b.c', organizationId: 'org-1' });
    findUnique.mockResolvedValue(null);
    const socket = fakeSocket('ok');
    const err = await invoke(socket);
    expect(err?.message).toMatch(/not a member/i);
    expect(socket.data.user).toBeUndefined();
    expect(findUnique).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: 'org-1', userId: 'u1' } },
      select: { id: true },
    });
  });

  it('allows active OrganizationUser membership', async () => {
    verify.mockReturnValue({ userId: 'u1', email: 'a@b.c', organizationId: 'org-1' });
    findUnique.mockResolvedValue({ id: 'mem-1' } as never);
    const socket = fakeSocket('ok');
    const err = await invoke(socket);
    expect(err).toBeUndefined();
    expect(socket.data.user.organizationId).toBe('org-1');
  });
});
