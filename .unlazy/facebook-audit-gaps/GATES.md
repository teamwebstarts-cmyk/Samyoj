# Gates: Facebook audit gaps that fit this product

OWNS: server/src/modules/facebook/channel-keyword.ts, server/src/modules/facebook/channel-keyword.test.ts, server/src/modules/facebook/channel-inbox-actions.ts, server/src/modules/facebook/channel-inbox-actions.test.ts, server/src/modules/facebook/audit-score.ts, server/src/modules/facebook/audit-score.test.ts, server/src/modules/whatsapp/webhook-dispatcher.ts, client/src/pages/FacebookCallbackPage.tsx, client/src/pages/FacebookInboxPage.tsx, client/src/pages/InstagramInboxPage.tsx, docs/meta-ecosystem/FACEBOOK_INTEGRATION_AUDIT_2026-09-24.md, docs/meta-ecosystem/INSTAGRAM_INTEGRATION_AUDIT_2026-09-24.md

Scope: Recapture Facebook/Instagram audit vs code. Claim only proven inbox work. Ads stay read-only. Live Meta proof stays unproven.

- [x] G1: Keyword matcher returns the reply only for the matching channel
  CHECK: npx vitest run src/modules/facebook/channel-keyword.test.ts
  EXPECT: Test Files  1 passed
  CWD: /workspaces/Samyoj/server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=609b55c48eed/43 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G3: Channel export text names the sender and the message
  CHECK: npx vitest run src/modules/facebook/channel-inbox-actions.test.ts
  EXPECT: Test Files  1 passed
  CWD: /workspaces/Samyoj/server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=609b55c48eed/43 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G4: Both inboxes load canned replies and show favorite
  CHECK: node -e "const fs=require('fs'); const a=fs.readFileSync('client/src/pages/FacebookInboxPage.tsx','utf8'); const b=fs.readFileSync('client/src/pages/InstagramInboxPage.tsx','utf8'); if(!a.includes('cannedReplies')||!b.includes('cannedReplies')||a.includes('hideFavorite')||b.includes('hideFavorite')) process.exit(1); console.log('INBOX_PARITY_OK')"
  EXPECT: INBOX_PARITY_OK
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=INBOX_PARITY_OK

- [x] G5: Audit recapture score stays 15 done / 5 remaining / 5 out / 2 live-unproven
  CHECK: npx vitest run src/modules/facebook/audit-score.test.ts
  EXPECT: Test Files  1 passed
  CWD: /workspaces/Samyoj/server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=609b55c48eed/43 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [ ] G2: Remaining audit wishlist
  CHECK: node -e "process.exit(0)"
  EXPECT: never
  EVIDENCE: pending

ABANDON: G2 Ad creation, pause, sentiment, Stories publishing, persistent menu, and a full Automation.channelId engine rewrite are outside the agreed read-only Ads and separate-inbox product.
