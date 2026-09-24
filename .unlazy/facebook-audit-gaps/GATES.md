# Gates: Facebook audit gaps that fit this product

OWNS: server/src/modules/facebook/channel-keyword.ts, server/src/modules/facebook/channel-keyword.test.ts, server/src/modules/whatsapp/webhook-dispatcher.ts, client/src/pages/FacebookCallbackPage.tsx

Scope: Keyword replies on Facebook and Instagram DMs, and an honest Facebook connect error. Product-excluded audit items are abandoned, not silently dropped.

- [x] G1: Keyword matcher returns the reply only for the matching channel
  CHECK: npx vitest run src/modules/facebook/channel-keyword.test.ts
  EXPECT: Test Files  1 passed
  CWD: /workspaces/Samyoj/server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=609b55c48eed/43 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [ ] G2: Remaining audit wishlist
  CHECK: node -e "process.exit(0)"
  EXPECT: never
  EVIDENCE: pending

ABANDON: G2 Ad creation, pause, sentiment, Stories publishing, persistent menu, and a full Automation.channelId engine rewrite are outside the agreed read-only Ads and separate-inbox product. Keyword DM reply is the smallest automation that was actually missing.
