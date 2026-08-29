# Gates: Samyoj template catalog

OWNS: server/src/modules/templates/catalog.ts, server/src/modules/templates/catalog-store.ts, server/src/modules/templates/starters.ts, server/src/modules/templates/starters.test.ts, server/src/modules/templates/routes.ts, server/src/modules/platform/routes.ts, server/prisma/schema.prisma, server/prisma/migrations/20260829220000_platform_library_templates/**, client/src/components/templates/library/**, client/src/pages/TemplateLibraryPage.tsx, client/src/utils/templateLibrary.ts, client/src/utils/templateLibrary.test.ts, admin/src/pages/TemplateCatalogPage.tsx, admin/src/App.tsx, admin/src/lib/routes.ts, server/src/modules/support/product-knowledge.ts, .unlazy/template-catalog/**

Scope: Persist a Samyoj-owned catalog in Postgres, let tenants pick/review/submit to their WABA, and let Platform Admin publish drafts. Honest copy: Meta still reviews per number.

- [ ] G1: catalog ships at least 30 unique templates with English and Hindi bodies
  CHECK: node .unlazy/template-catalog/scripts/verify-catalog.mjs
  EXPECT: catalog verification passed
  EVIDENCE: pending

- [ ] G2: library UI no longer advertises Meta one-click clone
  CHECK: node .unlazy/template-catalog/scripts/verify-catalog.mjs --ui
  EXPECT: catalog UI verification passed
  EVIDENCE: pending

- [ ] G3: starter payload tests pass for catalog create
  CHECK: node .unlazy/template-catalog/scripts/verify-catalog.mjs --unit
  EXPECT: catalog unit verification passed
  EVIDENCE: pending

- [ ] G4: Platform Admin publisher + Prisma catalog exist with honesty copy
  CHECK: node .unlazy/template-catalog/scripts/verify-catalog.mjs --admin
  EXPECT: catalog admin verification passed
  EVIDENCE: pending
