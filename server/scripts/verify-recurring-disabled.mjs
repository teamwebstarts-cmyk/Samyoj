#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const routes = read('server/src/modules/billing/ai-credits/routes.ts');
const recurringRouteCount = (routes.match(/RECURRING_ADDONS_UNAVAILABLE/g) || []).length;
if (recurringRouteCount < 3) {
  console.error(`recurring-disabled-missing:routes:RECURRING_ADDONS_UNAVAILABLE count=${recurringRouteCount}`);
  process.exit(1);
}

const clientChecks = [
  ['client/src/components/billing/AiAddonGrid.tsx', ['Subscribe monthly', 'onSubscribeRecurring']],
  ['client/src/pages/BillingPage.tsx', ['handleSubscribeRecurring', 'openRazorpaySubscriptionCheckout']],
];

for (const [rel, forbidden] of clientChecks) {
  const text = read(rel);
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      console.error(`recurring-disabled-forbidden:${rel}:${needle}`);
      process.exit(1);
    }
  }
}

console.log('recurring-disabled-ok');
