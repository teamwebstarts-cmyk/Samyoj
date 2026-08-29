# Gates: Growth surfaces polish and local verify

OWNS: .unlazy/growth-surfaces-impl-2026-08-29/scripts/**, server/src/modules/inbox/service-window.ts, server/src/modules/campaigns/cohorts.ts, server/src/modules/billing/usage.service.ts, client/src/components/inbox/useInboxDeepLink.ts, client/src/pages/CampaignWizardPage.tsx, client/src/pages/TemplateLibraryPage.tsx, client/src/utils/templateLibrary.ts, client/src/components/dashboard/LiveMetricsHero.tsx

Scope: Close remaining wave 1–3 accuracy gaps and prove the local stack serves the new surfaces without 500s.

- [x] G1: polish source contracts hold
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf polish
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK absent client/src/pages/TemplateLibraryPage.tsx | growth-surfaces impl verification passed

- [x] G2: targeted unit tests for polish still pass
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-unit.mjs
  EXPECT: growth-surfaces unit verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=growth-surfaces unit verification passed

- [x] G3: local API/client respond and growth routes fail closed (401) not 500
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-local.mjs
  EXPECT: growth-surfaces local verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=growth-surfaces local verification passed
