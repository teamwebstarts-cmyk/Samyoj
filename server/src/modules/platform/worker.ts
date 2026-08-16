import { createModuleLogger } from '../../utils/logger';
import { backfillOrgHealthSnapshots, purgePlatformTelemetry } from './snapshots';

const log = createModuleLogger('platform-telemetry');
const DAY_MS = 24 * 60 * 60 * 1000;
const RUN_HOUR_UTC = 2;
let started = false;

export function millisecondsUntilNextPlatformTelemetryRun(now = new Date()): number {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RUN_HOUR_UTC)
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

export async function runPlatformTelemetryPass(now = new Date()): Promise<void> {
  try {
    const snapshots = await backfillOrgHealthSnapshots(now);
    const purged = await purgePlatformTelemetry(now);
    log.info('Platform telemetry pass completed', { ...snapshots, ...purged });
  } catch {
    log.warn('Platform telemetry pass failed');
  }
}

export function startPlatformTelemetryWorker(): void {
  if (started) return;
  started = true;
  const configuredInterval = Number(process.env.PLATFORM_SNAPSHOT_INTERVAL_MS);
  const intervalMs =
    Number.isFinite(configuredInterval) && configuredInterval > 0
      ? configuredInterval
      : DAY_MS;
  const delay = millisecondsUntilNextPlatformTelemetryRun();

  setTimeout(() => {
    void runPlatformTelemetryPass();
    setInterval(() => void runPlatformTelemetryPass(), intervalMs);
  }, delay);
  log.info('Platform telemetry worker scheduled', {
    intervalMs,
    nextRunInMinutes: Math.ceil(delay / 60_000),
  });
}
