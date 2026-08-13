import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import prisma from '../src/config/database';

const targetMigration = '20260814013000_reconcile_whatsapp_schema';
const historicalMigration = '20260808120000_unique_whatsapp_phone_number_id';

(async () => {
  const backupFile = process.env.MIGRATION_BACKUP_FILE;
  if (!backupFile || !fs.existsSync(backupFile) || fs.statSync(backupFile).size === 0) {
    throw new Error('MIGRATION_BACKUP_FILE must point to a non-empty verified backup dump');
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

  if (!applied.some((row) => row.migration_name === historicalMigration)) {
    throw new Error('Historical migration is not marked applied; use the fail-closed clean-install procedure');
  }
  if (applied.some((row) => row.migration_name === targetMigration)) {
    throw new Error(`Target migration is already applied: ${targetMigration}`);
  }

  const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const appliedNames = new Set(applied.map((row) => row.migration_name));
  const status = spawnSync('npx', ['prisma', 'migrate', 'status'], { encoding: 'utf8' });
  const pendingNames = migrations.filter(
    (name) => !appliedNames.has(name) && status.stdout.includes(name)
  );
  if (pendingNames.length !== 1 || pendingNames[0] !== targetMigration) {
    throw new Error(`Refusing to apply unexpected pending migrations: ${pendingNames.join(', ') || 'none'}`);
  }

  const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
  if (deploy.status !== 0) {
    throw new Error(`Reconciliation migration failed with exit code ${deploy.status}`);
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
