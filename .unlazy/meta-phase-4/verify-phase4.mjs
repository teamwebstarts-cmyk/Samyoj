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

const sidebar = read('client/src/components/layout/Sidebar.tsx');
must(sidebar.includes('parentActive = childActive && !open'), 'parent must not be --active while open');
must(sidebar.includes('WhatsAppGlyph'), 'WhatsApp parent must use brand glyph');
must(sidebar.includes('sidebar-dropdown'), 'dropdown wrapper missing for exclusive highlight');
must(sidebar.includes("glyph={section.accent === 'whatsapp' ? 'whatsapp' : undefined}"), 'collapsed WhatsApp glyph missing');

const css = read('client/src/index.css');
must(
  css.includes('.sidebar-dropdown:has(.sidebar-nav-item--active) > button.sidebar-nav-item'),
  'CSS exclusive parent highlight missing'
);

const nav = read('client/src/config/navigation.ts');
must(nav.includes("to: '/instagram/inbox'"), 'Instagram Inbox nav missing');
must(nav.includes("to: '/instagram/comments'"), 'Instagram Comments nav missing');
must(!/\/instagram\/posts/.test(nav), 'Posts must not ship in Phase 4');
must(!/\/instagram\/reels/.test(nav), 'Reels must not ship in Phase 4');
must(!/label:\s*'Leads'/.test(nav), 'Leads must not be a sidebar option');
must(!/ads_management/.test(nav), 'Ads must not appear in nav');

const app = read('client/src/App.tsx');
must(app.includes('InstagramInboxPage'), 'App missing Instagram inbox route');
must(app.includes('InstagramCommentsPage'), 'App missing Instagram comments route');
must(app.includes("path=\"/instagram/inbox\""), 'inbox path missing');
must(app.includes("path=\"/instagram/comments\""), 'comments path missing');

const api = read('client/src/services/api.ts');
must(api.includes('export const instagramApi'), 'instagramApi missing');
must(api.includes('/instagram/connect'), 'connect client missing');
must(api.includes('/instagram/comments'), 'comments client missing');
must(api.includes('private-reply'), 'private-reply client missing');

const settings = read('client/src/pages/SettingsPage.tsx');
must(settings.includes("id: 'instagram'"), 'Settings Instagram tab missing');
must(settings.includes('InstagramPagePanel'), 'Instagram settings panel missing');
must(settings.includes('instagramApi.connect'), 'Settings connect not wired');

const automations = read('client/src/pages/AutomationsPage.tsx');
must(automations.includes("config.platform = 'IG'"), 'IG keyword platform not saved');
must(automations.includes("label: 'Instagram'"), 'channel picker missing Instagram');
must(automations.includes("form.platform !== 'IG'"), 'IG must not get WhatsApp buttons/test send');

const igInbox = read('client/src/pages/InstagramInboxPage.tsx');
must(igInbox.includes('variant="instagram"'), 'IG inbox chrome variant missing');
must(!igInbox.includes('onOpenTemplate'), 'IG composer must not wire WhatsApp templates');

const commentsPage = read('client/src/pages/InstagramCommentsPage.tsx');
must(commentsPage.includes('privateReply'), 'comments private reply UI missing');
must(commentsPage.includes('Reply sent. Waiting for them.'), 'one-shot copy missing');

const engine = read('server/src/modules/automation/engine.ts');
must(engine.includes("=== 'IG'") && engine.includes('continue'), 'WA engine must skip IG keywords');

const oauth = read('server/src/modules/facebook/connect-oauth-state.ts');
must(oauth.includes('instagram_manage_comments'), 'comment scope missing');
must(oauth.includes('instagram_manage_messages'), 'message scope missing');
must(!oauth.includes('ads_management'), 'Phase 5 ads scope must not ship');

const schema = read('server/prisma/schema.prisma');
must(schema.includes('model InstagramComment'), 'InstagramComment model missing');
must(schema.includes('privateReplySentAt'), 'one-shot private reply column missing');

const index = read('server/src/index.ts');
must(index.includes("/api/instagram"), 'API mount missing');

const inboxRoutes = read('server/src/modules/instagram/inbox.routes.ts');
must(inboxRoutes.includes("platform: 'IG'"), 'IG inbox must filter platform IG');
must(inboxRoutes.includes('sendInstagramTextMessage'), 'IG send must use Page IG client');
must(!inboxRoutes.includes('MetaWhatsAppService.sendMessage'), 'IG must not send via WhatsApp Cloud API');

const vitest = spawnSync(
  'npx',
  ['vitest', 'run', 'src/modules/instagram/instagram.test.ts'],
  {
    cwd: path.join(root, 'server'),
    encoding: 'utf8',
    env: { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' },
  }
);
const out = `${vitest.stdout || ''}${vitest.stderr || ''}`;
if (vitest.status !== 0) {
  process.stderr.write(out);
  process.exit(vitest.status || 1);
}
if (!/Tests\s+\d+\s+passed/.test(out) && !/✓/.test(out)) {
  process.stderr.write(out);
  process.stderr.write('\nPhase 4 verify: vitest did not report passes\n');
  process.exit(1);
}

process.stdout.write('PHASE4_INSTAGRAM_OK\n');
