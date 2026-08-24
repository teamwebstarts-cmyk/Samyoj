#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.resolve(import.meta.dirname, '../src/modules/billing/ai-credits/catalog.ts');
const catalog = fs.readFileSync(catalogPath, 'utf8');

if (!catalog.includes('chatCreditsIncluded: 5_000') || !catalog.includes('callingMinutesIncluded: 120')) {
  console.error('catalog-allowances-mismatch');
  process.exit(1);
}

const skuMatches = catalog.match(/id: 'ai_/g) ?? [];
if (skuMatches.length < 6) {
  console.error('catalog-sku-count-mismatch');
  process.exit(1);
}

console.log('balances-ok');
