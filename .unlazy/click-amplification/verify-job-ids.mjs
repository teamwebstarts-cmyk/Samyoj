#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const srcRoot = resolve(root, 'server/src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

const jobIdLiteral = /jobId:\s*`([^`]*)`/g;
const colonHits = [];
for (const file of walk(srcRoot)) {
  const src = readFileSync(file, 'utf8');
  let match;
  while ((match = jobIdLiteral.exec(src))) {
    const template = match[1];
    if (template.includes(':')) {
      colonHits.push(`${relative(root, file)}: ${template}`);
    }
  }
}

if (colonHits.length) {
  console.error('colon in custom BullMQ jobId template:');
  for (const hit of colonHits) console.error(`  ${hit}`);
  process.exit(1);
}

const builders = [
  ['server/src/modules/gmail/constants.ts', /gmail-send-\$\{/],
  ['server/src/modules/whatsapp/webhook-accept.ts', /replace\(\/\[\^a-zA-Z0-9_-\]\/g/],
  ['server/src/modules/campaigns/worker-safety.ts', /isValidBullMqJobId/],
  ['server/src/modules/flows/inbound-wait.ts', /flow-delay-\$\{conversationId\}/],
];

for (const [rel, re] of builders) {
  const src = readFileSync(resolve(root, rel), 'utf8');
  if (!re.test(src)) {
    console.error(`${rel}: missing expected job-id builder`);
    process.exit(1);
  }
}

console.log('job id verification passed');
