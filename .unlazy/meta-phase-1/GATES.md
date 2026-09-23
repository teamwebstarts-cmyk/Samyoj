# Gates: Meta Phase 1 Lead Ads

OWNS: server/src/modules/facebook/**, server/src/modules/whatsapp/webhook-dispatcher.ts, server/src/modules/leads/routes.ts, server/prisma/schema.prisma, server/prisma/migrations/20260923160000_meta_lead_ads/**, client/src/components/settings/FacebookPagePanel.tsx, client/src/config/navigation.ts, client/src/pages/SettingsPage.tsx, client/src/components/contacts/ContactPipelineTab.tsx, client/src/components/leads/LeadCard.tsx, docs/meta-ecosystem/BLOCKERS.md, .unlazy/meta-phase-1/**

Scope: Connect Facebook Page, ingest leadgen into Lead (META_ADS) with optional consented WA template, Settings Page card + Facebook → Leads nav. No Phase 2.

- [x] G1: Phase 1 leadgen invariants hold (idempotent lead, no phone/no consent = no WA send, unknown page writes nothing, no WA conversation)
  CHECK: node .unlazy/meta-phase-1/verify-phase1.mjs
  EXPECT: PHASE1_LEAD_ADS_OK
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=PHASE1_LEAD_ADS_OK
