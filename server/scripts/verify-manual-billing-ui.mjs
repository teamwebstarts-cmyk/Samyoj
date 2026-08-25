#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function requireNeedles(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      console.error(`manual-billing-ui-missing:${rel}:${needle}`);
      process.exit(1);
    }
  }
}

function forbidNeedles(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (text.includes(needle)) {
      console.error(`manual-billing-ui-forbidden:${rel}:${needle}`);
      process.exit(1);
    }
  }
}

requireNeedles('client/src/components/billing/AiAddonGrid.tsx', [
  'InfoTip',
  'Buy add-on',
  'one-time manual purchases',
  'id="ai-addons"',
]);
forbidNeedles('client/src/components/billing/AiAddonGrid.tsx', [
  'Subscribe monthly',
  'onSubscribeRecurring',
  'quantity',
  'Cancel monthly',
]);

requireNeedles('client/src/components/billing/BillingCurrentPlanHero.tsx', [
  'Valid until',
  'no auto-renew',
]);
requireNeedles('client/src/components/billing/BillingPlanCard.tsx', [
  'Manual purchase',
]);
requireNeedles('client/src/pages/BillingPage.tsx', [
  'valid until the purchased period ends',
]);
forbidNeedles('client/src/pages/BillingPage.tsx', [
  'handleSubscribeRecurring',
  'subscribeAiRecurringAddon',
  'cancelAiRecurringAddon',
  'auto-renew',
]);

console.log('manual-billing-ui-ok');
