# Gates: Dashboard quality + promo vs service

OWNS: client/src/components/dashboard/LiveMetricsHero.tsx, client/src/pages/DashboardPage.tsx, server/src/modules/analytics/routes.ts, server/src/modules/analytics/conversation-mix.ts, server/src/modules/analytics/conversation-mix.test.ts, client/src/types/index.ts, server/src/modules/whatsapp/routes.ts, server/src/modules/whatsapp/meta.service.ts, server/src/modules/billing/usage.service.ts, server/prisma/schema.prisma, server/prisma/migrations/20260829180000_whatsapp_number_growth_fields/migration.sql

Scope: Replace vanity delivery/read mini-cards with phone quality and ConversationCharge promo/service mix. Optional Samyoj cap line. Keep QualityRatingBanner.

- [x] G1: hero shows Quality and promo vs service, not Delivery % mini-cards
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.1.2
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK include server/src/modules/analytics/routes.ts | growth-surfaces impl verification passed
