import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import {
  getInstagramCommentRetentionDays,
  instagramCommentRetentionCutoff,
  purgeExpiredInstagramComments,
} from './comment-retention';
import { instagramCommentListWhere } from './comment-ingest';

vi.mock('../../config/database', () => ({
  default: {
    instagramComment: { deleteMany: vi.fn() },
  },
}));

const commentMock = vi.mocked(prisma.instagramComment);

describe('instagram comment retention', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    commentMock.deleteMany.mockReset();
  });

  it('defaults to the seven-day private-reply window', () => {
    expect(getInstagramCommentRetentionDays()).toBe(7);
    const now = new Date('2026-09-28T12:00:00.000Z');
    const cutoff = instagramCommentRetentionCutoff(now);
    expect(cutoff.toISOString()).toBe('2026-09-21T12:00:00.000Z');
  });

  it('lists only comments inside the retention window', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    const where = instagramCommentListWhere({
      organizationId: 'org',
      channelId: 'ch',
      now,
    });
    expect(where.commentedAt).toEqual({ gte: instagramCommentRetentionCutoff(now) });
  });

  it('purges rows older than cutoff', async () => {
    commentMock.deleteMany.mockResolvedValue({ count: 3 } as never);
    const now = new Date('2026-09-28T12:00:00.000Z');
    const result = await purgeExpiredInstagramComments({ now });
    expect(result.deleted).toBe(3);
    expect(commentMock.deleteMany).toHaveBeenCalledWith({
      where: { commentedAt: { lt: instagramCommentRetentionCutoff(now) } },
    });
  });
});
