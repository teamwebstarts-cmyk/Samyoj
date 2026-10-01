import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../config/redis', () => ({
  default: () => mockRedis,
}));

describe('withInstagramCommentSyncLock', () => {
  beforeEach(() => {
    mockRedis.set.mockReset();
    mockRedis.get.mockReset();
    mockRedis.del.mockReset();
  });

  it('runs the work when Redis NX is acquired', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue('token');
    const { withInstagramCommentSyncLock } = await import('./comment-sync');
    const result = await withInstagramCommentSyncLock('ch_1', async () => 'done');
    expect(result).toBe('done');
    expect(mockRedis.set).toHaveBeenCalledWith(
      'ig-comment-sync:ch_1',
      expect.any(String),
      'EX',
      120,
      'NX'
    );
  });

  it('returns busy when another sync already holds the lock', async () => {
    mockRedis.set.mockResolvedValue(null);
    const { withInstagramCommentSyncLock } = await import('./comment-sync');
    const fn = vi.fn(async () => 'done');
    const result = await withInstagramCommentSyncLock('ch_1', fn);
    expect(result).toBe('busy');
    expect(fn).not.toHaveBeenCalled();
  });
});
