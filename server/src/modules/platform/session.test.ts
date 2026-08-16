import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    platformSession: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import { createPlatformSession } from './session';

const createSession = vi.mocked(prisma.platformSession.create);

describe('platform session issuance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSession.mockResolvedValue({ id: 'session-1' } as never);
  });

  it('persists only SHA-256 hashes of opaque session and CSRF tokens', async () => {
    const issued = await createPlatformSession('operator-1', true);
    const data = createSession.mock.calls[0][0].data;

    expect(issued.sessionToken).toHaveLength(43);
    expect(issued.csrfToken).toHaveLength(43);
    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.csrfTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.tokenHash).not.toBe(issued.sessionToken);
    expect(data.csrfTokenHash).not.toBe(issued.csrfToken);
    expect(data.mfaVerifiedAt).toBeInstanceOf(Date);
  });
});
