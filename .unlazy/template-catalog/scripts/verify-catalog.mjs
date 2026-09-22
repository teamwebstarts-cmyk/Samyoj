#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const mode = process.argv.includes('--ui')
  ? 'ui'
  : process.argv.includes('--unit')
    ? 'unit'
    : process.argv.includes('--admin')
      ? 'admin'
      : 'catalog';

function read(rel) {
  const path = resolve(root, rel);
  if (!existsSync(path)) throw new Error(`missing ${rel}`);
  return readFileSync(path, 'utf8');
}

if (mode === 'ui') {
  const browse = read('client/src/components/templates/library/TemplateLibraryBrowseStep.tsx');
  const page = read('client/src/pages/TemplateLibraryPage.tsx');
  if (/Add a template in one click/.test(browse) || /Add a template in one click/.test(page)) {
    throw new Error('Browse UI still shows Meta one-click copy');
  }
  if (/Meta \(\$\{metaCount\}\)|\bMeta \(100\)/.test(browse)) {
    throw new Error('Browse UI still shows Meta source tab');
  }
  if (!/templateApi\s*\.\s*starters/.test(page)) {
    throw new Error('Library page no longer loads Samyoj catalog');
  }
  if (!/submitCatalog/.test(page)) {
    throw new Error('Library page does not submit catalog drafts to this number');
  }
  if (/templateApi\.library\(/.test(page)) {
    throw new Error('Library page still fetches Meta template library');
  }
  if (!/cannot pre-approve/.test(page) && !/cannot pre-approve/.test(browse)) {
    throw new Error('Library UI missing honesty that Samyoj cannot pre-approve Meta');
  }
  console.log('catalog UI verification passed');
  process.exit(0);
}

if (mode === 'admin') {
  const schema = read('server/prisma/schema.prisma');
  const adminPage = read('admin/src/pages/TemplateCatalogPage.tsx');
  const adminApp = read('admin/src/App.tsx');
  const routes = read('admin/src/lib/routes.ts');
  const platformRoutes = read('server/src/modules/platform/routes.ts');
  if (!schema.includes('model PlatformLibraryTemplate')) {
    throw new Error('Prisma model PlatformLibraryTemplate missing');
  }
  if (!adminPage.includes('cannot pre-approve')) {
    throw new Error('Admin catalog page missing honesty copy');
  }
  if (!adminApp.includes('TemplateCatalogPage') || !adminApp.includes('path="/library"')) {
    throw new Error('Admin app does not mount /library');
  }
  if (!routes.includes("to: '/library'")) {
    throw new Error('Admin nav missing Templates item');
  }
  if (!platformRoutes.includes('/library-templates')) {
    throw new Error('Platform API missing library-templates routes');
  }
  console.log('catalog admin verification passed');
  process.exit(0);
}

if (mode === 'unit') {
  const result = spawnSync('npx', ['vitest', 'run', 'src/modules/templates/starters.test.ts'], {
    cwd: resolve(root, 'server'),
    encoding: 'utf8',
    env: { ...process.env, VITEST: 'true' },
  });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  process.stdout.write(out);
  if (result.status !== 0) process.exit(result.status || 1);
  console.log('catalog unit verification passed');
  process.exit(0);
}

const src = read('server/src/modules/templates/catalog.ts');
const curatedIds = [
  'hello_reply',
  'hello_welcome',
  'party_invitation',
  'marketing_update',
  'modern_status',
];
for (const id of curatedIds) {
  if (!src.includes(`id: '${id}'`)) {
    throw new Error(`expected curated catalog id ${id}`);
  }
}
const catalogSection = src.split('export const SAMYOJ_CATALOG')[1]?.split('];')[0] || '';
const templateCount = (catalogSection.match(/^\s*id:/gm) || []).length;
if (templateCount !== 5) {
  throw new Error(`expected exactly 5 catalog templates, found ${templateCount}`);
}
const filterCount = (src.match(/export const CATALOG_FILTERS[\s\S]*?] as const;/)[0]?.match(/id:\s*'/g) || [])
  .length;
if (filterCount !== 5) {
  throw new Error(`expected 5 catalog filters, found ${filterCount}`);
}
const hiCount = (catalogSection.match(/bodyHi:/g) || []).length;
if (hiCount !== 5) {
  throw new Error(`expected Hindi body on each template, found ${hiCount}`);
}
console.log(`catalog verification passed (${templateCount} templates, ${filterCount} filters)`);
