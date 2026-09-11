import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function walkTsx(dir, hits) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      walkTsx(full, hits);
      continue;
    }
    if (!name.name.endsWith('.tsx')) continue;
    const text = fs.readFileSync(full, 'utf8');
    if (/App Secret|appSecret/.test(text) && !name.name.endsWith('.test.tsx')) {
      hits.push(path.relative(root, full));
    }
  }
}

if (process.argv.includes('--stubs')) {
  for (const rel of [
    'server/src/modules/content-studio/images/routes.ts',
    'server/src/modules/content-studio/videos/routes.ts',
    'server/src/modules/content-studio/voices/routes.ts',
  ]) {
    const text = read(rel);
    if (text.includes("status: 'SUCCEEDED'")) {
      throw new Error(`${rel} still marks generation SUCCEEDED`);
    }
    if (/\bawait recordUsage\b/.test(text) || /const \{ recordUsage \}/.test(text)) {
      throw new Error(`${rel} still records usage`);
    }
    if (!text.includes('Not billed')) {
      throw new Error(`${rel} missing not-billed stub failure copy`);
    }
  }
  console.log('packet-a-stubs-ok');
  process.exit(0);
}

const integrations = read('client/src/components/settings/IntegrationsPanel.tsx');
if (integrations.includes('Full backup')) {
  throw new Error('IntegrationsPanel still says Full backup');
}
if (!integrations.includes('not a restorable server backup')) {
  throw new Error('IntegrationsPanel missing restorable disclaimer');
}

const billing = read('client/src/pages/BillingPage.tsx');
if (/GST Paid|SAC 998315/.test(billing)) {
  throw new Error('BillingPage still fabricates GST invoice labels');
}
if (!billing.includes('not a GST invoice')) {
  throw new Error('BillingPage must say payment is not a GST invoice');
}

const admin = read('admin/src/pages/BillingConfigPage.tsx');
if (admin.includes('live Razorpay recurring SKUs')) {
  throw new Error('admin still claims live recurring SKUs');
}
if (!admin.includes('Recurring Razorpay checkout is not live')) {
  throw new Error('admin missing not-live recurring copy');
}

const send = read('client/src/components/campaigns/campaignSendConfirm.ts');
if (!send.includes('Campaign must have at least one recipient')) {
  throw new Error('campaignSendConfirm missing empty-audience mapping');
}

const studio = read('client/src/pages/ContentStudioPage.tsx');
if (/still use today.?s video-second budget/i.test(studio)) {
  throw new Error('ContentStudio still claims stubs use budget');
}
if (!studio.includes('Image jobs queue as stubs')) {
  throw new Error('ContentStudio missing image stub warning');
}

const secretHits = [];
walkTsx(path.join(root, 'client/src/pages'), secretHits);
walkTsx(path.join(root, 'client/src/components'), secretHits);
if (secretHits.length) {
  throw new Error(`Settings/UI still mentions App Secret: ${secretHits.join(', ')}`);
}

const api = read('client/src/services/api.ts');
if (api.includes('updateMetaConfig')) {
  throw new Error('dead updateMetaConfig PATCH still on the client');
}

console.log('packet-a-honesty-ok');
