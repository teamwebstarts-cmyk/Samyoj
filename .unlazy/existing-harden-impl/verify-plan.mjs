import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const planPath = path.join(root, 'docs/IMPLEMENTATION_PLAN_EXISTING_15D.md');
const text = fs.readFileSync(planPath, 'utf8');

function requireAll(label, items) {
  const missing = items.filter((item) => !text.includes(item));
  if (missing.length > 0) {
    throw new Error(`${label}: missing ${missing.join(', ')}`);
  }
}

if (process.argv.includes('--no-new-products')) {
  requireAll('forbidden product names as work packets', [
    'OUT OF SCOPE',
    'Embedded Signup',
    'Razorpay Subscriptions',
    'Lead Ads',
    'real Content Studio providers',
  ]);
  if (/Packet.*Embedded Signup v4 SDK/i.test(text)) {
    throw new Error('plan must not schedule Embedded Signup as an implementation packet');
  }
  console.log('existing-harden-no-new-products-ok');
  process.exit(0);
}

if (process.argv.includes('--packets')) {
  requireAll('packets', [
    'webhook',
    'EVENT_RECEIVED',
    'Idempotency',
    'dedupeRecipients',
    'campaignSendConfirm',
    '1000',
    'db:backup',
    'db:restore',
  ]);
  console.log('existing-harden-packets-ok');
  process.exit(0);
}

requireAll('core sections', [
  'OUT OF SCOPE',
  'Packet A',
  'Packet B',
  'Packet C',
  'Packet D',
  'Packet E',
  'Packet F',
  'Manual',
  'campaignSendConfirm',
  'routes.ts',
  'must-tick',
]);
console.log('existing-harden-plan-ok');
