import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { EventEmitter } from 'events';

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

vi.mock('../utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import prisma from '../config/database';
import { verifyAccessToken } from '../utils/jwt';
import { socketAuthMiddleware, startMembershipGuard } from './socket-auth';

const findUnique = vi.mocked(prisma.organizationUser.findUnique);
const verify = vi.mocked(verifyAccessToken);

function fakeSocket(token: unknown): Socket {
  return {
    handshake: { auth: { token } },
    data: {},
  } as unknown as Socket;
}

/** Build a fake socket with real EventEmitter behavior for the guard tests. */
function fakeGuardSocket(user?: { userId?: string; organizationId?: string }): Socket {
  const emitter = new EventEmitter();
  return {
    id: 'socket-test-1',
    data: { user },
    emit: vi.fn((event: string, ...args: unknown[]) => {
      emitter.emit(event, ...args);
      return true;
    }),
    disconnect: vi.fn(),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    once: emitter.once.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
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

describe('startMembershipGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    findUnique.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when socket has no user data', () => {
    const socket = fakeGuardSocket(undefined);
    startMembershipGuard(socket);
    vi.advanceTimersByTime(60_000);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('does nothing when user has no organizationId', () => {
    const socket = fakeGuardSocket({ userId: 'u1' });
    startMembershipGuard(socket);
    vi.advanceTimersByTime(60_000);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('skips periodic check for API key sockets', () => {
    const socket = fakeGuardSocket({ userId: 'api-key', organizationId: 'org-1' });
    startMembershipGuard(socket);
    vi.advanceTimersByTime(120_000);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('keeps socket alive when membership is still active', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1' } as never);
    const socket = fakeGuardSocket({ userId: 'u1', organizationId: 'org-1' });
    startMembershipGuard(socket);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('disconnects socket when membership is revoked', async () => {
    findUnique.mockResolvedValue(null);
    const socket = fakeGuardSocket({ userId: 'u1', organizationId: 'org-1' });
    startMembershipGuard(socket);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('session:revoked', { reason: 'membership_revoked' });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('handles org deleted (membership gone) the same as explicit removal', async () => {
    // Org deleted → cascade-deleted OrganizationUser → findUnique returns null
    findUnique.mockResolvedValue(null);
    const socket = fakeGuardSocket({ userId: 'u1', organizationId: 'deleted-org' });
    startMembershipGuard(socket);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('clears interval on socket disconnect', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1' } as never);
    const socket = fakeGuardSocket({ userId: 'u1', organizationId: 'org-1' });
    startMembershipGuard(socket);

    // Simulate socket disconnect after first check
    await vi.advanceTimersByTimeAsync(60_000);
    expect(findUnique).toHaveBeenCalledTimes(1);

    socket.emit('disconnect');
    findUnique.mockClear();

    // Another interval tick — should NOT trigger another query
    await vi.advanceTimersByTimeAsync(60_000);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('does not disconnect on transient DB errors', async () => {
    findUnique.mockRejectedValueOnce(new Error('connection refused'));
    findUnique.mockResolvedValueOnce({ id: 'mem-1' } as never);
    const socket = fakeGuardSocket({ userId: 'u1', organizationId: 'org-1' });
    startMembershipGuard(socket);

    // First tick — DB error
    await vi.advanceTimersByTimeAsync(60_000);
    expect(socket.disconnect).not.toHaveBeenCalled();

    // Second tick — DB recovers
    await vi.advanceTimersByTimeAsync(60_000);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('checks at 60-second intervals', async () => {
    findUnique.mockResolvedValue({ id: 'mem-1' } as never);
    const socket = fakeGuardSocket({ userId: 'u1', organizationId: 'org-1' });
    startMembershipGuard(socket);

    await vi.advanceTimersByTimeAsync(59_999);
    expect(findUnique).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(findUnique).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
