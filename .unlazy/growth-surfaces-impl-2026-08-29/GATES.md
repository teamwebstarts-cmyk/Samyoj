# Gates: Growth surfaces implementation root

OWNS: .unlazy/growth-surfaces-impl-2026-08-29/**, docs/product/GROWTH_SURFACES_PHASE_2026-08-29.md, docs/product/GROWTH_SURFACES_SPEC_2026-08-29.md

Scope: Ship spec waves 1–3 on existing Samyoj surfaces without faking Meta quota, skip-review templates, or CRM-as-CSW.

- [x] G1: honesty tokens are gone from live analytics paths
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf root-honesty
  EXPECT: growth-surfaces impl verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK absent client/src/components/reports/tables/UniversalTemplateTable.tsx | growth-surfaces impl verification passed

- [x] G2: wave 1 surfaces are wired (dashboard, quota, inbox window)
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf wave1
  EXPECT: growth-surfaces impl verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK include server/src/modules/inbox/service-window.ts | growth-surfaces impl verification passed

- [x] G3: wave 2 surfaces are wired (retarget cohorts, featured starters)
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf wave2
  EXPECT: growth-surfaces impl verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK include client/src/pages/TemplateLibraryPage.tsx | growth-surfaces impl verification passed

- [x] G4: wave 3 surfaces are wired (wa.me builder, OBA checklist)
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf wave3
  EXPECT: growth-surfaces impl verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK include client/src/components/settings/WhatsAppChannelsPanel.tsx | growth-surfaces impl verification passed

- [x] G5: polish + local stack verification
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf polish
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK absent client/src/pages/TemplateLibraryPage.tsx | growth-surfaces impl verification passed
