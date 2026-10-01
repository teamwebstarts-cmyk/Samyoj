#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = [
  'src/modules/gmail/send.service.test.ts',
  'src/modules/gmail/oauth.test.ts',
  'src/modules/instagram/instagram.test.ts',
  'src/modules/instagram/comment-sync.lock.test.ts',
  'src/modules/campaigns/worker-safety.test.ts',
  'src/modules/facebook/save-page-channel.test.ts',
];

const result = spawnSync('npx', ['vitest', 'run', ...files], {
  cwd: resolve(root, 'server'),
  encoding: 'utf8',
  env: process.env,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status || 1);
console.log('click-amplification tests passed');
