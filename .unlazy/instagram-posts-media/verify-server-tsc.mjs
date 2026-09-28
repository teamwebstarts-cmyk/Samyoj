import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const server = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'server');
const run = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], { cwd: server, encoding: 'utf8' });
const output = (run.stdout || '') + (run.stderr || '');
if (output.trim()) process.stdout.write(output);
if (run.status !== 0) process.exit(run.status || 1);
console.log('server tsc ok');
