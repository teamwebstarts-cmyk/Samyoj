#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

function must(cond, msg) {
  if (!cond) {
    process.stderr.write(`${msg}\n`);
    process.exit(1);
  }
}

const oauth = read('server/src/modules/facebook/connect-oauth-state.ts');
const scopeBlock = oauth.slice(
  oauth.indexOf('export const FACEBOOK_PAGE_LEADGEN_SCOPES'),
  oauth.indexOf('.join')
);
must(scopeBlock.includes("'ads_read'"), 'OAuth must request ads_read');
must(!scopeBlock.includes('ads_management'), 'ads_management must stay out');

const routes = read('server/src/modules/facebook/routes.ts');
must(routes.includes("'/ads-summary'"), 'ads summary route missing');
must(!/router\.post\(\s*'\/ads/.test(routes), 'ads routes must not POST');

const insights = read('server/src/modules/facebook/ads-insights.ts');
must(insights.includes('7-day click / 1-day view'), 'attribution label missing');
must(insights.includes('last_7d') || read('server/src/modules/facebook/page-client.ts').includes('last_7d'), 'last 7 days preset missing');
must(insights.includes("return 'no_account'"), 'missing account must not become zeros');
must(!insights.includes('activatePlan'), 'ads snapshot must not touch plan price');
must(!insights.includes('ads_management'), 'insights client must not manage ads');

const page = read('client/src/pages/FacebookAdsPage.tsx');
must(page.includes('Ads performance'), 'title missing');
must(page.includes("Meta's numbers. Not Samyoj revenue."), 'caption missing');
must(page.includes('Open Ads Manager'), 'Ads Manager link missing');
must(!/Create campaign|Pause ad|ads_management/i.test(page), 'page must not create or pause ads');

const recap = read('client/src/components/dashboard/MetaAdsRecap.tsx');
must(recap.includes('facebookApi.adsSummary'), 'dashboard must use the same ads summary');
must(recap.includes('if (!snap) return null'), 'dashboard must hide recap until a snapshot exists');

const nav = read('client/src/config/navigation.ts');
must(nav.includes("to: '/facebook/ads'") && nav.includes("label: 'Ads'"), 'Facebook → Ads nav missing');
must(!/\/instagram\/posts/.test(nav), 'Posts must stay out');

const app = read('client/src/App.tsx');
must(app.includes('path="/facebook/ads"'), 'ads route missing');

const migration = read('server/prisma/migrations/20260924120000_meta_ads_snapshot/migration.sql');
must(migration.includes('meta_ads_snapshots'), 'snapshot table missing');

const vitest = spawnSync('npx', ['vitest', 'run', 'src/modules/facebook/ads-insights.test.ts', 'src/modules/facebook/connect-oauth-state.test.ts'], {
  cwd: path.join(root, 'server'),
  encoding: 'utf8',
  env: { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' },
});
const out = `${vitest.stdout || ''}${vitest.stderr || ''}`;
if (vitest.status !== 0) {
  process.stderr.write(out);
  process.exit(vitest.status || 1);
}
if (!/Tests\s+\d+\s+passed/.test(out) && !/✓/.test(out)) {
  process.stderr.write(out);
  process.exit(1);
}

process.stdout.write('PHASE5_ADS_OK\n');
