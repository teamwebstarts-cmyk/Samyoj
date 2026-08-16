import prisma from '../src/config/database';
import {
  backfillOrgHealthSnapshots,
  purgePlatformTelemetry,
} from '../src/modules/platform/snapshots';

async function main(): Promise<void> {
  const now = new Date();
  const snapshots = await backfillOrgHealthSnapshots(now);
  const retention = await purgePlatformTelemetry(now);
  console.log(JSON.stringify({ capturedAt: now.toISOString(), snapshots, retention }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Platform telemetry backfill failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
