import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  approvedReconciliationMigrations,
  hasApprovedInstagramPostsRebuild,
  historicalDestructiveMigration,
} from './migration-reconciliation-constants';

const destructivePattern = /\b(DELETE\s+FROM|TRUNCATE\b|DROP\s+TABLE)\b/i;
const pendingMigrationsMarker = /Following migrations? have not yet been applied/;

function pendingMigrationNames(output: string): string[] {
  const names: string[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (/^\d{14}_[\w-]+$/.test(trimmed)) names.push(trimmed);
  }
  return names;
}

function migrationSql(name: string): string {
  const sqlPath = path.resolve(process.cwd(), 'prisma/migrations', name, 'migration.sql');
  return fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, 'utf8') : '';
}

function verifyFreshDatabaseIsEmpty(): boolean {
  const check = spawnSync('npx', ['prisma', 'db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'], {
    input: `
      DO $$
      DECLARE public_table_count integer;
      BEGIN
        SELECT COUNT(*) INTO public_table_count
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public';
        IF public_table_count <> 0 THEN
          RAISE EXCEPTION 'database is not empty';
        END IF;
      END $$;
    `,
    encoding: 'utf8',
  });
  return check.status === 0;
}

const status = spawnSync('npx', ['prisma', 'migrate', 'status'], { encoding: 'utf8' });
const output = `${status.stdout || ''}\n${status.stderr || ''}`;

if (status.status !== 0 && !pendingMigrationsMarker.test(output)) {
  throw new Error(output.trim() || 'Unable to determine migration status');
}

if (output.includes('Database schema is up to date')) {
  console.log('Database schema is current; no migration command required.');
  process.exit(0);
}

const pending = pendingMigrationNames(output);

if (pending.includes(historicalDestructiveMigration)) {
  if (verifyFreshDatabaseIsEmpty()) {
    console.warn(
      'Fresh empty database verified; applying the full migration chain because the historical ' +
        'deduplication migration has no rows to delete.'
    );
    const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
    if (deploy.status !== 0) {
      throw new Error(`Fresh-database migration deploy failed with exit code ${deploy.status ?? 1}`);
    }
    console.log(`Applied migrations: ${pending.join(', ')}`);
    process.exit(0);
  }
  throw new Error(
    'Startup refused to migrate. Historical destructive WhatsApp-number migration is pending. ' +
      'Use the documented backup/preflight reconciliation workflow; raw prisma migrate deploy is prohibited.'
  );
}

if (
  approvedReconciliationMigrations.some((migration) => pending.includes(migration)) &&
  process.env.MIGRATION_BACKUP_FILE
) {
  const migration = spawnSync('npm', ['run', 'db:migrate-reconciliation-safe'], {
    stdio: 'inherit',
  });
  process.exitCode = migration.status ?? 1;
  process.exit();
}

const destructivePending = pending.filter((name) => destructivePattern.test(migrationSql(name)));
const blockedDestructivePending = destructivePending.filter(
  (name) => name !== '20260927190000_drop_instagram_posts' || !hasApprovedInstagramPostsRebuild(pending)
);
if (blockedDestructivePending.length > 0) {
  throw new Error(
    `Startup refused to migrate. Pending migration(s) contain destructive SQL: ${blockedDestructivePending.join(', ')}. ` +
      'Use the documented backup/preflight reconciliation workflow.'
  );
}

if (pending.length === 0) {
  throw new Error(
    'Startup refused to migrate. Use the documented backup/preflight reconciliation workflow; ' +
      'fresh installs and unexpected pending migrations are fail-closed.'
  );
}

const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
if (deploy.status !== 0) {
  throw new Error(`Additive migration deploy failed with exit code ${deploy.status ?? 1}`);
}
console.log(`Applied additive pending migration(s): ${pending.join(', ')}`);
