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

must('client/src/pages/email/EmailComposePage.tsx', [
  { name: 'sendingRef', re: /sendingRef\.current/ },
  { name: 'early return while sending', re: /if \(!eligible \|\| !recipients\[0\] \|\| sendingRef\.current\) return/ },
]);

must('client/src/components/inbox/useInboxSender.ts', [
  { name: 'sendingRef', re: /sendingRef\.current/ },
  { name: 'handleSend lock', re: /if \(sendingRef\.current\) return false/ },
]);

must('client/src/pages/InstagramInboxPage.tsx', [
  { name: 'sendingRef', re: /sendingRef\.current/ },
  { name: 'onSend lock', re: /if \(sendingRef\.current\) return/ },
]);

must('client/src/pages/FacebookInboxPage.tsx', [
  { name: 'sendingRef', re: /sendingRef\.current/ },
  { name: 'onSend lock', re: /if \(sendingRef\.current\) return/ },
]);

must('client/src/pages/InstagramCommentsPage.tsx', [
  { name: 'busyRef', re: /busyRef\.current/ },
  { name: 'syncingRef', re: /syncingRef\.current/ },
]);

must('client/src/pages/InstagramPostsPage.tsx', [
  { name: 'savingRef', re: /savingRef\.current/ },
]);

must('client/src/pages/CallsPage.tsx', [
  { name: 'callingBackRef', re: /callingBackRef\.current/ },
]);

must('client/src/components/inbox/useConversationActions.ts', [
  { name: 'callingBackRef', re: /callingBackRef\.current/ },
]);

must('client/src/components/ui/ConfirmDialog.tsx', [
  { name: 'confirm inFlightRef', re: /inFlightRef\.current/ },
]);

console.log('click lock verification passed');
