#!/usr/bin/env node
/**
 * Verifies growth-surfaces research notes contain required section tokens.
 * Does not copy expected counts from chat. Reads files and checks markers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const leaf = process.argv.includes('--leaf')
  ? process.argv[process.argv.indexOf('--leaf') + 1]
  : 'all';

const LEAVES = {
  '1.1.1': {
    file: 'docs/product/research-notes/01-meta-policy.md',
    tokens: [
      '## Quality rating',
      '## Messaging limits',
      '## Official Business Account',
      '## Template categories',
      '## Click tracking',
      '## Click to WhatsApp',
      'https://developers.facebook.com',
    ],
  },
  '1.1.2': {
    file: 'docs/product/research-notes/02-samyoj-surfaces.md',
    tokens: [
      '## Dashboard',
      '## Quality in code',
      '## Campaigns',
      '## Template library',
      '## Inbox window',
      'LiveMetricsHero',
    ],
  },
  '1.1.3': {
    file: 'docs/product/research-notes/03-competitors-catalog.md',
    tokens: [
      '## Retargeting',
      '## Template catalog',
      '## Website widget',
      'AiSensy',
    ],
  },
  '1.2.1': {
    file: 'docs/product/GROWTH_SURFACES_PHASE_2026-08-29.md',
    tokens: [
      '## DECISION table',
      'Quality rating',
      'Quota',
      'Green tick',
      'Template catalog',
      'Click tracking',
      'Inbox active',
      'WhatsApp button',
      'Retargeting',
      'GO',
    ],
  },
};

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function checkLeaf(id) {
  const spec = LEAVES[id];
  if (!spec) fail(`unknown leaf ${id}`);
  const path = resolve(root, spec.file);
  if (!existsSync(path)) fail(`missing ${spec.file}`);
  const text = readFileSync(path, 'utf8');
  const missing = spec.tokens.filter((t) => !text.includes(t));
  if (missing.length) fail(`${spec.file} missing tokens: ${missing.join(' | ')}`);
  console.log(`OK ${id} ${spec.file}`);
}

const ids = leaf === 'all' ? Object.keys(LEAVES) : [leaf];
for (const id of ids) checkLeaf(id);
console.log('growth-surfaces research verification passed');
