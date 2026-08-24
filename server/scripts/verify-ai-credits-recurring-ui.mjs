#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const checks = [
  ['client/src/components/billing/AiAddonGrid.tsx', ['Monthly recurring add-ons', 'onSubscribeRecurring', 'Subscribe monthly']],
  ['client/src/pages/BillingPage.tsx', ['handleSubscribeRecurring', 'subscribeAiRecurringAddon', 'cancelAiRecurringAddon']],
  ['client/src/utils/razorpay.ts', ['openRazorpaySubscriptionCheckout', 'subscription_id']],
  ['server/src/modules/billing/ai-credits/recurring.service.ts', ['handleRecurringSubscriptionWebhook', 'grantRecurringAddonCharge']],
];

for (const [rel, needles] of checks) {
  const file = path.join(root, rel);
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) {
      console.error(`recurring-ui-missing:${rel}:${needle}`);
      process.exit(1);
    }
  }
}

console.log('recurring-ui-ok');
