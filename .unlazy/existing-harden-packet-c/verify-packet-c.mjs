import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const server = path.join(root, 'server');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runVitest(args, token) {
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
  console.log(token);
}

const mode = process.argv[2];

if (mode === '--accept') {
  runVitest(['src/modules/whatsapp/webhook-accept.test.ts'], 'packet-c-accept-ok');
} else if (mode === '--dup') {
  runVitest(
    ['src/workers/webhook.processor.test.ts', '-t', 'duplicate'],
    'packet-c-dup-ok'
  );
} else if (mode === '--multi') {
  runVitest(
    ['src/workers/webhook.processor.test.ts', '-t', 'phone_number_id'],
    'packet-c-multi-ok'
  );
} else if (mode === '--wired') {
  runVitest(
    [
      'src/modules/whatsapp/route-hardening.test.ts',
      'src/modules/whatsapp/webhook-health.test.ts',
      'src/modules/whatsapp/webhook-signature-gate.test.ts',
      'src/middleware/tenant-csrf.test.ts',
    ],
    'packet-c-wired-ok'
  );
} else {
  throw new Error('usage: --accept | --dup | --multi | --wired');
}
