# Gates: Packet A existing-system honesty

OWNS: client/src/components/campaigns/campaignSendConfirm.ts, client/src/components/settings/IntegrationsPanel.tsx, client/src/pages/BillingPage.tsx, client/src/pages/ContentStudioPage.tsx, client/src/services/api.ts, admin/src/pages/BillingConfigPage.tsx, server/src/modules/content-studio/images/routes.ts, server/src/modules/content-studio/videos/routes.ts, server/src/modules/content-studio/voices/routes.ts, server/src/modules/campaigns/recipients.ts, server/src/modules/campaigns/validation.test.ts, .unlazy/existing-harden-packet-a/**

Scope: Honesty + known client test + campaign phone dedupe on already-shipped surfaces. No Embedded Signup, subscriptions, or real Studio providers.

- [x] G1: campaign empty-audience error maps to subscribe copy
  CHECK: npm test -- src/components/campaigns/campaignSendConfirm.test.ts --reporter=dot
  EXPECT: Tests  4 passed
  CWD: client
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/client; path=e3a870e24ba1/42 entries; output=Start at  08:18:48 | Duration  460ms (transform 80ms, setup 0ms, import 98ms, tests 19ms, environment 0ms)

- [x] G2: honesty strings — no Full backup title, no live recurring Autopay, no GST invoice on payment history
  CHECK: node .unlazy/existing-harden-packet-a/verify-honesty.mjs
  EXPECT: packet-a-honesty-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-a-honesty-ok

- [x] G3: stub generation does not record usage or succeed
  CHECK: node .unlazy/existing-harden-packet-a/verify-honesty.mjs --stubs
  EXPECT: packet-a-stubs-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=packet-a-stubs-ok

- [x] G4: campaign recipient dedupe treats +91 and 91 as one contact
  CHECK: npm test -- src/modules/campaigns/validation.test.ts -t dedupeRecipients --reporter=dot
  EXPECT: Tests  2 passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=e3a870e24ba1/42 entries; output=Start at  08:18:49 | Duration  316ms (transform 124ms, setup 0ms, import 165ms, tests 5ms, environment 0ms)
