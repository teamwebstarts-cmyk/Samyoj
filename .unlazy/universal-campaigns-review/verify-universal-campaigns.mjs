import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const docPath = resolve(root, 'docs/product/UNIVERSAL_CAMPAIGNS_REVIEW_2026-09-30.md');
const briefPath = resolve(root, 'docs/product/UNIVERSAL_CAMPAIGNS_REVIEW_BRIEF_2026-09-30.md');
const navPath = resolve(root, 'client/src/config/navigation.ts');
const doc = () => readFileSync(docPath, 'utf8');
const brief = () => readFileSync(briefPath, 'utf8');
const nav = () => readFileSync(navPath, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mode = process.argv[2];
if (!mode) throw new Error('mode is required');

if (mode === 'document') {
  const source = doc();
  for (const marker of [
    'Current implementation',
    'Official capability review',
    'Universal campaign recommendation',
    'WhatsApp-specific assumption inventory',
    'https://developers.facebook.com/',
    'https://developers.google.com/',
    'CampaignsPage.tsx',
    'server/src/modules/campaigns/routes.ts',
    'schema.prisma',
  ]) {
    assert(source.includes(marker), `missing document marker: ${marker}`);
  }
  console.log('universal campaigns document verification passed');
} else if (mode === 'boundaries') {
  const source = doc();
  for (const marker of [
    'Current code',
    'Provider capability',
    'Recommendation',
    'Unknowns and external gates',
    'not a general follower broadcast',
    'Gmail can report provider acceptance and failure, not delivery/read',
  ]) {
    assert(source.includes(marker), `missing boundary marker: ${marker}`);
  }
  console.log('universal campaigns boundary verification passed');
} else if (mode === 'navigation') {
  const source = nav();
  const whatsappStart = source.indexOf("label: 'WhatsApp'");
  const facebookStart = source.indexOf("label: 'Facebook'");
  const contactsStart = source.indexOf("label: 'Contacts'");
  assert(whatsappStart >= 0 && facebookStart > whatsappStart, 'WhatsApp navigation block not found');
  assert(contactsStart > 0, 'Contacts navigation block not found');
  const whatsappBlock = source.slice(whatsappStart, facebookStart);
  const contactsBlock = source.slice(contactsStart);
  assert(!whatsappBlock.includes("to: '/campaigns'"), 'Campaigns remains under WhatsApp');
  assert(contactsBlock.includes("to: '/campaigns'"), 'Campaigns is missing under Contacts');
  assert(source.includes("to: '/campaigns/new'") || source.includes("to: '/campaigns'"), 'campaign route reference missing');
  console.log('universal campaigns navigation verification passed');
} else if (mode === 'brief') {
  const source = brief();
  for (const marker of [
    'Honest verdict',
    'WhatsApp — supported first',
    'Facebook Messenger — triggered messaging, not broadcast',
    'Instagram — conversation and comment triggers',
    'Email/Gmail — possible, but not ready as Campaigns',
    'What we should not build',
    'Decisions needed before implementation',
  ]) {
    assert(source.includes(marker), `missing brief marker: ${marker}`);
  }
  console.log('universal campaigns brief verification passed');
} else {
  throw new Error(`unknown mode: ${mode}`);
}
