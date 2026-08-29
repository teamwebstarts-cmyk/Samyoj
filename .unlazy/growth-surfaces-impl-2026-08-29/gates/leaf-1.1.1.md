# Gates: Honesty — hide fake CTR and meta-health remaining

OWNS: server/src/modules/analytics/routes.ts, client/src/components/reports/tabs/ReportsCampaignsTab.tsx, client/src/components/reports/tables/UniversalTemplateTable.tsx, client/src/components/reports/tabs/ReportsMetaHealthTab.tsx, client/src/types/index.ts

Scope: Stop fabricating Est. CTR, Meta remaining unique users, and fake category splits.

- [ ] G1: analytics no longer multiplies readRate by 0.4 or 0.35 for CTR
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.1.1
  EXPECT: growth-surfaces impl verification passed
  EVIDENCE: pending
