#!/usr/bin/env node
/**
 * AUD-G11 — missing phone_number_id + 2+ active numbers must not pick latest.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const coex = readFileSync(
  join(root, 'server/src/modules/whatsapp/coexistence/index.ts'),
  'utf8'
);
const dispatcher = readFileSync(
  join(root, 'server/src/modules/whatsapp/webhook-dispatcher.ts'),
  'utf8'
);

if (/orderBy:\s*\{\s*updatedAt/.test(coex) || /orderBy:\s*\{\s*createdAt/.test(coex)) {
  console.error('FAIL: coexistence routing orders by recency (silent latest pick)');
  process.exit(1);
}

if (!coex.includes('take: 2') && !coex.includes('take:2')) {
  console.error('FAIL: coexistence WABA fallback does not cap at 2 candidates');
  process.exit(1);
}

if (!/length !== 1|length === 1/.test(coex) && !/candidates\.length !== 1/.test(coex)) {
  console.error('FAIL: coexistence WABA fallback does not fail closed on 2+ numbers');
  process.exit(1);
}

if (!dispatcher.includes('WABA-only webhook is ambiguous; refusing to route it')) {
  console.error('FAIL: resolveOrgFromWaba lost fail-closed multi-number log');
  process.exit(1);
}

if (!/activeNumberCount/.test(dispatcher) || !/length !== 1/.test(dispatcher)) {
  console.error('FAIL: resolveOrgFromWaba does not refuse 2+ active numbers');
  process.exit(1);
}

console.log('coex_fail_closed_routing_ok');
