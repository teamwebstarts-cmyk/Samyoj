# Gates: Dashboard quality rating + Meta messaging limit

OWNS: client/src/components/dashboard/LiveMetricsHero.tsx, client/src/pages/DashboardPage.tsx, client/src/utils/messagingLimitTier.ts, client/src/utils/messagingLimitTier.test.ts, server/src/modules/analytics/routes.ts, server/src/modules/analytics/conversation-mix.ts, server/src/modules/analytics/conversation-mix.test.ts, client/src/types/index.ts, server/src/modules/whatsapp/routes.ts, server/src/modules/whatsapp/meta.service.ts, server/src/modules/billing/usage.service.ts, server/prisma/schema.prisma, server/prisma/migrations/20260829180000_whatsapp_number_growth_fields/migration.sql

Scope: Quality rating chip (no extra paragraphs). Second card is Graph `whatsapp_business_manager_messaging_limit` mapped to unique-user cap. No Promo vs service. No Samyoj 0/5000 bar on dashboard. Never fake remaining.

- [x] G1: hero shows Quality rating and Meta daily limit, not Delivery / Promo vs service / Samyoj cap
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.1.2
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
