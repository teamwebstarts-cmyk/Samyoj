import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const migrationsDir = path.resolve(process.cwd(), 'prisma/migrations');
const destructivePattern = /\b(DELETE\s+FROM|TRUNCATE\b|DROP\s+TABLE)\b/i;

const migrations = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const destructiveMigrations = migrations.flatMap((migration) => {
  const sqlPath = path.join(migrationsDir, migration, 'migration.sql');
  if (!fs.existsSync(sqlPath)) return [];
  const sql = fs.readFileSync(sqlPath, 'utf8');
  return destructivePattern.test(sql) ? [migration] : [];
});

async function getAppliedMigrations(): Promise<Set<string>> {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL
    `;
    return new Set(rows.map((row) => row.migration_name));
  } catch {
    // A missing/unreachable migration table is treated as a fresh or unsafe
    // database, so destructive history remains blocked fail-closed.
    return new Set();
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const appliedMigrations = await getAppliedMigrations();
  const pendingMigrations = migrations.filter((migration) => !appliedMigrations.has(migration));
  const pendingDestructiveMigrations = destructiveMigrations.filter((migration) =>
    pendingMigrations.includes(migration)
  );

  const report = {
    checkedAt: new Date().toISOString(),
    migrationCount: migrations.length,
    destructiveMigrations,
    pendingMigrations,
    pendingDestructiveMigrations,
    safeDeployAllowed: pendingDestructiveMigrations.length === 0,
    reason: pendingDestructiveMigrations.length
      ? 'Pending migration(s) contain destructive SQL. Back up and recover through the documented procedure; raw prisma migrate deploy is prohibited for this app.'
      : null,
  };

  console.log(JSON.stringify(report, null, 2));

  if (pendingDestructiveMigrations.length) {
    process.exitCode = 1;
  }
}

void main();
