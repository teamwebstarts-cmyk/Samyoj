import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');

function run(label, cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd: path.join(root, cwd),
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    process.stderr.write(`${label} failed\n${result.stdout || ''}${result.stderr || ''}`);
    process.exit(result.status || 1);
  }
}

for (const [name, cwd] of [
  ['server', 'server'],
  ['client', 'client'],
  ['admin', 'admin'],
]) {
  run(`${name} build`, cwd, 'npm', ['run', 'build']);
  run(`${name} tests`, cwd, 'npm', ['test']);
  run(`${name} dependency audit`, cwd, 'npm', [
    'audit',
    '--omit=dev',
    '--audit-level=high',
  ]);
}

run('number isolation audit', 'server', 'npm', ['run', 'db:audit-number-isolation']);

const migration = spawnSync('npm', ['run', 'db:validate-migration-chain'], {
  cwd: path.join(root, 'server'),
  encoding: 'utf8',
  env: process.env,
});
const migrationOutput = `${migration.stdout || ''}\n${migration.stderr || ''}`;
if (
  migration.status !== 1 ||
  !migrationOutput.includes('"safeDeployAllowed": false') ||
  !migrationOutput.includes('20260808120000_unique_whatsapp_phone_number_id')
) {
  process.stderr.write(`migration safety guard did not produce the expected refusal\n${migrationOutput}`);
  process.exit(1);
}

const report = fs.readFileSync(
  path.join(root, 'docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md'),
  'utf8'
);
if (!report.includes('## Implementation update from this audit')) {
  process.stderr.write('CRM audit report is missing its implementation evidence\n');
  process.exit(1);
}

console.log('crm-surface-audit-final-ok');
