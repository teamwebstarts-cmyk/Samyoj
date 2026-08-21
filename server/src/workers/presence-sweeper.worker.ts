import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Decay stale ONLINE availability to AWAY. The client heartbeats every 60s;
 * if no heartbeat (or login / explicit PATCH) has touched the member for
 * STALE_MS, they are almost certainly gone — but handoff picking and call
 * routing still treat them as ONLINE unless we decay it here.
 */
const STALE_MS = 5 * 60 * 1000;
const INTERVAL_MS = parseInt(process.env.PRESENCE_SWEEP_INTERVAL_MS || String(60 * 1000), 10);

async function runPresenceSweepPass(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_MS);
  const result = await prisma.organizationUser.updateMany({
    where: {
      availability: 'ONLINE',
      lastActiveAt: { lt: cutoff },
    },
    data: { availability: 'AWAY' },
  });
  return result.count;
}

export function startPresenceSweeperWorker(): void {
  const run = () => {
    runPresenceSweepPass()
      .then((decayed) => {
        if (decayed > 0) {
          logger.info(`Presence sweep: decayed ${decayed} stale ONLINE member(s) to AWAY`, {
            source: 'presence-sweeper',
          });
        }
      })
      .catch((err) =>
        logger.warn('Presence sweep failed', {
          source: 'presence-sweeper',
          error: err instanceof Error ? err.message : String(err),
        })
      );
  };

  run();
  setInterval(run, INTERVAL_MS);
  logger.info('Presence sweeper worker started', {
    source: 'presence-sweeper',
    intervalMs: INTERVAL_MS,
    staleAfterMs: STALE_MS,
  });
}
