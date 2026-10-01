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

must('server/src/modules/instagram/comment-sync.ts', [
  { name: 'redis NX lock', re: /withInstagramCommentSyncLock/ },
  { name: 'SET NX', re: /redis\.set\([^\n]+'NX'\)/ },
]);

must('server/src/modules/instagram/comments.routes.ts', [
  { name: 'sync uses lock', re: /withInstagramCommentSyncLock/ },
  { name: '409 when busy', re: /409/ },
]);

must('server/src/modules/instagram/comment-ingest.ts', [
  { name: 'private claim', re: /privateReplySentAt: null/ },
  { name: 'public claim', re: /publicReplySentAt: null/ },
]);

must('client/src/pages/InstagramCommentsPage.tsx', [
  { name: 'sendReply busyRef', re: /const sendReply[\s\S]*?if \(busyRef\.current\) return/ },
  { name: 'syncingRef', re: /if \(syncingRef\.current\) return/ },
]);

console.log('comment guard verification passed');
