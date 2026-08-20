# Billing system review — 2026-08-20

**Date:** 2026-08-20
**Workspace:** `/workspaces/Samyoj` (branch `phase-3`)
**Mode:** Code audit only. No application code was changed.
**Scope:** Every aspect of the billing system — pricing, checkout, webhook, entitlements, quotas, trial, lifecycle, usage, invoicing, dunning, frontend, admin, tests.
**Prior audit:** `docs/audit/BILLING_SYSTEM_REVIEW.md` (2026-08-14). This document supersedes it.

---

## 0. Executive summary

Since the Aug 14 audit, the billing system has progressed from **4/10 (demo-grade checkout)** to roughly **6/10 (functional trial + checkout with partial entitlements)**. The team shipped real improvements: a 14-day trial flow, a full SKU catalog with quarterly/yearly cadences and GST pre-computation, an entitlements service wired into three modules, expiry enforcement in the alert worker, timing-safe signature comparison, idempotent verify, and a dunning banner in the UI.

However, the system is still **not a subscription product**. It remains a one-shot Razorpay Order + 30-day license. There is no recurring billing, no invoice generation, no dunning/retry, and the cadence picker in the UI is decorative. The most serious live bug is that the `plan-guard.ts` middleware — the intended enforcement layer for `requirePlan` / `requireQuota` / `requireActiveCommercial` — is **completely dead code, never imported by any route**. Entitlements are enforced only via scattered inline `checkQuota()` calls, leaving calling, AI bots, content studio, campaigns, and public API effectively ungated.

**Score: 6/10** — can charge for a 30-day license with a working trial, but cannot run a recurring subscription business and has enforcement gaps that let trial-expired orgs use paid features in several modules.

---

## 1. What changed since the Aug 14 audit (FIXED)

These bugs from the prior audit have been resolved:

| # | Prior bug | Fix | Evidence |
|---|-----------|-----|----------|
| 1 | `POST /verify` activated `req.body.planId`, ignoring `PaymentOrder.planId` (plan injection) | ✅ Now reads `paymentOrder.planId` from the DB row | `routes.ts:187` |
| 2 | Verify was not idempotent — replay extended expiry 30 days | ✅ Added `status === 'CAPTURED'` early-return guard | `routes.ts:183-185` |
| 3 | HMAC compare used `===`, not timing-safe | ✅ Both `verifyPaymentSignature` and `verifyWebhookSignature` use `crypto.timingSafeEqual` | `razorpay.service.ts:63,91` |
| 4 | `billingApi.estimateCost` used GET; server route is POST | ✅ Client now uses `api.post('/billing/estimate', ...)` and `CampaignAudiencePreview` calls it | `api.ts:675-676`, `CampaignAudiencePreview.tsx:219` |
| 5 | Seat limit inconsistency — team default 25 overrode plan | ✅ `getSeatLimit` now clamps: `Math.min(settings.seatLimit, planMax)` | `team/types.ts:124` |
| 6 | No trial flow — signup defaulted to `plan='starter'`, `subscriptionStatus='active'` | ✅ Signup now creates `plan='launch'`, `subscriptionStatus='trial'`, `planExpiresAt = now + 14 days` | `auth/routes.ts:82-88` |
| 7 | Expiry only emitted a socket event; nothing downgraded the org | ✅ Alert worker transitions `trial` → `trial_expired` and `active` (paid) → `expired` | `alert.worker.ts:36-56` |
| 8 | Webhook handled only `payment.captured` | ✅ `payment.failed` now marks order `FAILED` + emits `PAYMENT_FAIL` | `routes.ts:265-284` |
| 9 | `subscriptionStatus` stayed `active` after expiry | ✅ Worker writes `trial_expired` / `expired` | `alert.worker.ts:42,54` |
| 10 | No billing module tests | ✅ Four test files exist: `plans.test.ts`, `entitlements.service.test.ts`, `usage.service.test.ts`, `razorpay.service.test.ts` | `server/src/modules/billing/*.test.ts` |
| 11 | No entitlements enforcement | ✅ `checkQuota()` wired into automation (workflows), contacts, WhatsApp connect | `automation/routes.ts:124,164`, `contacts/routes.ts:67,138`, `whatsapp/save-connection.ts:79` |
| 12 | No trial SKU or quarterly/yearly cadences | ✅ Full `BILLING_SKUS` catalog with `launch_trial`, `*_monthly`, `*_quarterly`, `*_yearly` + GST pre-computed + UPI Autopay cap logic | `plans.ts:120-258` |
| 13 | No platform admin billing override | ✅ `patchPlatformOrgBilling` allows complimentary/extend with audit logging | `platform/orgs.ts:475-527` |
| 14 | Razorpay webhook raw-body parser | ✅ Dedicated `express.raw` + `rawJsonBodyParser` mounted at `/api/billing/webhook` before `express.json()` | `index.ts:191-195` |

---

## 2. Current architecture (as coded today)

### 2.1 Plans and SKUs

`server/src/modules/billing/plans.ts` defines two parallel structures:

- **`PLAN_TIERS`** — entitlement definitions per tier (`launch`, `starter`, `growth`, `pro`, `enterprise`) with `waNumbers`, `seats`, `contacts`, `publishedWorkflows`, `aiIncluded`, `callingIncluded`, `analyticsAdvanced`, `supportLevel`, `features[]`.
- **`BILLING_SKUS`** — purchasable SKUs (`launch_trial`, `starter_monthly/quarterly/yearly`, `growth_*`, `pro_*`). Each has `pricePaise` (excl. GST), `inclGstPaise` (pre-computed at 18%), `periodDays`, `upiAutopayAllowed` (₹15,000 incl. GST RBI cap), `isMostPopular`.
- **`BILLING_PLANS`** (deprecated, legacy) — still used by `GET /api/billing` and `PATCH /api/billing/plan` for backward compat. Maps `launch/starter/growth/pro/enterprise` to display info.

`legacyPlanToTier()` maps old plan strings → new tiers (`business` → `pro`).

**Pricing (INR, excl. GST):**

| Tier | Monthly | Quarterly | Yearly |
|------|---------|-----------|--------|
| Launch (trial) | ₹0 (14 days) | — | — |
| Starter | ₹999 | ₹2,850 (₹950/mo) | ₹9,600 (₹800/mo) |
| Growth | ₹2,499 | ₹7,125 (₹2,375/mo) | ₹24,000 (₹2,000/mo) |
| Pro | ₹4,999 | ₹14,250 (₹4,750/mo) | ₹48,000 (₹4,000/mo) |
| Enterprise | Custom | — | — |

### 2.2 Checkout flow

1. **Signup** → org created with `plan='launch'`, `subscriptionStatus='trial'`, `planExpiresAt = now + 14d`.
2. **Billing UI** (`/billing`) → `GET /api/billing` returns legacy `BILLING_PLANS`, current plan, seats, Razorpay key id, recent payments.
3. **Choose plan** → UI has a cadence picker (monthly/quarterly/yearly). On paid plan click → `POST /api/billing/create-order` with `{ planId }`.
4. **Create order** → server builds `skuId = ${planId}_monthly`, calls Razorpay `POST /v1/orders`, creates `PaymentOrder` (CREATED).
5. **Checkout.js** → client loads Razorpay Checkout, `handler` calls `POST /api/billing/verify`.
6. **Verify** → timing-safe HMAC of `orderId|paymentId`. Looks up `PaymentOrder` by `razorpayOrderId + organizationId`. If `status !== 'CAPTURED'`, marks CAPTURED + calls `activatePlan(orgId, paymentOrder.planId)`.
7. **`activatePlan`** → sets `plan`, `planExpiresAt = now + 30d`, `subscriptionStatus = 'active'`.
8. **Webhook (backup)** → `POST /api/billing/webhook`, timing-safe HMAC with `webhookSecret`. Handles `payment.captured` (activates via `PaymentOrder` lookup) and `payment.failed` (marks FAILED).

### 2.3 Trial and expiry

- **Alert worker** (`alert.worker.ts`, ~30s interval):
  - Transitions `trial` + `planExpiresAt <= now` → `trial_expired`.
  - Transitions `active` + `planExpiresAt <= now` + `plan NOT IN ('starter','launch')` → `expired`.
  - Emits `billing:expiring` socket event for orgs expiring within 3 days.
- **`SubscriptionDunningBanner`** (client, in `Layout.tsx`) polls `GET /api/billing` and shows banners for trial-ending, trial-expired, past-due, and locked states.

### 2.4 Entitlements

- **`entitlements.service.ts`** — `getOrgEntitlements()` snapshots current usage (WA numbers, seats, contacts, workflows) against `PLAN_TIERS` limits. `checkQuota()` returns `{ allowed, used, limit, upgradeCta, code, reason }`. Checks `isLocked` (subscription in `trial_expired/locked/expired/cancelled`).
- **Wired into:** `automation/routes.ts` (publishedWorkflows), `contacts/routes.ts` (contacts), `whatsapp/save-connection.ts` (waNumbers).
- **`plan-guard.ts` middleware** — defines `requirePlan(minTier)`, `requireQuota(quotaType)`, `requireActiveCommercial()`. Returns HTTP 402 with structured error on failure.

### 2.5 Usage and Meta costs

- **`usage.service.ts`** — `pollConversationAnalytics()` (24h interval) fetches Meta conversation analytics per active WA number, upserts `ConversationCharge` rows. `getOrgUsage()` aggregates 30 days. `estimateCampaignCost()` uses fixed INR rates per category.
- **Campaign quota** (`campaigns/quota.ts`) — daily send limit + daily budget (INR) from org settings, with a reserved-quota ledger using `SELECT ... FOR UPDATE` to prevent race conditions.

### 2.6 Platform admin

- **`platform/orgs.ts`** — `patchPlatformOrgBilling()` lets platform operators set `subscriptionStatus` (active/complimentary/expired/past_due/cancelled) and `planExpiresAt`, with full audit logging. Notes: "Complimentary/extend writes change expiry and status only. They do not create Razorpay payments."

### 2.7 Content Studio credits

- **`cost-guard.ts`** — daily generation limits per plan (`PLAN_LIMITS`) for TEXT_TOKENS, IMAGES, VIDEO_SECONDS, VOICE_MINUTES, STT_MINUTES. `assertBudget()` throws 429 on hard-limit breach; `recordUsage()` increments the ledger.

---

## 3. Bugs and issues (live, as of 2026-08-20)

### 3.1 Critical (money/security)

**C1. Cadence picker is decorative — quarterly/yearly SKUs are never purchased.**
`BillingPage.tsx` has a cadence selector (monthly/quarterly/yearly), but `handlePaidPlan` calls `billingApi.createOrder(plan.id)` with only the plan ID. The server hardcodes `skuId = ${planId}_monthly` (`routes.ts:105`). A user who selects "Yearly · Save 20%" is charged the monthly price. The `cadence` state is passed to `BillingPlanCard` for display only.
- **Files:** `client/src/pages/BillingPage.tsx:103`, `server/src/modules/billing/routes.ts:105`
- **Impact:** Revenue loss (users pay monthly price for yearly selection) + false advertising.

**C2. `activatePlan` always sets +30 days regardless of SKU `periodDays`.**
Even if C1 were fixed to use quarterly/yearly SKUs, `activatePlan()` hardcodes `expiresAt.setDate(expiresAt.getDate() + 30)` (`razorpay.service.ts:106-107`). A yearly payment (₹24,000) would grant only 30 days. The `sku.periodDays` field (30/90/365/14) is never read.
- **Files:** `server/src/modules/billing/razorpay.service.ts:104-117`

**C3. `plan-guard.ts` middleware is completely dead code.**
`requirePlan()`, `requireQuota()`, and `requireActiveCommercial()` are defined in `server/src/middleware/plan-guard.ts` but **never imported by any route file**. Grep for `from '../../middleware/plan-guard'` and `from '../middleware/plan-guard'` returns zero matches. The intended enforcement layer for plan-gating routes is entirely unused.
- **Files:** `server/src/middleware/plan-guard.ts` (defined), no importers.
- **Impact:** No route-level plan gating. Calling, AI bots, campaigns, content studio, public API, templates — none are plan-gated via middleware. Only inline `checkQuota()` calls in 3 modules enforce anything.

**C4. Calling and AI-bot routes have zero plan gating.**
Despite `PLAN_TIERS.pro.callingIncluded = true` and `PLAN_TIERS.growth.aiIncluded = 'included'`, neither the calling module nor the AI-bot module calls `checkQuota` or imports `plan-guard`. A `launch` (trial) org can use calling and AI bots freely.
- **Files:** `server/src/modules/calling/*` (no `checkQuota`/`requirePlan`/`org.plan`), `server/src/modules/ai-bot/*` (same)

**C5. Content Studio `PLAN_LIMITS` uses legacy `business` key, not `pro`.**
`cost-guard.ts:23` defines limits for `starter`, `growth`, `business`, `enterprise`. The new tier is `pro` (not `business`). A `pro`-plan org falls through to `PLAN_LIMITS.starter` (line 60: `PLAN_LIMITS[planId] || PLAN_LIMITS.starter`), getting 5× fewer tokens/images than entitled.
- **Files:** `server/src/modules/content-studio/shared/cost-guard.ts:8-37,60`
- **Note:** `legacyPlanToTier('business')` maps to `pro`, but `cost-guard.ts` reads `org.plan` directly (which can still be `'business'` for grandfathered orgs, or `'pro'` for new orgs). New `pro` orgs are penalized.

**C6. History tab fabricates GST invoice labels from payment amounts.**
`BillingPage.tsx:273-306` computes `basePaise = Math.round(payment.amountPaise / 1.18)` and `gstPaise = payment.amountPaise - basePaise` from the stored `amountPaise`, then displays "GST Paid", "SAC 998315", "incl. 18% GST", "Base: ₹X · GST: ₹Y". There is no invoice model, no GST registration, no invoice number, no PDF generation. These labels are fabricated client-side.
- **Files:** `client/src/pages/BillingPage.tsx:273-306`
- **Impact:** False tax documentation shown to customers. No actual GST compliance.

### 3.2 High (reliability/gaps)

**H1. No recurring billing — `activatePlan` is a one-shot 30-day license.**
There is no Razorpay Subscriptions API integration, no mandate registration, no auto-renewal. When the 30-day license expires, the alert worker marks the org `expired`, but there is no retry, no payment method on file, no dunning sequence. The user must manually re-purchase. UI copy says "Billed monthly · cancel anytime" which is false — it's a 30-day license, not a subscription.
- **Status:** Same as Aug 14 audit. Not fixed.

**H2. `billing:expiring` socket event has zero client listeners.**
The alert worker emits `billing:expiring` (`alert.worker.ts:72`), but grep across the entire `client/` directory finds **no listener** for `billing:expiring`. The `SubscriptionDunningBanner` works around this by polling `GET /api/billing` on mount, but it does not update in real-time. If a trial expires mid-session, the banner only appears on next page load.
- **Files:** `server/src/workers/alert.worker.ts:72` (emits), `client/` (no listener)

**H3. `getOrgEntitlements` has no HTTP endpoint — client cannot see quota usage.**
The entitlements service (`getOrgEntitlements`) returns a rich snapshot of used/limit per quota type, but it is only callable server-side. There is no `GET /api/billing/entitlements` route. The client has no way to display "3/10 seats used" or "2/2 WhatsApp numbers" from the entitlements service. The `GET /api/billing` endpoint returns legacy `seatLimit` from `getSeatLimit()`, not the full entitlements snapshot.
- **Files:** `server/src/modules/billing/routes.ts` (no `/entitlements` route), `entitlements.service.ts` (no export to routes)

**H4. `createPaymentLink` API has zero call sites — dead code.**
`POST /api/billing/payment-link` creates a Razorpay Payment Link but stores nothing in the DB, has no webhook handler for `payment_link.paid`, and is never called by any client component. Grep for `createPaymentLink` in `.tsx` files returns zero matches.
- **Files:** `server/src/modules/billing/payment-links.routes.ts`, `client/src/services/api.ts:677-683`

**H5. Content Studio credits endpoint unused by UI.**
`GET /content-studio/credits` (returns `getCreditSummary`) exists but `ContentStudioPage` does not call `contentStudioApi.getCredits`. Users cannot see their daily generation budget usage.
- **Files:** Same as Aug 14 audit. Not fixed.

**H6. No refund flow.**
There is no code path to refund a Razorpay payment. `PaymentStatus` enum has no `REFUNDED` value. The Razorpay Refunds API is never called. If a customer is charged incorrectly, the only path is manual Razorpay dashboard refund + no DB record.

**H7. `refreshBillingConfig` mutates module-level constants without validation.**
`config.ts` reads a `BILLING_CONFIG` platform setting and **deletes + reassigns** `PLAN_TIERS` keys and **clears + repopulates** `BILLING_SKUS` at runtime. There is no schema validation of the overridden values (an admin could set `pricePaise` to 0 or remove required fields). If the DB setting is malformed, the entire plan catalog is corrupted in-memory with no recovery.
- **Files:** `server/src/modules/billing/config.ts:4-22`

### 3.3 Medium (correctness/consistency)

**M1. Trial expiry skips `launch` and `starter` plans for paid-expiry transition.**
The alert worker transitions `active` + expired → `expired` only when `plan NOT IN ('starter', 'launch')` (`alert.worker.ts:51`). This means:
- A `starter` plan (₹999/mo) that expires stays `active` forever — never downgraded.
- A `launch` trial that expires correctly goes to `trial_expired` (separate rule at line 38).
But `starter` is a **paid** plan (₹999). An expired starter org keeps `subscriptionStatus='active'` and is not locked by `checkQuota` (which only locks `trial_expired/locked/expired/cancelled`).
- **Files:** `server/src/workers/alert.worker.ts:47-56`

**M2. `ConversationCharge` has no Prisma relation to `Organization`.**
The `ConversationCharge` model stores `organizationId` as a plain string field, not a `@relation`. This means cascading deletes on org deletion won't remove charges, and Prisma can't eagerly load them with org queries. (Same as Aug 14 audit.)
- **Files:** `server/prisma/schema.prisma` (ConversationCharge model)

**M3. USD_TO_INR hardcoded at 83 with no refresh.**
`usage.service.ts:7` — `const USD_TO_INR = 83`. Meta charges in USD; this rate is used to convert `costUsd` → `costInr`. The actual USD/INR rate fluctuates daily. A 5% FX move means 5% error in displayed Meta cost estimates.
- **Files:** `server/src/modules/billing/usage.service.ts:7`

**M4. Campaign cost estimates use fixed heuristic rates, not Meta rate cards.**
`CATEGORY_RATES_INR` (`usage.service.ts:9-16`) uses flat per-conversation rates (MARKETING ₹0.78, UTILITY ₹0.35). Real Meta pricing varies by country code, is per-message (not per-conversation) since July 2025, and includes free-form tier changes. The daily budget guard (`assertDailyBudget`) uses these heuristics, so budget enforcement is approximate.

**M5. `pollConversationAnalytics` Graph API call shape may be non-standard.**
The Meta Graph API conversation analytics endpoint uses nested field expansion (`.start().end().granularity()`), not `fields=conversation_analytics.data(querystring)`. Failures are caught and swallowed (`log.warn`), so the UI silently shows zeros if the API call shape is wrong. (Same as Aug 14 audit — not re-verified against current Meta API docs.)
- **Files:** `server/src/modules/billing/usage.service.ts:43-48`, `server/src/modules/whatsapp/meta.service.ts` (`getConversationAnalytics`)

**M6. Daily billing analytics poll has no immediate run — first data appears after 24h.**
`workers/index.ts:889` — `setInterval(poll, 24h)` with no `void run()` before it. A freshly deployed server waits 24 hours before collecting any conversation analytics. Quality ratings similarly wait. (Same as Aug 14 audit.)
- **Files:** `server/src/workers/index.ts:888-896`

**M7. `BillingUsageWidget` may still compare 30-day cost to daily budget.**
The prior audit flagged that the usage widget compares 30-day `totalCostInr` to `dailyBudgetInr`. This was not re-verified in detail, but `BillingPage.tsx:206` passes both `usage` (30d) and `dailyBudgetInr` to `BillingUsageWidget`. If the widget renders a budget bar comparing these two, the comparison is still incorrect.
- **Files:** `client/src/components/billing/BillingUsageWidget.tsx`, `BillingPage.tsx:206`

**M8. `PATCH /api/billing/plan` allows free downgrade to `launch` without resetting trial.**
`routes.ts:290-321` — PATCH accepts `plan: 'launch'|'starter'|'growth'|'pro'|'enterprise'` and sets `planExpiresAt: null`. A user on an expired paid plan could PATCH to `launch` (free), which sets `planExpiresAt = null` and `plan = 'launch'`. Since `launch` is excluded from the expiry transition (`alert.worker.ts:51`), the org effectively gets free access forever. The only guard is that `subscriptionStatus` is not reset — but `getOrgEntitlements` checks `isLocked` based on status, and the PATCH doesn't touch status. So an `expired` org that PATCHes to `launch` stays `expired` (locked). But an `active` org that PATCHes to `launch` stays `active` with no expiry — free forever.
- **Files:** `server/src/modules/billing/routes.ts:314-317`

### 3.4 Low (cosmetic/technical debt)

**L1. No Stripe / international payments.** Razorpay only, INR only. (Same as Aug 14.)

**L2. No Razorpay Subscriptions API.** One-shot Orders only. (Same as Aug 14.)

**L3. No provider event idempotency table for Razorpay webhooks.** Unlike `ProviderWebhookEvent` used for Meta webhooks, Razorpay webhooks have no event-id dedup table. A replayed webhook (same event, different delivery) would be processed twice — though the `status !== 'CAPTURED'` guard in the webhook handler mitigates double-activation. (Same as Aug 14, partially mitigated.)

**L4. Legacy `BILLING_PLANS` still served by `GET /api/billing`.** The deprecated `BILLING_PLANS` array is still returned to the client for backward compat, alongside the new `BILLING_SKUS` which are never sent to the client. The client renders `info.plans` (legacy) in the plan grid. SKU data (quarterly/yearly pricing, GST amounts) is never exposed to the UI.

**L5. `getPlan()` and `BILLING_PLANS` are marked `@deprecated` but still actively used.** `routes.ts:8` imports both `BILLING_PLANS` and `getPlan`. The `GET /` handler uses `getPlan(org.plan) || BILLING_PLANS[0]`. No migration path to remove them.

**L6. Test suite could not be executed in this environment.** The billing tests (`plans.test.ts`, `entitlements.service.test.ts`, `usage.service.test.ts`, `razorpay.service.test.ts`) exist and cover: SKU prices, GST calculation, UPI cap logic, tier mapping, entitlements enforcement, quota blocking, campaign cost estimation, usage aggregation, signature verification, order creation, and plan activation. However, `npx vitest run src/modules/billing/` was blocked by the sandbox. Test coverage was assessed by reading the test files directly. The tests mock Prisma and do not exercise real DB or Razorpay API calls.

---

## 4. Entitlements enforcement matrix

| Feature/Quota | Enforcement | Mechanism | Status |
|---|---|---|---|
| WhatsApp numbers | ✅ Enforced | `checkQuota('waNumbers')` in `save-connection.ts:79` | Working |
| Team seats | ✅ Enforced | `getSeatLimit()` clamps to plan max in `team/types.ts:124` | Working |
| Contacts | ✅ Enforced | `checkQuota('contacts')` in `contacts/routes.ts:67,138` | Working |
| Published workflows | ✅ Enforced | `checkQuota('publishedWorkflows')` in `automation/routes.ts:124,164` | Working |
| AI assistant | ❌ Not enforced | `checkQuota('ai')` defined but never called | Dead |
| Calling module | ❌ Not enforced | `checkQuota('calling')` defined but never called; no import in calling routes | Dead |
| Campaigns | ❌ Not plan-gated | Daily send/budget from org settings, not plan tier | Settings-only |
| Content Studio | ⚠️ Partial | `cost-guard.ts` enforces daily limits by plan, but uses legacy `business` key not `pro` | Buggy |
| Public API | ❌ Not enforced | No plan check in `public-api/routes.ts` | Open |
| Templates | ❌ Not enforced | No plan cap on template count | Open |
| Advanced analytics | ❌ Not enforced | `analyticsAdvanced` flag in tier def, never checked | Display only |
| Subscription lock | ✅ Enforced | `checkQuota` checks `isLocked` on every quota call | Working |
| `requirePlan` middleware | ❌ Dead code | Defined in `plan-guard.ts`, never imported | Dead |
| `requireQuota` middleware | ❌ Dead code | Defined in `plan-guard.ts`, never imported | Dead |
| `requireActiveCommercial` middleware | ❌ Dead code | Defined in `plan-guard.ts`, never imported | Dead |

---

## 5. Data model

| Model | Fields | Notes |
|---|---|---|
| `Organization` | `plan` (String), `planExpiresAt` (DateTime?), `subscriptionStatus` (String, default `"active"`), `settings` (JSON) | No provider customer ID, no GSTIN, no billing email, no Razorpay subscription ID. |
| `PaymentOrder` | `razorpayOrderId` (unique), `planId`, `amountPaise`, `currency` (default INR), `status` (CREATED/AUTHORIZED/CAPTURED/FAILED), `paymentId?`, `paidAt?` | No `skuId` field — `planId` stores the plan tier, not the purchased SKU. No `cadence` field. `AUTHORIZED` unused in routes. |
| `ConversationCharge` | `organizationId`, `wabaId`, `phoneNumberId`, `category`, `country` (default IN), `conversationCount`, `costUsd`, `costInr`, `periodStart`, `periodEnd` | Unique on org+waba+phone+category+periodStart. **No Prisma relation to Organization.** |
| `GenerationCreditLedger` | `organizationId`, `periodStart`, `kind` (TEXT_TOKENS/IMAGES/VIDEO_SECONDS/VOICE_MINUTES/STT_MINUTES), `usedUnits` (BigInt), `softLimitUnits`, `hardLimitUnits` | Content Studio only. Limits from `cost-guard.ts` by `org.plan`. |
| `OrgFeatureFlag` | `content_studio`, `voice_studio`, `video_studio`, `public_api`, `zapier_integration`, `commerce`, `calling` | Default false. `requireFeature()` is never called. (Same as Aug 14.) |
| `CampaignQuotaLedger` | `organizationId`, `periodStart`, `reservedSendCount`, `reservedBudgetCents` | Campaign safety, not SaaS billing. |
| Invoice / Credit / Tax / Subscription / Refund | — | **Do not exist.** |

---

## 6. Webhook reliability

| Aspect | Status | Notes |
|---|---|---|
| Raw body preservation | ✅ | `express.raw` + `rawJsonBodyParser` mounted at `/api/billing/webhook` before `express.json()` (`index.ts:191-195`) |
| Signature verification | ✅ | `crypto.timingSafeEqual` with `webhookSecret` (`razorpay.service.ts:77-98`) |
| Missing secret handling | ✅ | Logs CRITICAL, returns false (rejects all webhooks) |
| Events handled | `payment.captured`, `payment.failed` | Missing: `order.paid`, `subscription.*`, `payment_link.paid`, `refund.*` |
| Idempotency | ✅ (partial) | `status !== 'CAPTURED'` guard prevents double-activation. No event-ID dedup table. |
| Activation source | ✅ | Uses `PaymentOrder.planId` (DB), not payment notes |
| Public URL requirement | ⚠️ | Razorpay dashboard must point to HTTPS webhook URL. Local dev needs tunnel. |

---

## 7. Frontend surface

| Component | Path | Status |
|---|---|---|
| BillingPage | `client/src/pages/BillingPage.tsx` | Tabs: overview, plans, history. Cadence picker (decorative — see C1). |
| BillingHero / PlanCard / FeatureMatrix | `client/src/components/billing/*` | Display only |
| BillingUsageWidget | `client/src/components/billing/BillingUsageWidget.tsx` | 30d usage + budget bar (possible 30d-vs-daily comparison — see M7) |
| SubscriptionDunningBanner | `client/src/components/billing/SubscriptionDunningBanner.tsx` | ✅ Rendered in `Layout.tsx:142`. Polls `GET /api/billing`. Handles trial/expired/past_due/locked. No socket listener (see H2). |
| QualityRatingBanner | `client/src/components/billing/QualityRatingBanner.tsx` | YELLOW/RED → link to `/billing` |
| UnlockGrowthModal | `client/src/components/billing/UnlockGrowthModal.tsx` | Upsell modal |
| MetaCostExplainerCard | `client/src/components/billing/MetaCostExplainerCard.tsx` | Explains Meta vs SaaS billing |
| Checkout helper | `client/src/utils/razorpay.ts` | Loads Checkout.js, opens modal with `order_id` |
| API client | `client/src/services/api.ts:665-684` | `billingApi` — all POST/GET verbs correct. `createPaymentLink` dead (see H4). |
| Campaign cost preview | `client/src/components/campaigns/CampaignAudiencePreview.tsx` | ✅ Calls `billingApi.estimateCost` (POST) — bug fixed |

---

## 8. Test coverage

Four test files exist in `server/src/modules/billing/`:

| File | Covers | Mocks | Gaps |
|---|---|---|---|
| `plans.test.ts` | SKU IDs, prices, GST calculation (18%), UPI cap logic, tier mapping, legacy plan lookup | None (pure functions) | Does not test `refreshBillingConfig` mutation |
| `entitlements.service.test.ts` | `isTierSufficient`, `getBoundedSeatLimit`, `getOrgEntitlements` (launch/growth tiers), `checkQuota` (waNumbers, ai, contacts, locked state) | Prisma | Does not test `seats` quota, `calling` quota, `publishedWorkflows` blocking |
| `usage.service.test.ts` | `estimateCampaignCost` (all categories, rounding, zero), `getOrgUsage` (aggregation, quality ratings, empty state) | Prisma, MetaWhatsAppService, logger, events | Does not test `pollConversationAnalytics`, `pollQualityRatings`, `pollTemplateRejections` |
| `razorpay.service.test.ts` | `isRazorpayConfigured`, `verifyPaymentSignature` (valid/invalid/empty/wrong-length), `verifyWebhookSignature` (valid/invalid/missing-secret/empty), `createRazorpayOrder` (payload/auth/error/unconfigured), `activatePlan` (expiry/status/errors) | config, logger, Prisma | Does not test webhook event routing (payment.captured vs payment.failed) |

**Note:** Tests could not be executed in this environment (sandbox blocked `npx vitest`). Coverage assessment is based on reading the test files. All tests mock Prisma and external APIs — no integration tests against real DB or Razorpay.

---

## 9. Platform admin billing controls

| Capability | Status | Notes |
|---|---|---|
| View org billing | ✅ | `platform/orgs.ts` — returns plan, expiry, status |
| Set subscription status | ✅ | `patchPlatformOrgBilling` — active/complimentary/expired/past_due/cancelled |
| Extend expiry | ✅ | Same endpoint, sets `planExpiresAt` |
| Audit log | ✅ | `writePlatformAudit` with before/after state |
| Health snapshot | ✅ | `upsertOrgHealthSnapshot` after billing change |
| Override plan tier | ❌ | Cannot change `org.plan` from admin (only status + expiry) |
| Create invoices | ❌ | Not implemented |
| Process refunds | ❌ | Not implemented |
| Complimentary note | ✅ | "Complimentary/extend writes change expiry and status only. They do not create Razorpay payments (SAMYOJ-35)." |

---

## 10. Comparison: Aug 14 audit vs Aug 20 reality

| Capability | Aug 14 | Aug 20 | Change |
|---|---|---|---|
| Plan catalog | 4 plans, 2 prices | 5 tiers, 10 SKUs with cadences + GST | ✅ Major improvement |
| Trial flow | Missing | 14-day Launch trial with expiry transition | ✅ Built |
| Checkout verify plan source | Client body (injectable) | DB `PaymentOrder.planId` | ✅ Fixed |
| Verify idempotency | Not idempotent | Guarded with status check | ✅ Fixed |
| Signature comparison | `===` | `timingSafeEqual` | ✅ Fixed |
| Entitlements | Missing | Service + 3 modules wired | ⚠️ Partial (4+ modules still ungated) |
| Expiry enforcement | Socket event only | Worker transitions status | ✅ Built |
| Dunning banner | Missing | Polls HTTP, shows 4 states | ✅ Built (no socket listener) |
| Payment.failed handling | Missing | Marks FAILED + emits event | ✅ Built |
| Seat limit clamping | Overridable to 500 | Clamped to plan max | ✅ Fixed |
| Recurring subscription | Missing | Still missing | ❌ Not started |
| Invoice / GST | Missing | Missing (UI fabricates labels) | ❌ Not started |
| Dunning / retry | Missing | Still missing | ❌ Not started |
| Refunds | Missing | Still missing | ❌ Not started |
| plan-guard middleware | N/A | Defined but unused | ❌ Dead code |
| Calling/AI plan gating | Missing | Still missing | ❌ Not started |
| Content Studio limits | `business` key | Still `business` key (not `pro`) | ❌ Not fixed |
| Cadence purchase | N/A | SKUs exist but checkout hardcodes monthly | ❌ New bug |

---

## 11. Recommended priorities

1. **Fix cadence checkout (C1 + C2).** Pass `cadence` from client → server, resolve `skuId = ${planId}_${cadence}`, use `sku.pricePaise` for order amount, and use `sku.periodDays` in `activatePlan` instead of hardcoded 30. This is a one-day fix that unblocks quarterly/yearly revenue.

2. **Wire `plan-guard.ts` middleware or delete it (C3).** Either import `requirePlan`/`requireQuota`/`requireActiveCommercial` into calling, AI-bot, campaigns, content-studio, and public-api routes, or remove the dead file to avoid false confidence. Currently it implies enforcement exists when it doesn't.

3. **Fix Content Studio `PLAN_LIMITS` key (C5).** Change `business` → `pro` in `cost-guard.ts:23`. One-line fix. Pro-tier orgs are currently getting starter-tier generation limits.

4. **Gate calling and AI-bot on plan (C4).** Add `checkQuota('calling')` / `checkQuota('ai')` to the respective route files, matching the pattern already used in contacts and automation.

5. **Stop fabricating GST invoice labels (C6).** Either remove the "GST Paid", "SAC 998315" labels from the history tab, or implement actual invoice generation. Displaying fake tax documentation to customers is a compliance risk.

6. **Fix `PATCH /api/billing/plan` free-downgrade exploit (M8).** Prevent downgrading to `launch` without resetting `subscriptionStatus`, or disallow PATCH to `launch` entirely (it's a trial-only tier).

7. **Add `billing:expiring` socket listener in the client (H2).** The `SubscriptionDunningBanner` should subscribe to the socket event for real-time updates, not just poll on mount.

8. **Expose `getOrgEntitlements` via HTTP (H3).** Add `GET /api/billing/entitlements` so the client can display quota usage bars (seats, WA numbers, contacts, workflows).

9. **Ship recurring billing (H1).** This is the largest remaining gap. Razorpay Subscriptions API + mandate registration + auto-renewal + dunning sequence. Until this exists, the product is a 30-day license, not a subscription. Update UI copy accordingly.

10. **Add refund flow (H6).** At minimum, a `POST /api/billing/refund` endpoint that calls Razorpay Refunds API + records a `REFUNDED` status on `PaymentOrder`.

---

## 12. File index (read for this review)

- `server/src/modules/billing/plans.ts` — SKU catalog, plan tiers, legacy plans
- `server/src/modules/billing/routes.ts` — all billing endpoints
- `server/src/modules/billing/razorpay.service.ts` — order creation, signature verification, plan activation
- `server/src/modules/billing/entitlements.service.ts` — quota checking, entitlements snapshot
- `server/src/modules/billing/usage.service.ts` — conversation analytics polling, usage aggregation, cost estimation
- `server/src/modules/billing/payment-links.routes.ts` — dead payment links API
- `server/src/modules/billing/config.ts` — runtime plan config override
- `server/src/modules/billing/*.test.ts` — four test files
- `server/src/middleware/plan-guard.ts` — dead middleware (requirePlan/requireQuota/requireActiveCommercial)
- `server/src/modules/team/types.ts` — seat limit logic
- `server/src/modules/content-studio/shared/cost-guard.ts` — generation budget limits
- `server/src/modules/campaigns/quota.ts` — daily send/budget quota with reserved ledger
- `server/src/modules/platform/orgs.ts` — admin billing override
- `server/src/modules/auth/routes.ts` — signup trial creation
- `server/src/modules/public-api/routes.ts` — public API (no plan gating)
- `server/src/workers/index.ts` — embedded workers, daily analytics poll
- `server/src/workers/alert.worker.ts` — expiry transitions, billing:expiring event
- `server/src/index.ts` — route mounting, raw body parser
- `server/src/config/index.ts` — Razorpay config
- `server/prisma/schema.prisma` — PaymentOrder, Organization, ConversationCharge models
- `client/src/pages/BillingPage.tsx` — billing UI
- `client/src/components/billing/*` — billing UI components
- `client/src/components/Layout.tsx` — dunning banner mount
- `client/src/components/campaigns/CampaignAudiencePreview.tsx` — cost estimate consumer
- `client/src/utils/razorpay.ts` — Checkout.js loader
- `client/src/services/api.ts` — billingApi client
- `docs/audit/BILLING_SYSTEM_REVIEW.md` — prior audit (2026-08-14)
- `docs/billing/README.md` — target product specification pack
