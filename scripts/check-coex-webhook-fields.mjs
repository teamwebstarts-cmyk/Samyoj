#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'server/src/modules/whatsapp/meta.service.ts'), 'utf8');
const required = ['history', 'smb_message_echoes', 'smb_app_state_sync', 'account_update'];
const missing = required.filter((field) => !src.includes(`'${field}'`));
if (missing.length) {
  console.error('FAIL: missing webhook fields:', missing.join(', '));
  process.exit(1);
}
console.log('coex_fields_ok');
