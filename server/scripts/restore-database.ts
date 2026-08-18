import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for a database restore');
}

// --- parse args ---
const backupArg = process.argv[2];
if (!backupArg) {
  console.error('Usage: tsx scripts/restore-database.ts <backup-file.dump>');
  console.error('');
  console.error('Pass the path to a pg_dump --format=custom backup file.');
  console.error('Default backup directory: ../.run/backups/');
  process.exit(1);
}

const backupFile = path.resolve(backupArg);
if (!fs.existsSync(backupFile)) {
  throw new Error(`Backup file not found: ${backupFile}`);
}
if (fs.statSync(backupFile).size === 0) {
  throw new Error(`Backup file is empty: ${backupFile}`);
}

const dbName = new URL(databaseUrl).pathname.replace(/^\//, '');
const dbUser = new URL(databaseUrl).username || 'postgres';

/** Run pg_restore --list; capture stdout for validation. */
function pgRestoreList() {
  const direct = spawnSync('pg_restore', ['--list', backupFile], { encoding: 'utf8' });
  if (direct.error?.code === 'ENOENT') {
    const bytes = fs.readFileSync(backupFile);
    return spawnSync(
      'docker',
      ['compose', 'exec', '-T', 'postgres', 'pg_restore', '--list', '-U', dbUser, '-d', dbName],
      { input: bytes, encoding: 'utf8' }
    );
  }
  return direct;
}

/** Run pg_restore to actually restore the database. Stdout/stderr inherited. */
function pgRestoreRun() {
  const args = [
    '--clean', '--if-exists', '--no-owner', '--no-privileges',
    '--dbname', databaseUrl, backupFile,
  ];
  const direct = spawnSync('pg_restore', args, { stdio: 'inherit' });
  if (direct.error?.code === 'ENOENT') {
    const bytes = fs.readFileSync(backupFile);
    return spawnSync(
      'docker',
      [
        'compose', 'exec', '-T', 'postgres', 'pg_restore',
        '--clean', '--if-exists', '--no-owner', '--no-privileges',
        '-U', dbUser, '-d', dbName,
      ],
      { input: bytes, stdio: ['pipe', 'inherit', 'inherit'] }
    );
  }
  return direct;
}

(async () => {
  // --- validate it's a real pg_dump custom-format archive ---
  console.log(`Validating backup: ${backupFile}`);
  const listResult = pgRestoreList();
  if (listResult.error) {
    throw new Error(`pg_restore --list failed: ${listResult.error.message}`);
  }
  if (listResult.status !== 0) {
    throw new Error(
      `pg_restore --list exited with code ${listResult.status}.\n` +
      `stderr: ${listResult.stderr ?? ''}`
    );
  }
  if (!listResult.stdout?.includes('Archive created')) {
    throw new Error(
      'Not a valid PostgreSQL custom-format dump. ' +
      'pg_restore --list did not contain "Archive created".'
    );
  }

  // parse table summary
  const tableLines = (listResult.stdout.match(/^\d+;\s+\d+\s+\d+\s+TABLE\s+/gm) ?? []);
  const tableCount = tableLines.length;
  const archiveMatch = listResult.stdout.match(/Archive created at (.+)/);
  const archiveDate = archiveMatch?.[1]?.trim() ?? 'unknown';

  console.log(`  Archive date : ${archiveDate}`);
  console.log(`  Tables       : ${tableCount}`);
  console.log('');

  // --- confirmation prompt (skip if --yes / -y) ---
  const forceYes = process.argv.includes('--yes') || process.argv.includes('-y');
  if (!forceYes) {
    console.warn(
      `WARNING: This will DROP and REPLACE all data in the target database.\n` +
      `Target: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}\n`
    );
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question('Type "RESTORE" to confirm: ', resolve);
    });
    rl.close();
    if (answer.trim() !== 'RESTORE') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // --- pg_restore --clean --if-exists ---
  console.log('Restoring database...');
  const result = pgRestoreRun();
  if (result.error) {
    throw new Error(`pg_restore failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`pg_restore exited with code ${result.status}`);
  }

  console.log('');
  console.log('Restore complete.');
  console.log(`  Source : ${backupFile}`);
  console.log(`  Target : ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. cd server && npx prisma migrate status   # verify migrations match');
  console.log('  2. npm run dev                              # restart the API');
  console.log('  3. Spot-check a contact/conversation in Inbox');
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
