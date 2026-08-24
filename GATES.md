# Gates: AI billing credits & add-ons

OWNS: server/src/modules/billing/ai-credits/**, server/prisma/schema.prisma, client/src/components/billing/**, client/src/pages/BillingPage.tsx, admin/src/pages/AccountDetailPage.tsx

Scope: Subscription included AI credits + stackable add-on top-ups wired to Sarvam usage, Billing UI, and platform admin grants.

- [x] G1: Included allowance deducts before add-on balance
  CHECK: cd server && npm test -- ai-credits/service.test.ts -t deduction-order-ok --reporter=verbose
  EXPECT: deduction-order-ok

- [x] G2: Renewal resets included only, add-on balance unchanged
  CHECK: cd server && npm test -- ai-credits/service.test.ts -t renewal-reset-ok --reporter=verbose
  EXPECT: renewal-reset-ok

- [x] G3: Stacking top-ups increases addonBalance sum
  CHECK: cd server && npm test -- ai-credits/service.test.ts -t topup-stack-ok --reporter=verbose
  EXPECT: topup-stack-ok

- [x] G4: Billing catalog exposes allowances and six SKUs
  CHECK: cd server && node scripts/verify-ai-credits-api.mjs
  EXPECT: balances-ok

- [x] G5: Billing UI wires split meters, add-on grid, and Content Studio placeholder
  CHECK: node server/scripts/verify-ai-credits-ui.mjs
  EXPECT: billing-ui-ok

- [x] G6: Top-up quantity cadence parser
  CHECK: cd server && npm test -- fulfillment.test.ts --reporter=verbose
  EXPECT: parses topup:N cadence
