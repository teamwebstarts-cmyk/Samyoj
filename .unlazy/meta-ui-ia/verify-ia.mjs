import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const doc = readFileSync(join(root, 'docs/meta-ecosystem/META_ECOSYSTEM_UI_BY_PHASE_2026-09-22.md'), 'utf8');

const need = [
  'Separate inboxes',
  'Campaigns stay under WhatsApp',
  'Contacts stay outside',
  'Automations stay outside',
  'Ads sit under Facebook',
  'AI Bots keep both',
  'X is out',
  'Wati',
  'Respond.io',
  'Facebook Page',
  'Settings keeps connect',
];

const missing = need.filter((s) => !doc.includes(s));
if (missing.length) {
  console.error('missing: ' + missing.join(', '));
  process.exit(1);
}

if (/chosen:\s*one mixed inbox/i.test(doc)) {
  console.error('mixed inbox still marked chosen');
  process.exit(1);
}

console.log('IA_DOC_OK');
