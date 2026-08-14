import { beforeEach, describe, expect, it, vi } from 'vitest';
import getRedis from '../../config/redis';
import { consumeConnectPending, createConnectPending } from './connect-pending';

vi.mock('../../config/redis', () => ({
  default: vi.fn(),
}));

const redis = {
  set: vi.fn(),
  eval: vi.fn(),
};

const getRedisMock = vi.mocked(getRedis);

beforeEach(() => {
  vi.clearAllMocks();
  getRedisMock.mockReturnValue(redis as never);
});

describe('WhatsApp connect pending sessions', () => {
  it('returns an opaque token and keeps the Meta secret in the server-side value', async () => {
    const accessToken = 'EAAB-server-only-meta-access-token';

    const token = await createConnectPending({
      organizationId: 'org-1',
      userId: 'user-1',
      accessToken,
    });

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toContain(accessToken);
    expect(token.split('.')).toHaveLength(1);

    const stored = JSON.parse(redis.set.mock.calls[0][1] as string) as Record<string, string>;
    expect(stored).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      accessToken,
    });
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('whatsapp:connect:pending:'),
      expect.any(String),
      'EX',
      900,
      'NX'
    );
  });

  it('consumes a pending session only once', async () => {
    const session = {
      organizationId: 'org-1',
      userId: 'user-1',
      accessToken: 'EAAB-server-only-meta-access-token',
    };
    const token = 'a'.repeat(43);
    redis.eval
      .mockResolvedValueOnce(JSON.stringify(session))
      .mockResolvedValueOnce(null);

    await expect(
      consumeConnectPending(token, { organizationId: 'org-1', userId: 'user-1' })
    ).resolves.toEqual(session);
    await expect(
      consumeConnectPending(token, { organizationId: 'org-1', userId: 'user-1' })
    ).resolves.toBeNull();
    expect(redis.eval).toHaveBeenCalledTimes(2);
  });

  it('does not consume a session for a different organization or user', async () => {
    const session = {
      organizationId: 'org-1',
      userId: 'user-1',
      accessToken: 'EAAB-server-only-meta-access-token',
    };
    const token = 'b'.repeat(43);
    redis.eval
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify(session));

    await expect(
      consumeConnectPending(token, { organizationId: 'org-2', userId: 'user-2' })
    ).resolves.toBeNull();
    await expect(
      consumeConnectPending(token, { organizationId: 'org-1', userId: 'user-1' })
    ).resolves.toEqual(session);

    expect(redis.eval).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('session.organizationId ~= ARGV[1]'),
      1,
      expect.stringContaining(token),
      'org-2',
      'user-2'
    );
  });
});
