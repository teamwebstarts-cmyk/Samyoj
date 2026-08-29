# Gates: Campaigns Meta daily limit card

OWNS: server/src/modules/campaigns/quota.ts, server/src/modules/campaigns/routes.ts, client/src/components/campaigns/CampaignHero.tsx, client/src/components/campaigns/MetaDailyLimitCard.tsx, client/src/pages/CampaignsPage.tsx, client/src/pages/CampaignWizardPage.tsx, client/src/utils/messagingLimitTier.ts

Scope: Hero shows Meta used / cap. No Samyoj 0/5000 bar. Used = unique campaign phones in last 24h, not Meta remaining.

- [x] G1: Campaigns hero has MetaDailyLimitCard; quota bar gone
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.1.3
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
