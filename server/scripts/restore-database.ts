import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline';
import 'dotenv/config';

const FLAGS = new Set(['--isolated', '--yes', '-y']);

export function postgresDatabaseIdentity(url: string): {
  host: string;
  port: string;
  database: string;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
  };
}

export function isSamePostgresDatabase(a: string, b: string): boolean {
  const left = postgresDatabaseIdentity(a);
  const right = postgresDatabaseIdentity(b);
  return left.host === right.host && left.port === right.port && left.database === right.database;
}

function redactUrl(url: string): string {
  return url.replace(/:[^:@]+@/, ':****@');
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for a database restore');
  }

  const rawArgs = process.argv.slice(2);
  const isolated = rawArgs.includes('--isolated');
  const forceYes = rawArgs.includes('--yes') || rawArgs.includes('-y');
  const backupArg = rawArgs.find((arg) => !FLAGS.has(arg) && !arg.startsWith('--'));

  const targetUrl = isolated ? process.env.RESTORE_DATABASE_URL : databaseUrl;
  if (isolated) {
    if (!targetUrl) {
      throw new Error(
        'RESTORE_DATABASE_URL is required with --isolated so the primary DATABASE_URL is not wiped'
      );
    }
    if (isSamePostgresDatabase(databaseUrl, targetUrl)) {
      throw new Error(
        'Refusing isolated restore: RESTORE_DATABASE_URL points at the primary DATABASE_URL'
      );
    }
  }
  if (!targetUrl) {
    throw new Error('Restore target URL is missing');
  }

  if (!backupArg) {
    console.error('Usage: tsx scripts/restore-database.ts <backup-file.dump> [--isolated] [--yes]');
    console.error('');
    console.error('Pass the path to a pg_dump --format=custom backup file.');
    console.error('Default backup directory: ../.run/backups/');
    console.error('Isolated restore: RESTORE_DATABASE_URL must be a different database than DATABASE_URL.');
    process.exit(1);
  }

  const backupFile = path.resolve(backupArg);
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }
  if (fs.statSync(backupFile).size === 0) {
    throw new Error(`Backup file is empty: ${backupFile}`);
  }

  const dbName = postgresDatabaseIdentity(targetUrl).database;
  const dbUser = new URL(targetUrl).username || 'postgres';

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

  function pgRestoreRun() {
    const args = [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--dbname',
      targetUrl,
      backupFile,
    ];
    const direct = spawnSync('pg_restore', args, { stdio: 'inherit' });
    if (direct.error?.code === 'ENOENT') {
      const bytes = fs.readFileSync(backupFile);
      return spawnSync(
        'docker',
        [
          'compose',
          'exec',
          '-T',
          'postgres',
          'pg_restore',
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          '-U',
          dbUser,
          '-d',
          dbName,
        ],
        { input: bytes, stdio: ['pipe', 'inherit', 'inherit'] }
      );
    }
    return direct;
  }

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

  const tableLines = listResult.stdout.match(/^\d+;\s+\d+\s+\d+\s+TABLE\s+/gm) ?? [];
  const tableCount = tableLines.length;
  const archiveMatch = listResult.stdout.match(/Archive created at (.+)/);
  const archiveDate = archiveMatch?.[1]?.trim() ?? 'unknown';

  console.log(`  Archive date : ${archiveDate}`);
  console.log(`  Tables       : ${tableCount}`);
  console.log('');

  if (!forceYes) {
    console.warn(
      `WARNING: This will DROP and REPLACE all data in the target database.\n` +
        `Target: ${redactUrl(targetUrl)}\n` +
        (isolated ? 'Mode: isolated (primary DATABASE_URL is not the target)\n' : '')
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
  console.log(`  Target : ${redactUrl(targetUrl)}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. cd server && npx prisma migrate status   # verify migrations match');
  console.log('  2. npm run dev                              # restart the API');
  console.log('  3. Spot-check a contact/conversation in Inbox');
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
const runningCli = invoked.endsWith(`${path.sep}restore-database.ts`) || invoked.endsWith(`${path.sep}restore-database.js`);
if (runningCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
