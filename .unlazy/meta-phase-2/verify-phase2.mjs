#!/usr/bin/env node
/**
 * Phase 2 CTWA chip gate oracle.
 * Runs the ctwa-referral vitest file and asserts reuse / no-Lead invariants.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

function assertContains(file, needle, label) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) fail(`missing ${file}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.includes(needle)) fail(`invariant failed (${label}): ${file} missing ${JSON.stringify(needle)}`);
}

function assertNotContains(file, needle, label) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) fail(`missing ${file}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (text.includes(needle)) fail(`invariant failed (${label}): ${file} must not contain ${JSON.stringify(needle)}`);
}

assertContains(
  'server/src/workers/webhook.processor.ts',
  'mergeCtwaReferral',
  'webhook reuses mergeCtwaReferral'
);
assertContains(
  'server/src/modules/inbox/ctwa-referral.ts',
  'ctwaReferral',
  'helper stores ctwaReferral on botState'
);
assertContains(
  'server/src/modules/inbox/routes.ts',
  'whatsappAdFromBotState',
  'inbox exposes chip DTO from botState'
);
assertContains(
  'client/src/components/inbox/ChatHeader.tsx',
  'WhatsApp ad',
  'ChatHeader chip label'
);
assertNotContains(
  'server/src/modules/inbox/ctwa-referral.ts',
  'prisma.lead',
  'ctwa helper must not touch Lead'
);
assertNotContains(
  'server/src/modules/inbox/ctwa-referral.ts',
  'META_ADS',
  'ctwa helper must not use META_ADS'
);
assertNotContains(
  'server/src/modules/inbox/ctwa-referral.ts',
  'ads_management',
  'ctwa helper must not call Marketing API scopes'
);

const webhook = fs.readFileSync(
  path.join(root, 'server/src/workers/webhook.processor.ts'),
  'utf8'
);
const ctwaBlock = webhook.slice(
  webhook.indexOf('if (parsed.referral)'),
  webhook.indexOf('void dispatchOrgWebhook(orgId, \'message.received\'')
);
if (/prisma\.lead|Lead\.create|META_ADS|ads_management/i.test(ctwaBlock)) {
  fail('CTWA block in webhook.processor must not create Leads or call Marketing API');
}

const testFile = 'src/modules/inbox/ctwa-referral.test.ts';
const run = spawnSync(
  'npx',
  ['vitest', 'run', testFile],
  {
    cwd: path.join(root, 'server'),
    encoding: 'utf8',
    env: process.env,
  }
);

if (run.status !== 0) {
  console.error(run.stdout || '');
  console.error(run.stderr || '');
  fail(`vitest failed for ${testFile}`);
}

console.log('PHASE2_CTWA_OK');
