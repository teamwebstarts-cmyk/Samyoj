#!/usr/bin/env node
/**
 * Structure oracle for docs/learning/META_BUSINESS_PLATFORM_MASTER_GUIDE_2026.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const guidePath = path.join(root, 'docs/learning/META_BUSINESS_PLATFORM_MASTER_GUIDE_2026.md');

const args = process.argv.slice(2);
function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}
const minUrls = Number(flagValue('--min-urls') || '25');
const requireSection = flagValue('--require-section');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(guidePath)) fail(`missing guide: ${guidePath}`);
const text = fs.readFileSync(guidePath, 'utf8');
if (text.trim().length < 8000) fail(`guide too short: ${text.length} chars`);

const requiredHeadings = [
  'Samyoj current Meta surface',
  'Pricing',
  'Test vs Live',
  'Ban',
  'Onboarding',
  'Instagram',
  'Messenger',
  'Quiz',
  'Sources',
];
for (const h of requiredHeadings) {
  if (!text.toLowerCase().includes(h.toLowerCase())) fail(`missing section cue: ${h}`);
}

if (requireSection && !text.toLowerCase().includes(requireSection.toLowerCase())) {
  fail(`missing required section: ${requireSection}`);
}

const urls = [...text.matchAll(/https?:\/\/[^\s\)\]>`"']+/g)].map((m) => m[0].replace(/[.,;]+$/, ''));
const unique = new Set(urls);
if (unique.size < minUrls) fail(`need >= ${minUrls} unique URLs, found ${unique.size}`);

console.log('meta learning guide verification passed');
console.log(`chars=${text.length} urls=${unique.size}`);
