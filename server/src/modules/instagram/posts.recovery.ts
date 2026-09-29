import prisma from '../../config/database';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('instagram-post-recovery');
export const INSTAGRAM_PROCESSING_TIMEOUT_MS = 30 * 60 * 1000;

export async function recoverStaleInstagramPosts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - INSTAGRAM_PROCESSING_TIMEOUT_MS);
  const result = await prisma.instagramPost.updateMany({
    where: { status: 'PROCESSING', updatedAt: { lt: cutoff } },
    data: {
      status: 'FAILED',
      lastError: 'Publishing timed out. Try publishing again.',
    },
  });
  if (result.count > 0) {
    log.warn('Recovered stale Instagram posts', {
      count: result.count,
      cutoff: cutoff.toISOString(),
    });
  }
  return result.count;
}
