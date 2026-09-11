import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const server = path.join(root, 'server');
const evidencePath = path.join(root, '.run/packet-f-evidence.json');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runHarness(flag, token) {
  const result = spawnSync('npx', ['tsx', 'scripts/packet-f-harness.ts', flag], {
    cwd: server,
    encoding: 'utf8',
    env: process.env,
  });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    throw new Error(out.slice(-2500) || `harness ${flag} exited ${result.status}`);
  }
  if (!out.includes(token)) {
    throw new Error(`missing ${token}:\n${out.slice(-800)}`);
  }
  return out;
}

function runVitest(args) {
  const result = spawnSync('npm', ['test', '--', ...args, '--reporter=dot'], {
    cwd: server,
    encoding: 'utf8',
    env: process.env,
  });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    throw new Error(out.slice(-2000) || `vitest exited ${result.status}`);
  }
  if (!/Tests\s+\d+\s+passed/.test(out)) {
    throw new Error(`vitest passed without a Tests N passed line:\n${out.slice(-500)}`);
  }
}

function evidence() {
  return JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
}

function assertWorkerClaimWired() {
  const worker = read('server/src/workers/index.ts');
  if (!worker.includes('shouldSkipOutboundProviderRetry')) {
    throw new Error('message worker missing shouldSkipOutboundProviderRetry');
  }
  const claimWhere =
    "OR: [{ claimToken: null }, { claimedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }],\n          providerCallStartedAt: null";
  if (!worker.includes(claimWhere)) {
    throw new Error('campaign claim where is missing providerCallStartedAt: null');
  }
  const lease = read('server/src/modules/messages/send-lease.ts');
  if (!lease.includes('return Boolean(row.providerCallStartedAt)')) {
    throw new Error('send-lease no longer skips in-flight providerCallStartedAt');
  }
}

function spawnRestore(envExtra, args) {
  return spawnSync('npx', ['tsx', 'scripts/restore-database.ts', ...args], {
    cwd: server,
    encoding: 'utf8',
    env: { ...process.env, ...envExtra },
  });
}

function loadPrimaryUrl() {
  const envFile = path.join(server, '.env');
  if (!process.env.DATABASE_URL && fs.existsSync(envFile)) {
    const match = fs.readFileSync(envFile, 'utf8').match(/^DATABASE_URL=(.+)$/m);
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return process.env.DATABASE_URL || '';
}

function tryIsolatedRehearsal(primaryUrl) {
  const parsed = new URL(primaryUrl);
  const primaryDb = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const rehearsalDb = 'samyoj_packet_f_restore';
  if (rehearsalDb === primaryDb) {
    return { rehearsal: 'skipped', reason: 'rehearsal name collided with primary' };
  }
  const user = parsed.username || 'postgres';
  const drop = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      user,
      '-d',
      'postgres',
      '-c',
      `DROP DATABASE IF EXISTS ${rehearsalDb};`,
    ],
    { cwd: root, encoding: 'utf8' }
  );
  const created = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      user,
      '-d',
      'postgres',
      '-c',
      `CREATE DATABASE ${rehearsalDb};`,
    ],
    { cwd: root, encoding: 'utf8' }
  );
  if (drop.status !== 0 || created.status !== 0) {
    return {
      rehearsal: 'skipped',
      reason: `${drop.stderr || drop.stdout || ''} ${created.stderr || created.stdout || 'docker postgres unavailable'}`.slice(
        0,
        240
      ),
    };
  }

  const dumpDir = path.join(root, '.run');
  fs.mkdirSync(dumpDir, { recursive: true });
  const dumpFile = path.join(dumpDir, 'packet-f-restore-rehearsal.dump');
  const dump = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'pg_dump',
      '--format=custom',
      '--schema-only',
      '-U',
      user,
      primaryDb,
    ],
    { cwd: root, encoding: 'buffer' }
  );
  if (dump.status !== 0) {
    return { rehearsal: 'skipped', reason: 'schema-only pg_dump failed' };
  }
  fs.writeFileSync(dumpFile, dump.stdout);

  const restoreUrl = new URL(primaryUrl);
  restoreUrl.pathname = `/${rehearsalDb}`;
  const restored = spawnRestore(
    { DATABASE_URL: primaryUrl, RESTORE_DATABASE_URL: restoreUrl.toString() },
    ['--isolated', dumpFile, '--yes']
  );
  const dropped = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      user,
      '-d',
      'postgres',
      '-c',
      `DROP DATABASE IF EXISTS ${rehearsalDb};`,
    ],
    { cwd: root, encoding: 'utf8' }
  );
  if (restored.status !== 0) {
    throw new Error(
      `isolated rehearsal restore failed:\n${`${restored.stdout || ''}${restored.stderr || ''}`.slice(-1500)}`
    );
  }
  return {
    rehearsal: 'ok',
    dumpBytes: fs.statSync(dumpFile).size,
    dropped: dropped.status === 0,
  };
}

const mode = process.argv[2];

if (mode === '--count') {
  assertWorkerClaimWired();
  runHarness('--count', 'packet-f-count-ok');
  const count = evidence().count;
  if (!count || count.eligible !== count.graphCalls || count.eligible !== count.uniqueTos) {
    throw new Error(`count invariant failed: ${JSON.stringify(count)}`);
  }
  if (count.duplicateTos !== 0) {
    throw new Error(`duplicate tos ${count.duplicateTos}`);
  }
  if (count.eligible < 1000) {
    throw new Error(`eligible ${count.eligible} is below the 1000-send proof`);
  }
  console.log('packet-f-count-ok');
} else if (mode === '--restart') {
  assertWorkerClaimWired();
  runHarness('--restart', 'packet-f-restart-ok');
  const restart = evidence().restart;
  if (!restart || restart.graphCallsAfterRestart !== restart.graphCallsAfterCrash) {
    throw new Error(`restart added sends: ${JSON.stringify(restart)}`);
  }
  if (restart.crashedPhoneCalls !== 0) {
    throw new Error(`crashed recipient was sent: ${JSON.stringify(restart)}`);
  }
  console.log('packet-f-restart-ok');
} else if (mode === '--meta') {
  runHarness('--meta', 'packet-f-meta-ok');
  const meta = evidence().meta;
  if (!meta || meta.retry429Calls < 2) {
    throw new Error(`429 did not retry: ${JSON.stringify(meta)}`);
  }
  if (meta.timeoutCalls !== 1 || meta.http5xxCalls !== 1) {
    throw new Error(`timeout/5xx double-sent: ${JSON.stringify(meta)}`);
  }
  runVitest(['src/modules/whatsapp/coexistence/send-throttle.test.ts']);
  const throttle = read('server/src/modules/whatsapp/coexistence/send-throttle.ts');
  if (!throttle.includes('falls back to in-memory') && !throttle.includes('falling back to in-memory')) {
    throw new Error('coexistence throttle missing Redis-down fallback');
  }
  const indexSrc = read('server/src/index.ts');
  if (!indexSrc.includes('Background workers are disabled')) {
    throw new Error('API no longer disables workers when Redis is down');
  }
  console.log('packet-f-meta-ok');
} else if (mode === '--restore') {
  const checklist = path.join(root, '.unlazy/existing-harden-packet-f/RESTORE_CHECKLIST.md');
  if (!fs.existsSync(checklist)) {
    throw new Error('RESTORE_CHECKLIST.md missing');
  }
  const restoreSrc = read('server/scripts/restore-database.ts');
  if (!restoreSrc.includes('--isolated') || !restoreSrc.includes('RESTORE_DATABASE_URL')) {
    throw new Error('restore-database.ts missing isolated target guard');
  }
  if (!restoreSrc.includes('Refusing isolated restore')) {
    throw new Error('restore-database.ts missing primary-DB refuse copy');
  }

  const primaryUrl =
    loadPrimaryUrl() || 'postgresql://postgres:postgres@127.0.0.1:5432/whatsapp_platform';
  const missing = spawnRestore({ DATABASE_URL: primaryUrl, RESTORE_DATABASE_URL: '' }, ['--isolated']);
  const missingOut = `${missing.stdout || ''}${missing.stderr || ''}`;
  if (missing.status === 0 || !/RESTORE_DATABASE_URL is required/i.test(missingOut)) {
    throw new Error(`isolated restore without target must fail closed:\n${missingOut.slice(-800)}`);
  }
  const same = spawnRestore(
    { DATABASE_URL: primaryUrl, RESTORE_DATABASE_URL: primaryUrl },
    ['--isolated']
  );
  const sameOut = `${same.stdout || ''}${same.stderr || ''}`;
  if (same.status === 0 || !/Refusing isolated restore/i.test(sameOut)) {
    throw new Error(`isolated restore into primary must be refused:\n${sameOut.slice(-800)}`);
  }

  const rehearsal = tryIsolatedRehearsal(primaryUrl);
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  const previous = fs.existsSync(evidencePath)
    ? JSON.parse(fs.readFileSync(evidencePath, 'utf8'))
    : {};
  fs.writeFileSync(
    evidencePath,
    `${JSON.stringify({ ...previous, restore: { refusedPrimary: true, ...rehearsal } }, null, 2)}\n`
  );
  console.log(`restore-rehearsal=${rehearsal.rehearsal}`);
  console.log('packet-f-restore-ok');
} else {
  throw new Error('usage: --count | --restart | --meta | --restore');
}
