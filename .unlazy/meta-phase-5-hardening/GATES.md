# Gates: Phase 0–5 Meta hardening

OWNS: server/src/modules/whatsapp/**, server/src/modules/facebook/**, server/src/modules/instagram/**, server/src/modules/automation/**, client/src/config/**, client/src/components/inbox/**, client/src/components/layout/**, client/src/pages/**, client/src/services/**, server/src/**/*.test.ts, client/src/**/*.test.ts, docs/meta-ecosystem/**, .cursor/agents/**

Scope: close the confirmed Phase 0–5 backend, tenancy, durability, UI, and verification gaps without adding publishing, Ads Manager mutation, Phase 6, or Phase 7.

- [x] G1: Instagram HTTP admission reaches the existing non-WhatsApp dispatcher and ownership takeover is rejected
  CHECK: cd server && npx vitest run src/modules/whatsapp/route-hardening.test.ts src/modules/instagram/instagram.test.ts src/modules/facebook/save-page-channel.test.ts --reporter=dot
  EXPECT: Tests
  EVIDENCE: 4 test files / 27 tests passed on 2026-09-24.

- [x] G2: Instagram automation configuration works without WhatsApp and does not leak WhatsApp rows across numbers
  CHECK: cd server && npx vitest run src/modules/automation --reporter=dot
  EXPECT: Tests
  EVIDENCE: automation suite: 11 files / 71 tests passed on 2026-09-24; scope-filter regression included.

- [x] G3: focused Phase 0–5 client and server regression suites pass
  CHECK: cd client && npx vitest run src/config/pageMeta.test.ts src/config/navigation.test.ts src/utils/facebookLoginHttps.test.ts src/utils/facebookOAuthDenied.test.ts --reporter=dot && cd ../server && npx vitest run src/modules/whatsapp/webhook-phase0-router.test.ts src/modules/instagram/instagram.test.ts src/modules/facebook/ads-insights.test.ts src/modules/facebook/leadgen-ingest.test.ts src/modules/facebook/messenger-inbox.test.ts src/modules/facebook/connect-oauth-state.test.ts src/modules/facebook/save-page-channel.test.ts src/modules/automation --reporter=dot
  EXPECT: Test Files
  EVIDENCE: focused client Meta suite: 4 files / 14 tests passed; focused server gate: 13 files / 78 tests passed on 2026-09-24.

- [x] G4: TypeScript checks pass for the edited client and server surfaces
  CHECK: cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit && echo META_PHASE5_HARDENING_TYPES_OK
  EXPECT: META_PHASE5_HARDENING_TYPES_OK
  EVIDENCE: final `server npx tsc --noEmit` and `client npx tsc --noEmit` passed on 2026-09-24.

- [ ] G5: browser-facing phase surfaces expose the repaired shell/connect/empty-state behavior
  EVIDENCE: local HTTP smoke passed (`:8000`, `:3000`, `:3001`, public challenge); visual browser navigation was blocked by the Codespace forwarded-port GitHub sign-in and needs manual user takeover.

- [x] G6: external Meta live proof remains explicitly separate from code completion
  EVIDENCE: docs and runbook explicitly keep App Review, signed/public delivery, and customer production open.
