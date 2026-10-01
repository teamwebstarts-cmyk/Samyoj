import { readFileSync } from 'node:fs';
import { dedupeLatestSendPerEmail, filterRecentSends, priorSendsFor } from '../src/pages/email/emailList.ts';

const mode = process.argv[2];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (mode === 'functions') {
  const sends = [
    { id: 's1', name: 'Rohit Sharma', email: 'rohit.sharma@gmail.com', subject: 'Order', status: 'ACCEPTED' },
    { id: 's3', name: 'Amit Kumar', email: 'amit.kumar@gmail.com', subject: 'Pricing', status: 'FAILED' },
  ];
  const hit = filterRecentSends(sends, 'rohit', 'ALL');
  const miss = filterRecentSends(sends, 'zzz-not-a-person', 'ALL');
  const failedOnly = filterRecentSends(sends, '', 'FAILED');
  const prior = priorSendsFor(sends, 'Amit.Kumar@gmail.com');
  const priorMiss = priorSendsFor(sends, 'nobody@example.com');
  if (hit.length !== 1 || hit[0].id !== 's1') fail('name filter missed Rohit');
  if (miss.length !== 0) fail('unknown query should be empty');
  if (failedOnly.length !== 1 || failedOnly[0].id !== 's3') fail('failed filter missed Amit');
  if (prior.length !== 1 || prior[0].id !== 's3') fail('prior mail missed case-insensitive email');
  if (priorMiss.length !== 0) fail('unknown email should have no prior mail');
  const dupes = dedupeLatestSendPerEmail([
    { id: 'a', email: 'x@y.com', createdAt: '2026-01-01T00:00:00.000Z', subject: 'old' },
    { id: 'b', email: 'x@y.com', createdAt: '2026-01-02T00:00:00.000Z', subject: 'new' },
  ]);
  if (dupes.length !== 1 || dupes[0].id !== 'b') fail('dedupe should keep latest send per email');
  console.log('email list verification passed');
} else if (mode === 'wiring') {
  const root = new URL('../..', import.meta.url);
  const read = (rel) => readFileSync(new URL(rel, root), 'utf8');
  const compose = read('client/src/pages/email/EmailComposePage.tsx');
  const templates = read('client/src/pages/email/EmailTemplatesPage.tsx');
  const dashboard = read('client/src/pages/email/EmailDashboardPage.tsx');
  const topbar = read('client/src/components/layout/AppTopbar.tsx');
  const checks = [
    [compose.includes('useEmailTemplates('), 'compose does not read shared templates'],
    [compose.includes('filterRecentSends('), 'compose does not filter the sent list'],
    [compose.includes('dedupeLatestSendPerEmail'), 'compose does not compact the sent sidebar'],
    [!compose.includes('MOCK_TEMPLATES.map'), 'compose still lists the static template array'],
    [templates.includes('upsertEmailTemplate('), 'templates page does not save into the shared store'],
    [templates.includes('useEmailTemplates('), 'templates page does not read the shared store'],
    [dashboard.includes('recentSends.filter((send) => send.status'), 'dashboard counts ignore the saved list'],
    [topbar.includes('email: MOCK_MAILBOX.connected'), 'top bar still hardcodes email as disconnected'],
  ];
  for (const [ok, message] of checks) {
    if (!ok) fail(message);
  }
  console.log('email wiring verification passed');
} else {
  fail('usage: node client/scripts/verify-email-polish.mjs functions|wiring');
}
