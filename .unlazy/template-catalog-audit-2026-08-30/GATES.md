# Gates: Template catalog submit-path audit

OWNS: .unlazy/template-catalog-audit-2026-08-30/**, server/src/modules/templates/catalog.ts, server/src/modules/templates/catalog-store.ts, server/src/modules/templates/types.ts, server/src/modules/templates/routes.ts, server/src/modules/templates/starters.test.ts, server/src/modules/whatsapp/meta.service.ts, server/src/modules/whatsapp/graph-error.test.ts, client/src/pages/TemplateLibraryPage.tsx, client/src/components/templates/library/TemplateLibraryReviewStep.tsx, client/src/utils/templateLibrary.ts, client/src/utils/templateLibrary.test.ts, client/src/utils/templateIssueCopy.ts, client/src/utils/templateIssueCopy.test.ts

Scope: Re-read the library catalog implementation, close crash/gap bugs on Meta submit and Review, and prove catalog + connection oracles.

- [x] G1: source audit proves edge-param bodies, GitHub URL block, Graph user-msg, and catalog submit MetaApiError wiring
  CHECK: node .unlazy/template-catalog-audit-2026-08-30/scripts/verify-audit.mjs
  EXPECT: catalog audit verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=catalog audit verification passed (41 en bodies, 1 auth skipped)

- [x] G2: server catalog, Graph-error, and clone unit tests pass
  CHECK: node .unlazy/template-catalog-audit-2026-08-30/scripts/verify-audit.mjs --unit-server
  EXPECT: catalog server unit verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Duration  3.34s (transform 933ms, setup 0ms, import 1.61s, tests 752ms, environment 1ms) | catalog server unit verification passed

- [x] G3: client library URL and issue-copy unit tests pass
  CHECK: node .unlazy/template-catalog-audit-2026-08-30/scripts/verify-audit.mjs --unit-client
  EXPECT: catalog client unit verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Duration  3.67s (transform 1000ms, setup 0ms, import 1.81s, tests 91ms, environment 0ms) | catalog client unit verification passed

- [x] G4: local API health and webhook counters are reachable
  CHECK: node .unlazy/template-catalog-audit-2026-08-30/scripts/verify-audit.mjs --live
  EXPECT: catalog live connection verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=catalog live connection verification passed (webhookConfigured=true totalReceived=8)
