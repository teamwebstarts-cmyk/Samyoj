# Gates: production billing rollout

OWNS: server/prisma/schema.prisma, server/prisma/migrations/**, server/src/modules/billing/**, server/src/workers/**, server/src/config/**, server/src/modules/platform/**, server/src/modules/auth/**, server/src/modules/team/**, server/src/modules/whatsapp/**, client/src/pages/BillingPage.tsx, client/src/components/billing/**, client/src/services/api.ts, client/src/types/**, scripts/verify-billing-gates.mjs, .unlazy/production-billing-rollout/**

Scope: recurring SaaS subscriptions, lifecycle enforcement, GST invoices, billing UI, and release verification against the documented target.

- [x] G1: target catalog and billing schema are internally consistent
  CHECK: node scripts/verify-billing-gates.mjs catalog
  EXPECT: billing-catalog-schema-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=billing-catalog-schema-ok | Environment variables loaded from .env

- [x] G2: provider signatures, amount binding, checkout ownership, and webhook replay are fail-closed
  CHECK: node scripts/verify-billing-gates.mjs provider
  EXPECT: billing-provider-safety-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=Duration  5.85s (transform 778ms, setup 0ms, import 2.92s, tests 214ms, environment 2ms) | billing-provider-safety-ok

- [x] G3: subscription lifecycle, proration, dunning, cancellation, and recovery state transitions are covered
  CHECK: node scripts/verify-billing-gates.mjs lifecycle
  EXPECT: billing-lifecycle-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=Duration  582ms (transform 188ms, setup 0ms, import 433ms, tests 6ms, environment 0ms) | billing-lifecycle-ok

- [x] G4: quotas, feature gates, stale-order reconciliation, and overflow replay are enforced and idempotent
  CHECK: node scripts/verify-billing-gates.mjs entitlements
  EXPECT: billing-entitlements-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=Duration  505ms (transform 167ms, setup 0ms, import 311ms, tests 14ms, environment 0ms) | billing-entitlements-ok

- [x] G5: GST calculations, invoice numbering, PDF/download contracts, and credit-note linkage are valid
  CHECK: node scripts/verify-billing-gates.mjs invoices
  EXPECT: billing-invoices-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=Duration  603ms (transform 182ms, setup 0ms, import 416ms, tests 6ms, environment 0ms) | billing-invoices-ok

- [x] G6: customer/admin billing API and UI contracts compile and expose honest subscription states
  CHECK: node scripts/verify-billing-gates.mjs surfaces
  EXPECT: billing-surfaces-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

- [x] G7: server, client, and admin regressions pass with safe migration validation
  CHECK: node scripts/verify-billing-gates.mjs regression
  EXPECT: billing-regression-ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

- [ ] G8: tax/legal operating assumptions receive explicit human review
  EVIDENCE: pending

ABANDON: G8 External CA/tax review and live-provider compliance approval cannot be performed inside local code verification; required before customer production.

