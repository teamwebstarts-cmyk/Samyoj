import fs from 'node:fs';
import path from 'node:path';

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

const report = {
  checkedAt: new Date().toISOString(),
  migrationCount: migrations.length,
  destructiveMigrations,
  safeDeployAllowed: destructiveMigrations.length === 0,
  reason: destructiveMigrations.length
    ? 'Migration history contains destructive SQL. Back up and recover through the documented procedure; raw prisma migrate deploy is prohibited for this app.'
    : null,
};

console.log(JSON.stringify(report, null, 2));

if (destructiveMigrations.length) {
  process.exitCode = 1;
}
