#!/usr/bin/env node
/**
 * AUD-G9 — coexistence send throttle is Redis-backed with in-memory fallback.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(
  join(root, 'server/src/modules/whatsapp/coexistence/send-throttle.ts'),
  'utf8'
);

if (!src.includes('getRedis') || !/eval\(/.test(src)) {
  console.error('FAIL: send-throttle is not Redis-backed (missing getRedis/eval)');
  process.exit(1);
}

if (!src.includes('whatsappNumberId')) {
  console.error('FAIL: throttle key is not per whatsappNumberId');
  process.exit(1);
}

if (!/catch/.test(src) || !/acquireMemory|memory|buckets/.test(src)) {
  console.error('FAIL: send-throttle has no in-memory fallback when Redis is down');
  process.exit(1);
}

if (!src.includes('COEXISTENCE_SEND_RATE_PER_SEC') || !src.includes('20')) {
  console.error('FAIL: 20 msg/sec coexistence cap missing');
  process.exit(1);
}

console.log('coex_redis_throttle_ok');
