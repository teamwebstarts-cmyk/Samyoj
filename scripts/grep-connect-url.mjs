#!/usr/bin/env node
/**
 * Gate A:G2 — connect flow must use ES v4 SDK, not dialog/oauth URL builder.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'server/src/modules/whatsapp/meta.service.ts');
const src = readFileSync(target, 'utf8');

if (/dialog\/oauth/.test(src)) {
  console.error('FAIL: dialog/oauth still present in meta.service.ts');
  process.exit(1);
}

if (!/getEmbeddedSignupConfig|ES_V4_SDK|esConfigId/.test(src)) {
  console.error('FAIL: ES v4 config helper not found');
  process.exit(1);
}

console.log('ES_V4_SDK');
