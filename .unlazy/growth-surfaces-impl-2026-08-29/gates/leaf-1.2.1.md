# Gates: Campaign retarget cohorts

OWNS: server/src/modules/campaigns/cohorts.ts, server/src/modules/campaigns/cohorts.test.ts, server/src/modules/campaigns/routes.ts, client/src/components/campaigns/CampaignRetargetPanel.tsx, client/src/pages/CampaignsPage.tsx, client/src/pages/CampaignWizardPage.tsx, client/src/services/api.ts

Scope: Replace summary/failed-only tabs with overview, read, delivered-unread, replied, window, failed. No React tab. No AMBIGUOUS retry.

- [x] G1: cohort kinds exist and React/AMBIGUOUS retry are absent
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.2.1
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK include client/src/pages/CampaignWizardPage.tsx | growth-surfaces impl verification passed
