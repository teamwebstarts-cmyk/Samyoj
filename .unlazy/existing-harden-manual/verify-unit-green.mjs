import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function run(cmd, args, cwd = root) {
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: process.env });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    throw new Error(out.slice(-2500) || `${cmd} ${args.join(' ')} exited ${result.status}`);
  }
  return out;
}

function expectToken(out, token) {
  if (!out.includes(token)) {
    throw new Error(`missing ${token}:\n${out.slice(-800)}`);
  }
}

const honesty = run('node', ['.unlazy/existing-harden-packet-a/verify-honesty.mjs']);
expectToken(honesty, 'packet-a-honesty-ok');
expectToken(run('node', ['.unlazy/existing-harden-packet-a/verify-honesty.mjs', '--stubs']), 'packet-a-stubs-ok');

const clientTest = run(
  'npm',
  ['test', '--', 'src/components/campaigns/campaignSendConfirm.test.ts', '--reporter=dot'],
  path.join(root, 'client')
);
if (!/Tests\s+\d+\s+passed/.test(clientTest)) {
  throw new Error('campaignSendConfirm tests did not pass');
}

const dedupe = run(
  'npm',
  ['test', '--', 'src/modules/campaigns/validation.test.ts', '-t', 'dedupeRecipients', '--reporter=dot'],
  path.join(root, 'server')
);
if (!/Tests\s+\d+\s+passed/.test(dedupe)) {
  throw new Error('dedupeRecipients tests did not pass');
}

for (const flag of ['--auth', '--media', '--wired', '--isolation']) {
  const token = {
    '--auth': 'packet-b-auth-ok',
    '--media': 'packet-b-media-ok',
    '--wired': 'packet-b-wired-ok',
    '--isolation': 'packet-b-isolation-ok',
  }[flag];
  expectToken(run('node', ['.unlazy/existing-harden-packet-b/verify-packet-b.mjs', flag]), token);
}

for (const flag of ['--accept', '--dup', '--multi', '--wired']) {
  const token = {
    '--accept': 'packet-c-accept-ok',
    '--dup': 'packet-c-dup-ok',
    '--multi': 'packet-c-multi-ok',
    '--wired': 'packet-c-wired-ok',
  }[flag];
  expectToken(run('node', ['.unlazy/existing-harden-packet-c/verify-packet-c.mjs', flag]), token);
}

for (const flag of ['--inbox', '--meta', '--wired', '--campaign']) {
  const token = {
    '--inbox': 'packet-d-inbox-ok',
    '--meta': 'packet-d-meta-ok',
    '--wired': 'packet-d-wired-ok',
    '--campaign': 'packet-d-campaign-ok',
  }[flag];
  expectToken(run('node', ['.unlazy/existing-harden-packet-d/verify-packet-d.mjs', flag]), token);
}

for (const flag of ['--count', '--restart', '--meta', '--restore']) {
  const token = {
    '--count': 'packet-f-count-ok',
    '--restart': 'packet-f-restart-ok',
    '--meta': 'packet-f-meta-ok',
    '--restore': 'packet-f-restore-ok',
  }[flag];
  expectToken(run('node', ['.unlazy/existing-harden-packet-f/verify-packet-f.mjs', flag]), token);
}

console.log('existing-harden-unit-green-ok');
