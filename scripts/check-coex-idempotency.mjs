#!/usr/bin/env node
/**
 * AUD-G8 — coexistence handlers claim/complete/release like webhook-dispatcher.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(
  join(root, 'server/src/modules/whatsapp/coexistence/index.ts'),
  'utf8'
);

const required = [
  'claimProviderWebhookEvent',
  'completeProviderWebhookEvent',
  'releaseProviderWebhookEvent',
  'coexistenceWebhookEventKey',
];
const missing = required.filter((name) => !src.includes(name));
if (missing.length) {
  console.error('FAIL: coexistence webhook missing idempotency:', missing.join(', '));
  process.exit(1);
}

if (!/field.*waba|wabaId|phoneNumberId/.test(src)) {
  console.error('FAIL: coexistence event key is not scoped to field/waba/phone');
  process.exit(1);
}

console.log('coex_idempotency_ok');
