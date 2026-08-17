import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import prisma from '../src/config/database';
import {
  approvedReconciliationMigrations,
  historicalDestructiveMigration,
} from './migration-reconciliation-constants';

const pendingMigrationsMarker = /Following migrations? have not yet been applied/;

(async () => {
  const backupFile = process.env.MIGRATION_BACKUP_FILE;
  if (!backupFile || !fs.existsSync(backupFile) || fs.statSync(backupFile).size === 0) {
    throw new Error('MIGRATION_BACKUP_FILE must point to a non-empty verified backup dump');
  }
  const backupBytes = fs.readFileSync(backupFile);
  const directRestoreList = spawnSync('pg_restore', ['--list', backupFile], {
    encoding: 'utf8',
  });
  let restoreList = directRestoreList;
  if (directRestoreList.error?.code === 'ENOENT') {
    restoreList = spawnSync(
      'docker',
      ['compose', 'exec', '-T', 'postgres', 'pg_restore', '--list'],
      { input: backupBytes, encoding: 'utf8' }
    );
  }
  if (
    restoreList.error ||
    restoreList.status !== 0 ||
    !restoreList.stdout.includes('Archive created')
  ) {
    throw new Error(
      'MIGRATION_BACKUP_FILE is not a valid PostgreSQL custom-format dump; ' +
        'pg_restore --list validation failed'
    );
  }

  const preflight = spawnSync('npm', ['run', 'db:preflight-number-isolation'], { stdio: 'inherit' });
  if (preflight.status !== 0) {
    throw new Error('Number-isolation preflight failed; reconciliation migration was not applied');
  }

  const applied = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
    `SELECT migration_name, finished_at
     FROM "_prisma_migrations"
     WHERE finished_at IS NOT NULL`
  );
  await prisma.$disconnect();

  if (!applied.some((row) => row.migration_name === historicalDestructiveMigration)) {
    throw new Error('Historical migration is not marked applied; use the fail-closed clean-install procedure');
  }

  const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const appliedNames = new Set(applied.map((row) => row.migration_name));
  const status = spawnSync('npx', ['prisma', 'migrate', 'status'], { encoding: 'utf8' });
  const statusOutput = `${status.stdout || ''}\n${status.stderr || ''}`;
  if (status.status !== 0 && !pendingMigrationsMarker.test(statusOutput)) {
    throw new Error(statusOutput.trim() || 'Unable to determine migration status');
  }
  const pendingNames = migrations.filter(
    (name) => !appliedNames.has(name) && statusOutput.includes(name)
  );
  const unexpectedPendingNames = pendingNames.filter(
    (name) => !approvedReconciliationMigrations.includes(name as (typeof approvedReconciliationMigrations)[number])
  );
  if (unexpectedPendingNames.length > 0 || pendingNames.length > 1) {
    throw new Error(`Refusing to apply unexpected pending migrations: ${pendingNames.join(', ') || 'none'}`);
  }
  if (pendingNames.length === 0) {
    const appliedApprovedTargets = approvedReconciliationMigrations.filter((name) =>
      appliedNames.has(name)
    );
    if (appliedApprovedTargets.length > 0) {
      console.info(
        `Approved reconciliation migration(s) already applied; nothing to do: ${appliedApprovedTargets.join(', ')}`
      );
      return;
    }
    throw new Error('No approved reconciliation migration is pending; refusing to apply anything');
  }
  if (
    !approvedReconciliationMigrations.includes(
      pendingNames[0] as (typeof approvedReconciliationMigrations)[number]
    )
  ) {
    throw new Error(`Refusing to apply unexpected pending migration: ${pendingNames[0]}`);
  }

  const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
  if (deploy.status !== 0) {
    throw new Error(`Approved reconciliation migration failed with exit code ${deploy.status}`);
  }
  console.info(`Applied approved reconciliation migration: ${pendingNames[0]}`);
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
