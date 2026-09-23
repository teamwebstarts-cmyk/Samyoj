#!/usr/bin/env node
/**
 * Phase 3 Messenger — runs the messenger vitest and prints a success-only token.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = spawnSync(
  'npx',
  ['vitest', 'run', 'src/modules/facebook/messenger-inbox.test.ts'],
  {
    cwd: path.join(root, 'server'),
    encoding: 'utf8',
    env: { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' },
  }
);

const out = `${result.stdout || ''}${result.stderr || ''}`;
if (result.status !== 0) {
  process.stderr.write(out);
  process.exit(result.status || 1);
}

if (!/Tests\s+\d+\s+passed/.test(out) && !/✓/.test(out)) {
  process.stderr.write(out);
  process.stderr.write('\nPhase 3 verify: vitest did not report passes\n');
  process.exit(1);
}

process.stdout.write('PHASE3_MESSENGER_OK\n');
