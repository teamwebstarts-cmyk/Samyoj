# Gates: AI recurring subscription add-ons

OWNS: server/src/modules/billing/ai-credits/**, server/src/modules/billing/razorpay.service.ts, server/prisma/schema.prisma, client/src/components/billing/AiAddonGrid.tsx, client/src/utils/razorpay.ts

Scope: Razorpay Subscription checkout for monthly AI chat/calling add-ons; grant credits on subscription.charged; cancel flow.

- [x] G1: Recurring SKU catalog includes two monthly add-ons
  CHECK: cd server && npm test -- ai-credits/catalog.test.ts -t recurring --reporter=verbose
  EXPECT: recurring-addon-skus-ok

- [x] G2: Subscription payment signature verification
  CHECK: cd server && npm test -- razorpay.service.test.ts -t subscription-signature --reporter=verbose
  EXPECT: subscription-signature-ok

- [x] G3: Subscription charged grants credits idempotently
  CHECK: cd server && npm test -- ai-credits/recurring.service.test.ts --reporter=verbose
  EXPECT: recurring-charge-grant-ok

- [x] G4: Billing UI exposes recurring subscribe controls
  CHECK: node server/scripts/verify-ai-credits-recurring-ui.mjs
  EXPECT: recurring-ui-ok
