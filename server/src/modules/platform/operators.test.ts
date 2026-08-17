import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    platformSession: { findMany: vi.fn() },
  },
}));

import prisma from '../../config/database';
import { listPlatformSessions } from './operators';

const findMany = vi.mocked(prisma.platformSession.findMany);

describe('listPlatformSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks current only for the current session id, not every session of the operator', async () => {
    findMany.mockResolvedValue([
      {
        id: 'session-this',
        operatorId: 'ops-1',
        mfaVerifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        lastSeenAt: new Date(),
        createdAt: new Date(),
        operator: { email: 'ops@example.com', role: 'SUPER_ADMIN' },
      },
      {
        id: 'session-other-browser',
        operatorId: 'ops-1',
        mfaVerifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        lastSeenAt: new Date(),
        createdAt: new Date(),
        operator: { email: 'ops@example.com', role: 'SUPER_ADMIN' },
      },
    ] as never);

    const sessions = await listPlatformSessions({
      actorId: 'ops-1',
      actorRole: 'SUPER_ADMIN',
      currentSessionId: 'session-this',
    });

    expect(sessions.find((row) => row.id === 'session-this')?.current).toBe(true);
    expect(sessions.find((row) => row.id === 'session-other-browser')?.current).toBe(false);
  });
});
