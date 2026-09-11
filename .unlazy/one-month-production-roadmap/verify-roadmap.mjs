import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const roadmapPath = path.join(root, 'docs/EXECUTIVE_GAP_ANALYSIS_AND_ROADMAP_2026.md');
const text = fs.readFileSync(roadmapPath, 'utf8');

const required = [
  'Executive decision summary',
  'Operating envelope',
  'Current-state feature matrix',
  'Week 1',
  'Week 2',
  'Week 3',
  'Week 4',
  'Backend/database reliability',
  'Frontend and platform-admin',
  'Razorpay',
  'AI credit ledger',
  'Embedded Signup',
  'Ads/CTWA/Lead Ads',
  'WhatsApp Forms/Flows and orders',
  'Content Studio',
  'Competitive analysis',
  'Risk register',
  'Evidence register',
  'Not this month',
];

const missing = required.filter((item) => !text.toLowerCase().includes(item.toLowerCase()));
if (missing.length > 0) {
  throw new Error(`missing roadmap sections: ${missing.join(', ')}`);
}

if (process.argv.includes('--sources')) {
  const sourceUrls = [
    'https://razorpay.com/docs/payments/subscriptions/integration-guide',
    'https://razorpay.com/docs/payments/subscriptions/subscribe-to-webhooks',
    'https://developers.facebook.com/docs/whatsapp/embedded-signup/',
    'https://developers.facebook.com/docs/marketing-api/guides/lead-ads/',
    'https://cbic-gst.gov.in/gst-invoice-rules.html',
  ];
  const missingSources = sourceUrls.filter((url) => !text.includes(url));
  if (missingSources.length > 0) {
    throw new Error(`missing source URLs: ${missingSources.join(', ')}`);
  }
  if (!text.includes('Samyoj SaaS') || !text.includes('Meta WABA') || !text.includes('Meta Ads')) {
    throw new Error('three billing ledgers are not explicitly separated');
  }
  console.log('roadmap-source-verification-passed');
  process.exit(0);
}

if (process.argv.includes('--honesty')) {
  const honestyTerms = [
    'Live-unverified',
    'Blocked/external gate',
    'Stub/demo',
    'Deferred/not this month',
    'not customer-production ready',
    'manual gate',
  ];
  const missingHonesty = honestyTerms.filter((item) => !text.toLowerCase().includes(item.toLowerCase()));
  if (missingHonesty.length > 0) {
    throw new Error(`missing honesty markers: ${missingHonesty.join(', ')}`);
  }
  if (/customer production[^.\n]*(ready|go-live)/i.test(text) && !/not customer production[^.\n]*(ready|go-live)/i.test(text)) {
    throw new Error('roadmap contains an unqualified customer-production readiness claim');
  }
  console.log('roadmap-honesty-verification-passed');
  process.exit(0);
}

if (process.argv.includes('--tracks')) {
  const tracks = [
    'backend',
    'frontend',
    'admin',
    'billing',
    'Meta',
    'Content Studio',
    'competitive',
    'testing',
    'backup',
    'observability',
  ];
  const missingTracks = tracks.filter((item) => !text.toLowerCase().includes(item.toLowerCase()));
  if (missingTracks.length > 0) {
    throw new Error(`missing roadmap tracks: ${missingTracks.join(', ')}`);
  }
  for (const week of ['Week 1', 'Week 2', 'Week 3', 'Week 4']) {
    if (!text.includes(week)) throw new Error(`missing sequence marker: ${week}`);
  }
  console.log('roadmap-track-verification-passed');
  process.exit(0);
}

console.log('roadmap-verification-passed');
