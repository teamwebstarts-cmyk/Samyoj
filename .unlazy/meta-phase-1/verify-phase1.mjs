#!/usr/bin/env node
/**
 * Phase 1 Lead Ads gate oracle.
 * Runs the leadgen-ingest vitest file and asserts key source invariants.
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

assertContains(
  'server/src/modules/facebook/leadgen-ingest.ts',
  'metaLeadId',
  'Lead upsert stores metaLeadId'
);
assertContains(
  'server/src/modules/facebook/leadgen-ingest.ts',
  'META_ADS',
  'source META_ADS'
);
assertContains(
  'server/src/modules/facebook/leadgen-ingest.ts',
  'hasAuditableCampaignConsent',
  'consent gate before template'
);
assertContains(
  'server/src/modules/facebook/connect-oauth-state.ts',
  'leads_retrieval',
  'Page lead scopes'
);
assertContains(
  'server/src/modules/facebook/connect-oauth-state.ts',
  'pages_show_list',
  'Page list scope'
);
assertContains(
  'server/src/modules/leads/routes.ts',
  'META_ADS_SOURCE',
  'META_ADS source filter'
);
assertContains(
  'client/src/components/settings/FacebookPagePanel.tsx',
  'Connect Page',
  'Settings Connect Page'
);

const panel = fs.readFileSync(
  path.join(root, 'client/src/components/settings/FacebookPagePanel.tsx'),
  'utf8'
);
if (/META_APP_ID|App Secret|appSecret/i.test(panel)) {
  fail('FacebookPagePanel must not mention App ID/Secret');
}

assertContains(
  'server/prisma/migrations/20260923160000_meta_lead_ads/migration.sql',
  'meta_lead_id',
  'additive migration'
);
assertContains(
  'server/src/modules/whatsapp/webhook-dispatcher.ts',
  'ingestLeadgenForChannel',
  'dispatcher calls Phase 1 ingest'
);

const testFile = 'src/modules/facebook/leadgen-ingest.test.ts';
const run = spawnSync(
  'npx',
  ['vitest', 'run', testFile],
  {
    cwd: path.join(root, 'server'),
    encoding: 'utf8',
    env: process.env,
  }
);

const out = `${run.stdout || ''}\n${run.stderr || ''}`;
if (run.status !== 0) {
  console.error(out);
  fail(`vitest failed for ${testFile}`);
}
if (!/Tests?\s+\d+\s+passed/i.test(out) && !/passed/i.test(out)) {
  console.error(out);
  fail('vitest output missing pass marker');
}

console.log('PHASE1_LEAD_ADS_OK');
