# Billing system review

**Date:** 2026-08-14  
**Workspace:** `/workspaces/Samyoj`  
**Mode:** Code audit only. No application code was changed.  
**Companion canvas:** `.cursor` canvases `billing-system-review.canvas.tsx`

This is a proof-of-concept (POC) walkthrough of billing **as implemented today**, plus what a complete flow would require. It does not cover AI voice, calls product, or WhatsApp webhook inbound plumbing except where billing reads Meta analytics/quality.

---

## 1. Executive summary

Samyoj has a **real Razorpay checkout for two INR plans**, not a full billing product.

What is real: a Billing page, hard-coded plans (`starter` / `growth` / `business` / `enterprise`), `POST /api/billing/create-order` + Checkout.js + `POST /api/billing/verify`, a Razorpay `payment.captured` webhook with raw-body HMAC, `PaymentOrder` rows, `Organization.plan` + `planExpiresAt` + `subscriptionStatus`, a 30-day Meta usage snapshot UI, campaign cost **heuristics**, team seat checks, and Content Studio daily generation caps keyed off `org.plan`.

What is incomplete or misleading: plans are marketing copy, not entitlements. Campaigns, AI bots, calling, extra WhatsApp numbers, contact caps, and public API are **not** gated on plan. There is **no invoice model, no GST, no Stripe, no Razorpay Subscriptions, no cancel, no dunning, no auto-renew**. `activatePlan` always sets expiry to **now + 30 calendar days**. Expiry only emits a Socket.IO event `billing:expiring`; nothing downgrades the org. Payment links exist as an API and are **not** wired to Inbox. `FEATURE_MATRIX.md` marks billing DONE; several of those rows are false or drifted.

**Overall: 4/10** — demo-grade checkout. Not ready to charge customers as a subscription.

---

## 2. POC: flow as coded today

Signup never shows a plan picker. Paid upgrade is a one-shot Razorpay **Order**, not a subscription.

1. **Signup.** `POST` register (`server/src/modules/auth/routes.ts`) or Google OAuth (`oauth.routes.ts`) creates `organization` with Prisma defaults: `plan = "starter"`, `subscriptionStatus = "active"`, `planExpiresAt = null`. No trial column.
2. **Billing UI.** OWNER/ADMIN nav to `/billing` (`client/src/config/navigation.ts`). `GET /api/billing` returns `BILLING_PLANS`, current plan, `seatsUsed`, `seatLimit`, `razorpayConfigured`, last 5 `CAPTURED` payments (`server/src/modules/billing/routes.ts`).
3. **Choose paid plan.** Growth ₹3,999 or Business ₹11,999 (`server/src/modules/billing/plans.ts`). Enterprise shows “Contact sales” toast. Starter uses `PATCH /api/billing/plan` (free switch only). Paid `PATCH` returns 400 (“Use Razorpay checkout”).
4. **Create order.** `POST /api/billing/create-order` with `planId: growth|business`, permission `manageSettings`. Calls Razorpay `POST /v1/orders` (INR paise) and inserts `PaymentOrder` `CREATED` (`razorpay.service.ts`, `routes.ts`).
5. **Checkout.** Client loads `https://checkout.razorpay.com/v1/checkout.js` (`client/src/utils/razorpay.ts`) with `keyId`, `order_id`, amount.
6. **Verify (primary activation).** Checkout `handler` → `POST /api/billing/verify`. HMAC-SHA256 of `orderId|paymentId` with `RAZORPAY_KEY_SECRET`. Marks order `CAPTURED`, then `activatePlan(orgId, data.planId)` — **`data.planId` comes from the client body, not from `PaymentOrder.planId`.**
7. **Webhook (backup).** `POST /api/billing/webhook` is mounted with `express.raw` in `server/src/index.ts`. Verifies `x-razorpay-signature` with `RAZORPAY_WEBHOOK_SECRET`. Handles only `payment.captured`. Activates only if `payment.entity.notes` contains `organizationId` and `planId`. Checkout.js does **not** attach payment notes; order notes were set at create time. If Razorpay does not copy order notes onto the payment entity, webhook is a no-op (HTTP 200).
8. **Entitlements.** `activatePlan` writes `plan`, `planExpiresAt = now+30d`, `subscriptionStatus = "active"`. No middleware then checks plan for campaigns, AI, calling, templates, or WhatsApp connect.
9. **Usage.** Workers (`server/src/workers/index.ts`) every 24 hours (not at t=0) call `pollConversationAnalytics` / `pollQualityRatings`. Results land in `ConversationCharge` and `WhatsappNumber.qualityRating`. `GET /api/billing/usage` aggregates 30 days. Campaign “cost” uses fixed INR rates in `usage.service.ts`, not Meta invoices. Alert worker emits `billing:expiring` within 3 days of `planExpiresAt`; **no client listener**.
10. **Invoice.** Not implemented. History tab lists recent `PaymentOrder` amounts. Razorpay receipts are not fetched or stored.

**Complete flow (not built):** trial → recurring subscription / mandate → signed webhook that keys off `PaymentOrder` → entitlement middleware → metered Meta + AI usage → GST invoice → dunning → expire/downgrade.

---

## 3. Data model

| Store | Fields | Notes |
| --- | --- | --- |
| `Organization` (`schema.prisma`) | `plan` default `"starter"`; `planExpiresAt`; `subscriptionStatus` default `"active"`; `settings` JSON | Entire SaaS subscription state. No provider customer id, no GSTIN, no billing email. |
| `PaymentOrder` | `razorpayOrderId` unique, `planId`, `amountPaise`, `currency` default INR, `status` CREATED/AUTHORIZED/CAPTURED/FAILED, `paymentId`, `paidAt` | One-shot checkout records. `AUTHORIZED`/`FAILED` unused in routes. |
| `ConversationCharge` | org, waba, phoneNumberId, category, country default IN, conversationCount, costUsd, costInr, periodStart/End | Unique on org+waba+phone+category+periodStart. **No Prisma relation** to `Organization`. |
| `GenerationCreditLedger` | daily period, `kind` TEXT_TOKENS/IMAGES/VIDEO_SECONDS/VOICE_MINUTES/STT_MINUTES, used/soft/hard units | Content Studio only. Limits from `cost-guard.ts` by `org.plan`. |
| `AiUsageLog` | tokens per chat/embedding | Quota is `settings.ai.monthlyTokenLimit`, not `plans.ts`. `0`/absent = unlimited. |
| `OrgFeatureFlag` | `content_studio`, `voice_studio`, `video_studio`, `public_api`, `zapier_integration`, `commerce`, `calling` | Default false. `requireFeature()` is **never called**. |
| `Order` (commerce) | Catalog checkout | **Not** SaaS billing. |
| Invoice / Credit / Tax / Stripe customer | — | **Do not exist.** |

Team seat numbers live in `Organization.settings.team.seatLimit` (`server/src/modules/team/types.ts`), not in a billing table.

---

## 4. Backend surface

**Module:** `server/src/modules/billing/` — `plans.ts`, `routes.ts`, `razorpay.service.ts`, `usage.service.ts`, `payment-links.routes.ts`.

Mounted at `/api/billing` (`server/src/index.ts`). Webhook path also gets a dedicated raw-body parser before `express.json()`.

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `GET /` | JWT + org | Plan catalog, seats, Razorpay public key id if configured, last 5 captured payments |
| `GET /usage` | JWT + org | `getOrgUsage` |
| `POST /estimate` | JWT + org | `{ recipientCount, category }` → heuristic INR |
| `POST /create-order` | `manageSettings` | `growth` \| `business` only |
| `POST /verify` | `manageSettings` | Signature + capture + `activatePlan` |
| `POST /webhook` | Razorpay HMAC | `payment.captured` only |
| `PATCH /plan` | `manageSettings` | Free `starter` only |
| `POST /payment-link` | `manageSettings` | Razorpay Payment Links API; **not stored** |

**Workers (API-embedded when Redis is up):**

- `workers/index.ts`: `setInterval` 24h → `pollConversationAnalytics`, `pollQualityRatings` (no immediate run).
- `alert.worker.ts` (~30s): SLA + `billing:expiring` + `pollTemplateRejections` (template alerts on `org.settings`, not invoices).

**Public API:** `GET /api/v1/usage` reuses `getOrgUsage` (`public-api/routes.ts`).

**Config** (`server/src/config/index.ts`): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Names only; values live in `server/.env`. Example placeholders in `server/.env.example`. Test vs live is whichever Razorpay key is configured — no `NODE_ENV` split in billing code.

**Not present:** Stripe, Razorpay Subscriptions API, refunds, invoices, tax, customer portal, billing cron to expire plans.

**Tests:** no billing module tests. Only `billingCategoryForTemplate` in `campaigns/validation.test.ts`.

---

## 5. Frontend surface

| Piece | Path | Notes |
| --- | --- | --- |
| Page | `client/src/pages/BillingPage.tsx` | Tabs: overview, plans, history |
| Cards / hero / usage / skeleton | `client/src/components/billing/*` | Copy says “Billed monthly · cancel anytime” |
| Checkout helper | `client/src/utils/razorpay.ts` | |
| API client | `billingApi` in `client/src/services/api.ts` | |
| Quality banner | `QualityRatingBanner` in `Layout.tsx` | YELLOW/RED → link `/billing` |
| Nav | `navigation.ts` `ADMIN_ROLES` | `/billing` route in `App.tsx` is only `ProtectedRoute`, not role-gated |
| Campaign cost | `CampaignAudiencePreview` | Calls `billingApi.estimateCost` as **GET** |
| Campaign quota banner | `CampaignQuotaBanner` | `campaignApi.quota()`, not billing |
| Payment link | `billingApi.createPaymentLink` | **Zero call sites** (not ChatComposer) |
| Content Studio credits | `contentStudioApi.getCredits` | **Unused** by `ContentStudioPage` |

Plan change permission is `canManageBilling` ← `manageSettings` (OWNER/ADMIN by default).

---

## 6. Connections to other modules

| Area | Connected? | Evidence |
| --- | --- | --- |
| **Team seats** | Partial | Invite/create member uses `getSeatLimit` (`team/routes.ts`). If `settings.team` is missing, billing GET uses plan seats (starter=5). `getTeamSettingsFromOrg` always merges `DEFAULT_TEAM_SETTINGS.seatLimit = 25`, so team invite enforcement is 25 for starter. `PATCH /api/team/settings` accepts `seatLimit` 1–500 with **no plan check**. Team settings UI does not expose the field; saving any other team setting persists the default 25. |
| **Campaigns** | Adjacent, not plan-gated | `quota.ts` daily send/budget from **org settings** (defaults 5000 / ₹5000). Uses `estimateCampaignCost`. Reservation ledger is campaign safety, not SaaS billing. |
| **WhatsApp numbers** | Usage only | Quality poll + Connect guide read `/billing/usage`. Starter “1 WhatsApp number” is **not** enforced on connect. |
| **Inbox** | No | No paywall. Payment-link-from-chat is documented, not implemented. |
| **Templates** | Ops only | `pollTemplateRejections` writes `settings.alerts`. No template-count plan cap. |
| **AI** | Separate meter | `checkOrgTokenQuota` in `chat-completion.service.ts` if `monthlyTokenLimit` set in Settings → AI. Independent of `plans.ts`. |
| **Content Studio** | Yes (only real plan meter besides seats) | `assertBudget` / `recordUsage` in composer/images/voices/videos. `GET /content-studio/credits` exists; UI does not show it. Ledger limits freeze at create; plan change does not rewrite `hardLimitUnits`. |
| **Calling** | No | Business feature bullet only. `calling` feature flag unused (`requireFeature` never called). |
| **Public API / flags** | Display only | Flags API exists; routes are not wrapped. |
| **Commerce `Order`** | No | Catalog orders, different money. |

---

## 7. Payment provider and webhook reliability

**Provider:** Razorpay only (`https://api.razorpay.com/v1`). No Stripe.

**Checkout reliability:** Order create + client verify is the path that works **if** keys are set. `isRazorpayConfigured()` is key id + secret; webhook secret is separate. If webhook secret is empty, `verifyWebhookSignature` returns false and the webhook 400s.

**Webhook gaps:**

- Only `payment.captured` (not `payment.failed`, `order.paid`, `subscription.*`, `payment_link.paid`).
- Activation keyed off **payment notes**, while `PaymentOrder` already has `organizationId` + `planId`.
- No provider event idempotency table for Razorpay (unlike `ProviderWebhookEvent` used elsewhere).
- Verify is **not** idempotent: a second valid verify re-calls `activatePlan` and **extends expiry another 30 days**.
- HMAC compare is `===`, not `crypto.timingSafeEqual` (Meta webhooks elsewhere do use timing-safe compare).
- `planId` on verify is attacker-controllable among `growth|business` after a valid payment HMAC.

**Local vs production:** billing code does not special-case local. Empty Razorpay env → UI shows “Paid checkout is unavailable”. Live keys would charge real INR; test keys (`rzp_test_…` in `.env.example`) would not. Webhook still needs a **public HTTPS** URL in the Razorpay dashboard (same class of problem as Meta inbound, but this is Razorpay’s dashboard, not ngrok-for-WhatsApp).

Payment links: created at Razorpay, notes include `organizationId`, **no DB row, no webhook handler, no Inbox send**. They collect money *for the org’s customers*, not Samyoj subscription fees — and even that UX is missing.

---

## 8. Built / partial / missing

| Capability | Status | Notes |
| --- | --- | --- |
| Plan catalog (INR, hard-coded) | Built | `plans.ts` |
| Billing settings page | Built | Overview / plans / history |
| Razorpay order + Checkout.js | Built | Growth + Business |
| Payment signature verify | Built | Plan id not bound to order |
| Razorpay webhook | Partial | Captured-only; notes-dependent |
| `PaymentOrder` persistence | Built | Last 5 in UI |
| Recurring subscription | **Missing** | Copy pretends monthly |
| Cancel / portal / dunning | **Missing** | |
| Invoice / GST / PDF | **Missing** | |
| Stripe / USD / EUR | **Missing** | |
| Trial | **Missing** | |
| Feature entitlements | **Missing** | Plan string unused by product modules |
| Seat enforcement | Partial | Overridden by team default 25; PATCH to 500 |
| Contact / WA-number caps | **Missing** | Copy only |
| Meta conversation cost | Partial | Table + poll; Graph field `conversation_analytics.data(querystring)` is not standard field expansion; Meta has moved to per-message pricing |
| Message `metadata.pricing` | Partial | Webhook processor stores it; usage endpoint only **counts** rows, does not sum cost |
| Campaign cost estimate | Partial / broken UI | Server POST, client GET |
| Campaign daily budget | Built (settings) | Heuristic, not Meta bill |
| AI token cap | Partial | Optional org setting |
| Content Studio credits | Partial | Enforced, not shown |
| Payment links | Stub API | No UI, no persistence |
| Feature flags as paywall | Dead | `requireFeature` unused |
| Expiry enforcement | Stub | Socket only |
| Billing tests | **Missing** | |
| `FEATURE_MATRIX` honesty | Failed | Marks payment links + ChatComposer DONE |

---

## 9. Bugs and inconsistencies

1. **`POST /verify` activates `req.body.planId`, ignoring `PaymentOrder.planId`.** Paying for Growth and posting `planId: "business"` upgrades to Business. (`server/src/modules/billing/routes.ts`)
2. **Webhook may never activate** if `payment.entity.notes` lacks `planId` / `organizationId`. Checkout does not set payment notes. (`routes.ts` webhook + `razorpay.ts` checkout options)
3. **`billingApi.estimateCost` uses GET; server route is POST.** Campaign audience cost preview fails at runtime. (`client/src/services/api.ts` vs `routes.ts`)
4. **Seat limit inconsistency.** Billing page (no team JSON) → starter 5. Team invite path always sees default **25**. Saving team settings persists 25 onto the org. Admins can PATCH `seatLimit` up to 500.
5. **Verify replay extends the paid window** by 30 days; no `status !== CAPTURED` guard.
6. **`BillingUsageWidget` daily budget bar** compares **30-day** `totalCostInr` to **daily** `campaigns.dailyBudgetInr`.
7. **Plan feature bullets are false advertising** until gates exist (AI bots / campaigns / voice / API / 500 contacts / 1 number).
8. **`subscriptionStatus` stays `active` for free starter and after expiry.** Nothing writes `expired` / `cancelled` / `past_due`.
9. **`pollConversationAnalytics` Graph call** uses `fields=conversation_analytics.data(${URLSearchParams})`. Meta’s documented shape is nested field expansion (`.start().end().granularity()`), and conversation-based analytics is the pre–July 2025 model. Failures are logged and swallowed; UI then shows zeros.
10. **Docs:** `FEATURE_MATRIX.md` cites `/api/billing/create-payment-link` and `/payment-links`; real path is `/api/billing/payment-link`. `docs/AUDIT.md` (June 2026) said ConversationCharge did not exist — it does now; treat that audit as stale on M1.

---

## 10. Recommended next work (priority)

1. **Bind money to the order row.** Verify and webhook must use `PaymentOrder.planId` + `amountPaise`. Reject mismatches. Make verify idempotent. Prefer order lookup over payment notes.
2. **Fix `estimateCost` HTTP verb** so campaign cost preview works (one-line client or server change).
3. **Ship entitlements or stop selling them.** One `requirePlan` / quota helper for seats (ignore arbitrary team override unless billed), WhatsApp number count, campaigns, AI, calling, public API. Align `plans.ts` copy with enforcement.
4. **Expiry is a billing feature.** Worker: if `planExpiresAt < now` and plan ≠ starter → `subscriptionStatus=expired` and downgrade or lock paid surfaces. Client: listen for `billing:expiring`.
5. **Do not charge production until invoices exist.** Either implement Razorpay Subscriptions + GST invoices, or change UI copy to “30-day license, pay again to renew.” Payment-link-in-chat and Stripe are later; they are not blockers for an honest INR license.

---

## File index (read for this review)

- `server/prisma/schema.prisma` — Organization, PaymentOrder, ConversationCharge, AiUsageLog, GenerationCreditLedger, OrgFeatureFlag, Order
- `server/src/modules/billing/*`
- `server/src/modules/team/types.ts`, `team/assignment.ts`, `team/routes.ts` (seats)
- `server/src/modules/campaigns/quota.ts`, `campaigns/types.ts`
- `server/src/modules/content-studio/shared/cost-guard.ts`
- `server/src/modules/ai/org-ai.service.ts`
- `server/src/modules/settings/feature-flags.ts`
- `server/src/workers/index.ts`, `alert.worker.ts`
- `server/src/index.ts` (webhook raw body)
- `client/src/pages/BillingPage.tsx`, `components/billing/*`, `utils/razorpay.ts`, `services/api.ts`
- `docs/audit/FEATURE_MATRIX.md` §11, `docs/API.md`, `server/.env.example`
