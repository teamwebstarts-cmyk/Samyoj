# Gates: Professional manual billing

OWNS: GATES.md, server/scripts/verify-manual-billing-ui.mjs, server/scripts/verify-recurring-disabled.mjs, server/src/modules/billing/**/*.test.ts, client/src/hooks/useEntitlements.test.ts

Scope: Runnable acceptance gates for manual plan-period billing, fail-closed entitlements, one-pack AI top-ups, and client billing UX — no customer-facing auto-renew or recurring AI checkout.

- [x] G1: Payment HMAC and webhook signature integrity
  CHECK: cd server && npm test -- razorpay.service.test.ts -t "verifyPaymentSignature|verifyWebhookSignature" --reporter=verbose
  EXPECT: payment-hmac-integrity-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:33 | Duration  417ms (transform 135ms, setup 0ms, import 213ms, tests 10ms, environment 0ms)

- [x] G2: Provider capture verification rejects mismatch and pending states
  CHECK: cd server && npm test -- razorpay.service.test.ts -t "verifyCapturedPayment" --reporter=verbose
  EXPECT: payment-provider-verify-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:34 | Duration  387ms (transform 130ms, setup 0ms, import 219ms, tests 8ms, environment 0ms)

- [x] G3: Active-plan no-op, downgrade rejection, upgrade, and post-expiry purchase rules
  CHECK: cd server && npm test -- billing-transitions.test.ts --reporter=verbose
  EXPECT: plan-transitions-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:35 | Duration  448ms (transform 124ms, setup 0ms, import 243ms, tests 6ms, environment 0ms)

- [x] G4: Entitlement quotas, tier inheritance, and read-only lock
  CHECK: cd server && npm test -- entitlements.service.test.ts --reporter=verbose
  EXPECT: entitlement-coverage-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:36 | Duration  427ms (transform 144ms, setup 0ms, import 262ms, tests 11ms, environment 0ms)

- [x] G5: Plan catalog SKUs, cadences, and tier entitlements
  CHECK: cd server && npm test -- plans.test.ts --reporter=verbose
  EXPECT: plan-catalog-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:37 | Duration  295ms (transform 86ms, setup 0ms, import 115ms, tests 20ms, environment 0ms)

- [x] G6: Billing period helpers prefer ledger over cache
  CHECK: cd server && npm test -- billing-state.service.test.ts --reporter=verbose
  EXPECT: billing-state-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:38 | Duration  297ms (transform 65ms, setup 0ms, import 128ms, tests 7ms, environment 0ms)

- [x] G7: AI ledger uses included balance before add-on and enforces plan allowances
  CHECK: cd server && npm test -- ai-credits/service.test.ts --reporter=verbose
  EXPECT: ai-ledger-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:39 | Duration  450ms (transform 153ms, setup 0ms, import 285ms, tests 13ms, environment 0ms)

- [x] G8: One-pack AI top-up cadence parsing and fixed-pack enforcement
  CHECK: cd server && npm test -- fulfillment.test.ts --reporter=verbose
  EXPECT: one-pack-topup-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:40 | Duration  502ms (transform 186ms, setup 0ms, import 335ms, tests 8ms, environment 0ms)

- [x] G9: Recurring AI add-on checkout is disabled server- and client-side
  CHECK: node server/scripts/verify-recurring-disabled.mjs
  EXPECT: recurring-disabled-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=recurring-disabled-ok

- [x] G10: Client entitlement hook derives quota and lock states from server snapshot
  CHECK: cd client && npm test -- useEntitlements --reporter=verbose
  EXPECT: client-entitlements-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  09:25:42 | Duration  641ms (transform 241ms, setup 0ms, import 414ms, tests 10ms, environment 0ms)

- [x] G11: Client billing UI shows manual purchase copy without recurring or quantity controls
  CHECK: node server/scripts/verify-manual-billing-ui.mjs
  EXPECT: manual-billing-ui-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=manual-billing-ui-ok

- [x] G12: Server TypeScript build passes
  CHECK: cd server && npm run build && echo server-build-ok
  EXPECT: server-build-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=> tsc | server-build-ok

- [x] G13: Client production build passes
  CHECK: cd client && npm run build
  EXPECT: built in
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
