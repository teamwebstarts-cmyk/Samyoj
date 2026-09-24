# Gates: Phase 5 Ads read

OWNS: server/prisma/schema.prisma, server/prisma/migrations/20260924120000_meta_ads_snapshot/**, server/src/modules/facebook/page-client.ts, server/src/modules/facebook/ads-insights.ts, server/src/modules/facebook/ads-insights.test.ts, server/src/modules/facebook/routes.ts, server/src/modules/facebook/connect-oauth-state.ts, server/src/workers/index.ts, client/src/config/navigation.ts, client/src/config/pageMeta.ts, client/src/App.tsx, client/src/services/api.ts, client/src/pages/FacebookAdsPage.tsx, client/src/components/dashboard/MetaAdsRecap.tsx, client/src/pages/DashboardPage.tsx, docs/meta-ecosystem/STATUS_SIMPLE.md, .unlazy/meta-phase-4-close/verify-close.mjs, .unlazy/meta-phase-5/**

Scope: Read-only Meta Ads Insights under Facebook → Ads, one snapshot, dashboard recap from the same payload. No ad create, no ads_management, no plan-price change.

- [x] G1: Phase 5 Ads read invariants
  CHECK: node verify-phase5.mjs
  EXPECT: PHASE5_ADS_OK
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/meta-phase-5; path=609b55c48eed/43 entries; output=PHASE5_ADS_OK
