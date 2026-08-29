#!/usr/bin/env node
/**
 * Live-stack smoke for growth surfaces. Auth is fail-closed (401/403), not 500.
 */
const targets = [
  { url: 'http://localhost:8000/api/whatsapp/webhook/health', expect: 200 },
  { url: 'http://localhost:3000/', expect: 200 },
  { url: 'http://localhost:3001/', expect: 200 },
  { url: 'http://localhost:8000/api/analytics/overview', expectAuth: true },
  { url: 'http://localhost:8000/api/campaigns/quota', expectAuth: true },
  { url: 'http://localhost:8000/api/templates/starters', expectAuth: true },
  { url: 'http://localhost:8000/api/inbox?window=open', expectAuth: true },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

for (const target of targets) {
  try {
    const response = await fetch(target.url, { redirect: 'manual' });
    if (target.expectAuth) {
      if (response.status !== 401 && response.status !== 403) {
        fail(`${target.url} returned ${response.status}, expected 401 or 403`);
      }
      continue;
    }
    if (response.status !== target.expect) {
      fail(`${target.url} returned ${response.status}, expected ${target.expect}`);
    }
  } catch (error) {
    fail(`${target.url} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const health = await fetch('http://localhost:8000/api/whatsapp/webhook/health');
const body = await health.json();
if (!body?.success || body?.data?.webhookConfigured !== true) {
  fail('webhook health is not configured');
}

console.log('growth-surfaces local verification passed');
