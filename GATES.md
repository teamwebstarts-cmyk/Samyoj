# Gates: Platform subscription enforcement switch

OWNS: server/src/modules/billing/subscription-enforcement.ts, server/src/modules/billing/subscription-enforcement.test.ts, server/src/modules/billing/entitlements.service.ts, server/src/modules/billing/entitlements.service.test.ts, server/src/modules/billing/ai-credits/service.ts, server/src/middleware/plan-guard.ts, server/src/modules/platform/settings.ts, server/src/modules/platform/routes.ts, admin/src/pages/BillingConfigPage.tsx, client/src/components/billing/SubscriptionLockModal.tsx, client/src/components/Layout.tsx, client/src/components/layout/NotificationCenter.tsx

Scope: Platform admin can turn subscription enforcement on or off; default is off so expired plans and AI credit limits do not block product use, and an expired plan shows a dialog only while enforcement is on.

- [x] G1: Enforcement defaults off and expired orgs stay unlocked until admin turns it on
  CHECK: npx vitest run src/modules/billing/subscription-enforcement.test.ts src/modules/billing/entitlements.service.test.ts --disableConsoleIntercept
  EXPECT: subscription enforcement gates passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=b67db49af689/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G2: Admin billing page exposes the switch and the app shows a lock dialog when the server marks the org locked
  CHECK: node scripts/verify-subscription-switch.mjs
  EXPECT: subscription switch ui passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b67db49af689/39 entries; output=subscription switch ui passed
