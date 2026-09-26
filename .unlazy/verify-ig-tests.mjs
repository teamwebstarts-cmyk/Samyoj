import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = join(dirname(fileURLToPath(import.meta.url)), '..', 'server');
const run = spawnSync(
  'npx',
  ['vitest', 'run', 'src/modules/instagram/instagram.test.ts', 'src/modules/facebook/save-page-channel.test.ts'],
  { cwd: server, encoding: 'utf8' }
);
const output = (run.stdout || '') + (run.stderr || '');
process.stdout.write(output);
if (run.status !== 0) process.exit(run.status || 1);
if (!/Test Files\s+2 passed/.test(output) || /failed/.test(output)) {
  console.error('instagram comment tests did not pass');
  process.exit(1);
}
console.log('ig comment tests passed');
