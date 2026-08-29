# Gates: Campaigns Samyoj daily send cap bar

OWNS: server/src/modules/campaigns/quota.ts, client/src/components/campaigns/CampaignQuotaBar.tsx, client/src/pages/CampaignsPage.tsx, client/src/pages/CampaignWizardPage.tsx, client/src/components/campaigns/wizard/CampaignReviewStep.tsx, client/src/services/api.ts

Scope: Show used/remaining for the Samyoj daily campaign cap on Campaigns + wizard. Never label it Meta remaining.

- [ ] G1: quota payload includes dailySendLimit and remaining; UI calls campaignApi.quota
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.1.3
  EXPECT: growth-surfaces impl verification passed
  EVIDENCE: pending
