import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import { INSTAGRAM_PROCESSING_TIMEOUT_MS, recoverStaleInstagramPosts } from './posts.recovery';

vi.mock('../../config/database', () => ({
  default: {
    instagramPost: { updateMany: vi.fn() },
  },
}));

describe('Instagram post recovery', () => {
  beforeEach(() => {
    vi.mocked(prisma.instagramPost.updateMany).mockReset();
  });

  it('marks processing rows older than the timeout as failed', async () => {
    vi.mocked(prisma.instagramPost.updateMany).mockResolvedValue({ count: 2 } as never);
    const now = new Date('2026-09-29T12:00:00.000Z');

    await expect(recoverStaleInstagramPosts(now)).resolves.toBe(2);
    expect(prisma.instagramPost.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'PROCESSING',
        updatedAt: {
          lt: new Date(now.getTime() - INSTAGRAM_PROCESSING_TIMEOUT_MS),
        },
      },
      data: {
        status: 'FAILED',
        lastError: 'Publishing timed out. Try publishing again.',
      },
    });
  });
});
