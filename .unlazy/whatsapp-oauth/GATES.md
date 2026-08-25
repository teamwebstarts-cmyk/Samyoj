# Gates: WhatsApp OAuth popup return and production-readiness audit

OWNS: client/src/App.tsx, client/src/utils/whatsappOAuth.ts, client/src/hooks/useWaOAuthPopupListener.ts, client/src/hooks/useWhatsAppConnectOAuth.ts, client/src/pages/WhatsappCallbackPage.tsx, client/src/components/dashboard/WhatsAppConnectGuide.tsx, client/src/pages/SettingsPage.tsx, server/.env.example, server/src/modules/whatsapp/**, server/src/modules/contacts/consent.ts, server/src/modules/contacts/consent.test.ts, server/src/workers/webhook.processor.test.ts, server/src/modules/billing/routes.ts, server/src/config/**, docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md, docs/ui-specs/dashboard-api-connections.md, docs/audit/WHATSAPP_OAUTH_POPUP_AND_READINESS_2026-08-25.md

Scope: Make the WhatsApp OAuth popup reliably return to the originating page, preserve the connected state, and document verified remaining production risks without claiming unsupported completeness.

- [x] G1: OAuth popup result is delivered to the opener and the popup closes after a successful callback
  CHECK: node .unlazy/whatsapp-oauth/verify-popup-flow.mjs
  EXPECT: oauth-popup-flow-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=oauth-popup-flow-ok

- [x] G2: OAuth callback errors and cancellations are delivered without leaving the opener waiting
  CHECK: node .unlazy/whatsapp-oauth/verify-popup-flow.mjs --negative
  EXPECT: oauth-popup-negative-flow-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=oauth-popup-negative-flow-ok

- [x] G3: client TypeScript build passes after the popup-flow changes
  CHECK: cd client && npm run build
  EXPECT: built in
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

- [ ] G4: server TypeScript build passes after OAuth changes
  CHECK: cd server && npm run build && echo server-build-ok
  EXPECT: server-build-ok
  CWD: .
  EVIDENCE: pending

- [x] G5: focused WhatsApp OAuth tests pass
  CHECK: cd server && npm test -- src/modules/whatsapp --run
  EXPECT: Tests
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  08:26:28 | Duration  7.14s (transform 1.32s, setup 0ms, import 4.04s, tests 214ms, environment 2ms)

- [x] G6: production/development audit findings are recorded with current code evidence
  EVIDENCE: docs/audit/WHATSAPP_OAUTH_POPUP_AND_READINESS_2026-08-25.md

- [ ] G7: live Meta popup and callback behavior is manually verified in a browser with both success and failure paths
  EVIDENCE: pending human test; exact steps are in docs/audit/WHATSAPP_OAUTH_POPUP_AND_READINESS_2026-08-25.md

ABANDON: G7 Live Meta account and browser interaction are unavailable to this agent; human test steps are documented in the audit.
