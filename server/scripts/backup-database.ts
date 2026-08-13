import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for a database backup');
}

const backupDir = path.resolve(process.cwd(), '../.run/backups');
fs.mkdirSync(backupDir, { recursive: true });
const filename = `whatsapp-platform-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
const outputPath = path.join(backupDir, filename);

const direct = spawnSync('pg_dump', ['--format=custom', '--file', outputPath, databaseUrl], {
  stdio: 'inherit',
});

if (direct.error?.code === 'ENOENT') {
  const containerDump = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'pg_dump', '--format=custom', '--dbname', databaseUrl],
    { encoding: 'buffer' }
  );
  if (containerDump.error) throw containerDump.error;
  if (containerDump.status !== 0) {
    throw new Error(`docker compose pg_dump failed with exit code ${containerDump.status}`);
  }
  fs.writeFileSync(outputPath, containerDump.stdout);
} else if (direct.status !== 0) {
  throw new Error(`pg_dump failed with exit code ${direct.status}`);
}

console.log(`Database backup created: ${outputPath}`);
