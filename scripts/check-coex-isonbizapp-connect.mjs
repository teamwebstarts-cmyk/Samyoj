#!/usr/bin/env node
/**
 * AUD-G10 — Graph-check is_on_biz_app after any connect, not only coexistence modal.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const routes = readFileSync(join(root, 'server/src/modules/whatsapp/routes.ts'), 'utf8');
const fnStart = routes.indexOf('async function saveWhatsappConnection');
const fnEnd = routes.indexOf('const metaAdminGuard');
if (fnStart < 0 || fnEnd < 0 || fnEnd <= fnStart) {
  console.error('FAIL: saveWhatsappConnection not found');
  process.exit(1);
}
const fn = routes.slice(fnStart, fnEnd);

if (!fn.includes('fetchCoexistenceFlags')) {
  console.error('FAIL: connect path does not Graph-check is_on_biz_app');
  process.exit(1);
}

if (/if \(opts\?\.connectMode === 'coexistence' \|\| opts\?\.skipRegister\)/.test(fn)) {
  console.error('FAIL: isOnBizApp Graph check is still gated on coexistence/skipRegister');
  process.exit(1);
}

if (/isOnBizApp:\s*opts\?\.connectMode === 'coexistence'\s*\?\s*isOnBizApp/.test(fn)) {
  console.error('FAIL: isOnBizApp still persisted only for coexistence connectMode');
  process.exit(1);
}

console.log('isonbizapp_any_connect_ok');
