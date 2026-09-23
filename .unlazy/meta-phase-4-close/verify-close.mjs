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

const chips = read('client/src/components/layout/MetaChannelChips.tsx');
must(chips.includes('facebookApi.connectUrl'), 'Facebook connect missing');
must(chips.includes('instagramApi.connect'), 'Instagram connect missing');
must(chips.includes("orgRole === 'OWNER' || orgRole === 'ADMIN'"), 'connect must be admin-only');
must(!/META_APP|App Secret|appId/i.test(chips), 'no App ID/Secret on connect chips');
must(chips.includes("to=\"/facebook/inbox\""), 'connected Facebook chip must open inbox');
must(chips.includes("to=\"/instagram/inbox\""), 'connected Instagram chip must open inbox');
must(chips.includes("raw.startsWith('//')"), 'OAuth return must reject protocol-relative URLs');

const card = read('client/src/components/layout/WhatsAppStatusCard.tsx');
must(card.includes('MetaChannelChips'), 'sidebar must render channel chips');

const guide = read('client/src/components/dashboard/WhatsAppConnectGuide.tsx');
must(guide.includes('MetaChannelChips'), 'dashboard WA card must render channel chips');

const callback = read('client/src/pages/FacebookCallbackPage.tsx');
must(callback.includes('safeFbConnectReturn'), 'OAuth return path must be sanitized');

const igInbox = read('client/src/pages/InstagramInboxPage.tsx');
must(igInbox.includes("payload.platform !== 'IG'"), 'IG inbox must ignore non-IG sockets');
must(!igInbox.includes('payload.platform &&'), 'IG socket filter must require platform');
must(igInbox.includes('inbox-shell--instagram'), 'pink 3px shell missing');
must(!igInbox.includes('onOpenTemplate'), 'IG must not wire WA templates');

const comments = read('client/src/pages/InstagramCommentsPage.tsx');
must(comments.includes('instagram:comment'), 'comments live socket missing');

const save = read('server/src/modules/facebook/save-page-channel.ts');
must(save.includes("platform: 'IG'") && save.includes('isActive: false'), 'Page disconnect must soft-drop IG');

const pageClient = read('server/src/modules/facebook/page-client.ts');
must(pageClient.includes('messages,comments,live_comments'), 'IG subscribe must include live_comments');
const igSend = pageClient.slice(
  pageClient.indexOf('sendInstagramTextMessage'),
  pageClient.indexOf('sendInstagramPrivateReply')
);
must(!igSend.includes('messaging_type'), 'IG send must not send Messenger messaging_type');
must(!igSend.includes('sendPageTextMessage'), 'IG send must not reuse Messenger send');

const igInboxRoutes = read('server/src/modules/instagram/inbox.routes.ts');
must(igInboxRoutes.includes('.max(1000)'), 'IG DM must cap at Meta 1000 chars');
must(!/content: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(2000\)/.test(igInboxRoutes), 'IG DM must not allow 2000 chars');

const dispatcher = read('server/src/modules/whatsapp/webhook-dispatcher.ts');
must(dispatcher.includes('comment_id'), 'comment_id fallback missing');
must(dispatcher.includes('from.id === entryIgId'), 'self-comment skip missing');

const meta = read('server/src/modules/whatsapp/meta.service.ts');
must(meta.includes("object: 'instagram'"), 'app webhook must subscribe Instagram object');
must(meta.includes("object: 'page'"), 'app webhook must subscribe Page object');
must(!meta.includes('ads_management'), 'Phase 5 ads must not ship here');

const nav = read('client/src/config/navigation.ts');
must(!/\/instagram\/posts/.test(nav), 'Posts must stay out');
must(!/label:\s*'Ads'/.test(nav), 'Phase 5 Ads nav must not ship yet');

const vitest = spawnSync(
  'npx',
  [
    'vitest',
    'run',
    'src/modules/instagram/instagram.test.ts',
    'src/modules/facebook/save-page-channel.test.ts',
  ],
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
  process.stderr.write('\nPhase 4 close verify: vitest did not report passes\n');
  process.exit(1);
}

process.stdout.write('PHASE4_CLOSE_OK\n');
