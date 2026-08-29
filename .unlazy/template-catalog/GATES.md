# Gates: Samyoj template catalog

OWNS: server/src/modules/templates/catalog.ts, server/src/modules/templates/starters.ts, server/src/modules/templates/starters.test.ts, client/src/components/templates/library/**, client/src/pages/TemplateLibraryPage.tsx, client/src/utils/templateLibrary.ts, client/src/utils/templateLibrary.test.ts, server/src/modules/support/product-knowledge.ts, .unlazy/template-catalog/**

Scope: Replace Meta one-click clone with a Samyoj-owned catalog of 30 review-ready broadcast templates, card browse, filters, and a persistent WhatsApp preview.

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
