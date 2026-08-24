#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const checks = [
  ['client/src/pages/BillingPage.tsx', ['AiAddonGrid', 'aiCredits', 'handlePurchaseAddon']],
  ['client/src/components/billing/BillingUsageStatsTab.tsx', ['BillingAiCreditMeter', 'aiCredits']],
  ['client/src/components/billing/AiAddonGrid.tsx', ['Coming soon', 'ai-addons']],
];

for (const [rel, needles] of checks) {
  const file = path.join(root, rel);
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) {
      console.error(`billing-ui-missing:${rel}:${needle}`);
      process.exit(1);
    }
  }
}

console.log('billing-ui-ok');
