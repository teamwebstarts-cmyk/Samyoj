import prisma from '../config/database';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('media-retention');

export async function runMediaRetentionPass(): Promise<{ scanned: number; purged: number }> {
  const orgs = await prisma.organization.findMany({
    select: { id: true, retentionDaysMessages: true },
  });

  let scanned = 0;
  let purged = 0;

  for (const org of orgs) {
    const retentionDays = org.retentionDaysMessages || 365;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await prisma.message.deleteMany({
      where: {
        conversation: { organizationId: org.id },
        createdAt: { lt: cutoff },
      },
    });

    scanned += 1;
    purged += result.count;

    if (result.count > 0) {
      log.info('Purged old messages for org', {
        organizationId: org.id,
        count: result.count,
        retentionDays,
      });
    }
  }

  return { scanned, purged };
}

export function startMediaRetentionWorker(): void {
  const intervalMs = parseInt(process.env.MEDIA_RETENTION_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10);

  const run = () => {
    runMediaRetentionPass().catch((err) =>
      log.error('Media retention pass failed', { error: String(err) })
    );
  };

  run();
  setInterval(run, intervalMs);
  log.info('Media retention worker started', { intervalMs });
}
