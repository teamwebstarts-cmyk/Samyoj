import { spawnSync } from 'node:child_process';
import { approvedReconciliationMigrations } from './migration-reconciliation-constants';

const status = spawnSync('npx', ['prisma', 'migrate', 'status'], { encoding: 'utf8' });
const output = `${status.stdout || ''}\n${status.stderr || ''}`;

if (status.status !== 0 && !output.includes('Following migration have not yet been applied')) {
  throw new Error(output.trim() || 'Unable to determine migration status');
}

if (output.includes('Database schema is up to date')) {
  console.log('Database schema is current; no migration command required.');
  process.exit(0);
}

if (
  approvedReconciliationMigrations.some((migration) => output.includes(migration)) &&
  process.env.MIGRATION_BACKUP_FILE
) {
  const migration = spawnSync('npm', ['run', 'db:migrate-reconciliation-safe'], {
    stdio: 'inherit',
  });
  process.exitCode = migration.status ?? 1;
  process.exit();
}

throw new Error(
  'Startup refused to migrate. Use the documented backup/preflight reconciliation workflow; ' +
    'fresh installs and unexpected pending migrations are fail-closed.'
);
