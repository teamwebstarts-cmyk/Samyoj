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
    throw new Error('Library page no longer loads the tenant library');
  }
  if (!/createFromLibrary/.test(page)) {
    throw new Error('Library page does not clone Meta library templates onto this number');
  }
  if (/templateApi\.library\(/.test(page)) {
    throw new Error('Library page still dumps the full Meta template library');
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

const src = read('server/src/modules/templates/meta-library-pack.ts');
const curatedIds = [
  'hello_world',
  'hello_account',
  'order_confirmation',
  'shipment_confirmation',
  'delivery_update',
  'payment_confirmation',
  'otp_login',
];
for (const id of curatedIds) {
  if (!src.includes(`id: '${id}'`)) {
    throw new Error(`expected Meta library pack id ${id}`);
  }
}
if (/party_invitation|marketing_update|hello_reply/.test(src)) {
  throw new Error('old Samyoj marketing drafts should not be in the Meta pack');
}
const packSection = src.split('export const META_LIBRARY_PACK')[1]?.split('];')[0] || '';
const templateCount = (packSection.match(/^\s*id:/gm) || []).length;
if (templateCount !== 7) {
  throw new Error(`expected exactly 7 Meta library templates, found ${templateCount}`);
}
console.log(`catalog verification passed (${templateCount} Meta pack templates)`);
