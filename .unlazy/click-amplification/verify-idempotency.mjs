#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function must(rel, tests) {
  const src = read(rel);
  for (const test of tests) {
    if (!test.re.test(src)) {
      console.error(`${rel}: missing ${test.name}`);
      process.exit(1);
    }
  }
}

must('server/src/modules/instagram/inbox.routes.ts', [
  { name: 'replayOutboundIfKeyed', re: /replayOutboundIfKeyed/ },
  { name: 'findMessageByIdempotencyKey', re: /findMessageByIdempotencyKey/ },
  { name: 'store idempotencyKey', re: /idempotencyKey,/ },
]);

must('server/src/modules/facebook/messenger-inbox.routes.ts', [
  { name: 'replayOutboundIfKeyed', re: /replayOutboundIfKeyed/ },
  { name: 'findMessageByIdempotencyKey', re: /findMessageByIdempotencyKey/ },
  { name: 'store idempotencyKey', re: /idempotencyKey,/ },
]);

must('server/src/modules/facebook/channel-inbox-actions.ts', [
  { name: 'media replay', re: /findMessageByIdempotencyKey/ },
  { name: 'media store key', re: /idempotencyKey/ },
]);

must('client/src/services/api.ts', [
  { name: 'instagram send key', re: /instagram[\s\S]*?send: \(id: string, content: string, idempotencyKey/ },
  { name: 'facebook send key', re: /facebook[\s\S]*?send: \(id: string, content: string, idempotencyKey/ },
]);

must('client/src/pages/InstagramInboxPage.tsx', [
  { name: 'stable key ref', re: /idempotencyKeyRef/ },
  { name: 'pass key to send', re: /instagramApi\.inbox\.send\(selectedId, text, idempotencyKeyRef\.current\)/ },
]);

must('client/src/pages/FacebookInboxPage.tsx', [
  { name: 'stable key ref', re: /idempotencyKeyRef/ },
  { name: 'pass key to send', re: /facebookApi\.inbox\.send\(selectedId, text, idempotencyKeyRef\.current\)/ },
]);

console.log('inbox idempotency verification passed');
