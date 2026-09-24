# Gates: remaining Facebook/Instagram inbox work

OWNS: server/src/modules/facebook/channel-keyword.ts, server/src/modules/facebook/channel-keyword.test.ts, server/src/modules/facebook/channel-inbox-actions.ts, server/src/modules/facebook/page-client.ts, server/src/modules/facebook/messenger-inbox.routes.ts, server/src/modules/instagram/inbox.routes.ts, server/src/modules/whatsapp/webhook-dispatcher.ts, server/src/modules/ai/chatbot.service.ts, client/src/pages/FacebookInboxPage.tsx, client/src/pages/InstagramInboxPage.tsx, client/src/services/api.ts, server/src/modules/facebook/audit-score.ts, server/src/modules/facebook/audit-score.test.ts

Scope: Image send, bulk chat actions, welcome/away/lead text rules, and bot replies for Facebook and Instagram DMs.

- [x] G1: Channel rules pick welcome for a new Facebook chat and ignore Instagram rules
  CHECK: npx vitest run src/modules/facebook/channel-keyword.test.ts
  EXPECT: Test Files  1 passed
  CWD: /workspaces/Samyoj/server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=609b55c48eed/43 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G2: Image send accepts only https URLs
  CHECK: npx vitest run src/modules/facebook/channel-inbox-actions.test.ts
  EXPECT: Test Files  1 passed
  CWD: /workspaces/Samyoj/server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=609b55c48eed/43 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G3: Audit score after this pass is 19 done, 1 remaining, 5 out, 2 live-unproven
  CHECK: npx vitest run src/modules/facebook/audit-score.test.ts
  EXPECT: Test Files  1 passed
  CWD: /workspaces/Samyoj/server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=609b55c48eed/43 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [ ] G4: Visual flow graph on Facebook and Instagram DMs
  CHECK: node -e "process.exit(0)"
  EXPECT: never
  EVIDENCE: pending

ABANDON: G4 The flow engine sends through WhatsApp number credentials. Channel text rules cover keyword, welcome, away, and lead capture. Wiring the graph would send the wrong channel.
