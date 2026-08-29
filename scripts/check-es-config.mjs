#!/usr/bin/env node
/**
 * Gate A:G1 — META_ES_CONFIG_ID is declared in server config module.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configSrc = readFileSync(join(root, 'server/src/config/index.ts'), 'utf8');

if (!/esConfigId:\s*process\.env\.META_ES_CONFIG_ID/.test(configSrc)) {
  console.error('FAIL: config.meta.esConfigId not wired to META_ES_CONFIG_ID');
  process.exit(1);
}

console.log('es_config_ok');
