#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const mode = process.argv.includes('--unit-server')
  ? 'unit-server'
  : process.argv.includes('--unit-client')
    ? 'unit-client'
    : process.argv.includes('--live')
      ? 'live'
      : 'audit';

function read(rel) {
  const path = resolve(root, rel);
  if (!existsSync(path)) throw new Error(`missing ${rel}`);
  return readFileSync(path, 'utf8');
}

function hasEdgeParams(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return false;
  if (/^\{\{\d+\}\}/.test(trimmed)) return true;
  const withoutTrailingPunct = trimmed.replace(/[\s.!?…,;:'"“”‘’]+$/u, '');
  return /\{\{\d+\}\}$/.test(withoutTrailingPunct);
}

if (mode === 'unit-server') {
  const result = spawnSync(
    'npx',
    [
      'vitest',
      'run',
      'src/modules/templates/starters.test.ts',
      'src/modules/templates/clone.test.ts',
      'src/modules/whatsapp/graph-error.test.ts',
    ],
    { cwd: resolve(root, 'server'), encoding: 'utf8', env: { ...process.env, VITEST: 'true' } },
  );
  process.stdout.write(`${result.stdout || ''}${result.stderr || ''}`);
  if (result.status !== 0) process.exit(result.status || 1);
  console.log('catalog server unit verification passed');
  process.exit(0);
}

if (mode === 'unit-client') {
  const result = spawnSync(
    'npx',
    ['vitest', 'run', 'src/utils/templateLibrary.test.ts', 'src/utils/templateIssueCopy.test.ts'],
    { cwd: resolve(root, 'client'), encoding: 'utf8', env: { ...process.env, VITEST: 'true' } },
  );
  process.stdout.write(`${result.stdout || ''}${result.stderr || ''}`);
  if (result.status !== 0) process.exit(result.status || 1);
  console.log('catalog client unit verification passed');
  process.exit(0);
}

if (mode === 'live') {
  const health = await fetch('http://localhost:8000/health').then((res) => {
    if (!res.ok) throw new Error(`API /health ${res.status}`);
    return res.json();
  });
  if (!health || health.status === 'error') throw new Error('API health is not ok');
  const webhook = await fetch('http://localhost:8000/api/whatsapp/webhook/health').then((res) => {
    if (!res.ok) throw new Error(`webhook health ${res.status}`);
    return res.json();
  });
  const payload = webhook.data || webhook;
  if (payload.webhookConfigured !== true && payload.webhookConfigured !== false) {
    throw new Error('webhook health missing webhookConfigured');
  }
  console.log(
    `catalog live connection verification passed (webhookConfigured=${payload.webhookConfigured} totalReceived=${payload.totalReceived ?? 'n/a'})`,
  );
  process.exit(0);
}

const catalog = read('server/src/modules/templates/catalog.ts');
const bodies = [...catalog.matchAll(/body:\s*'((?:\\'|[^'])*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
const bodiesHi = [...catalog.matchAll(/bodyHi:\s*'((?:\\'|[^'])*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
const authIndexes = new Set();
const entries = catalog.split(/\{\s*id:\s*'/);
for (const chunk of entries.slice(1)) {
  const id = chunk.slice(0, chunk.indexOf("'"));
  const isAuth = /category:\s*'AUTHENTICATION'/.test(chunk.slice(0, 400));
  const body = (chunk.match(/body:\s*'((?:\\'|[^'])*)'/) || [])[1];
  const bodyHi = (chunk.match(/bodyHi:\s*'((?:\\'|[^'])*)'/) || [])[1];
  if (isAuth) {
    authIndexes.add(id);
    continue;
  }
  if (body && hasEdgeParams(body.replace(/\\'/g, "'"))) {
    throw new Error(`catalog ${id} English body still has a leading/trailing variable`);
  }
  if (bodyHi && hasEdgeParams(bodyHi.replace(/\\'/g, "'"))) {
    throw new Error(`catalog ${id} Hindi body still has a leading/trailing variable`);
  }
}

const types = read('server/src/modules/templates/types.ts');
if (!types.includes('export function templateTextHasEdgeParams')) {
  throw new Error('types.ts missing templateTextHasEdgeParams');
}

const store = read('server/src/modules/templates/catalog-store.ts');
if (!store.includes('assertLibraryCopySafe')) {
  throw new Error('catalog-store missing assertLibraryCopySafe');
}
if (!store.includes('!templateTextHasEdgeParams(entry.body)')) {
  throw new Error('edge-param patch can overwrite with another broken seed body');
}

const routes = read('server/src/modules/templates/routes.ts');
if (!routes.includes('unusableTemplateButtonUrl')) {
  throw new Error('catalog submit does not block unusable button URLs');
}
if (!routes.includes('META_TEMPLATE_REJECTED') || !routes.includes('MetaApiError')) {
  throw new Error('catalog submit does not map Graph rejects to 400 MetaApiError');
}

const meta = read('server/src/modules/whatsapp/meta.service.ts');
if (!meta.includes('error_user_msg')) {
  throw new Error('formatGraphErrorMessage does not read error_user_msg');
}
if (!meta.includes('without a readable error')) {
  throw new Error('createMessageTemplate still crashes on non-JSON Graph bodies');
}

const lib = read('client/src/utils/templateLibrary.ts');
if (!lib.includes("host === 'github.com'") || !lib.includes('usableLibraryButtonUrl')) {
  throw new Error('client library URL helper missing GitHub block or usable prefills');
}

const review = read('client/src/components/templates/library/TemplateLibraryReviewStep.tsx');
if (!review.includes('Button website') || !review.includes('Variables — fill later')) {
  throw new Error('Review step still mixes button URL with body variables');
}

const page = read('client/src/pages/TemplateLibraryPage.tsx');
if (!page.includes('Upload a sample image, video, or PDF')) {
  throw new Error('Library submit does not require sample media for media headers');
}

const copy = read('client/src/utils/templateIssueCopy.ts');
if (!copy.includes('leading or trailing params')) {
  throw new Error('issue copy missing Meta trailing-variable mapping');
}

if (bodies.length < 30 || bodiesHi.length < 30) {
  throw new Error(`catalog body counts too low en=${bodies.length} hi=${bodiesHi.length}`);
}

console.log(
  `catalog audit verification passed (${bodies.length} en bodies, ${authIndexes.size} auth skipped)`,
);
