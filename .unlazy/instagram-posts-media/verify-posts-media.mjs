import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const server = join(root, 'server');
const run = spawnSync(
  'npx',
  [
    'vitest',
    'run',
    'src/modules/instagram/posts.limits.test.ts',
    'src/modules/instagram/posts.media.test.ts',
    'src/modules/instagram/posts.publish.test.ts',
  ],
  { cwd: server, encoding: 'utf8' }
);
const output = (run.stdout || '') + (run.stderr || '');
process.stdout.write(output);
if (run.status !== 0) process.exit(run.status || 1);
if (!/Test Files\s+3 passed/.test(output)) {
  console.error('expected 3 passed test files');
  process.exit(1);
}
console.log('ig posts media verification passed');
