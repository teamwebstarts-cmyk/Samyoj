#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

function run(cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    console.error(output);
    process.exit(result.status || 1);
  }
  return output;
}

run(resolve(root, 'server'), 'npx', [
  'vitest',
  'run',
  'src/modules/campaigns/cohorts.test.ts',
  'src/modules/campaigns/recipients.test.ts',
  'src/modules/templates/starters.test.ts',
  'src/modules/analytics/conversation-mix.test.ts',
  'src/modules/inbox/service-window.test.ts',
  '--reporter=dot',
]);

run(resolve(root, 'client'), 'npx', [
  'vitest',
  'run',
  'src/utils/templateLibrary.test.ts',
  'src/utils/inboxListParams.test.ts',
  'src/utils/waMe.test.ts',
  '--reporter=dot',
]);

console.log('growth-surfaces unit verification passed');
