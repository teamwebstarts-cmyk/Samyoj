# 14 — Implementation blueprint (no code)

Phased. Each phase has **acceptance criteria**. Do not start Phase 1 catalog in production until Phase 0 cannot steal a plan.

## Phase 0 — Money safety (Orders path still live)

1. `verify` and webhook activate **only** `PaymentOrder.planId` / amount.
2. Idempotent capture (replay ≠ extra 30d).
3. `timingSafeEqual`; refuse empty webhook secret.
4. Write `past_due` / do not leave paid `active` if you already expire (even +30d model).
5. Fix estimateCost method mismatch if campaigns are used in prod.

**Accept:** Pay Growth, POST business → still Growth. Replay verify → same `planExpiresAt`. Tampered amount → 400.

## Phase 1 — Catalog + trial (still can be one-shot while Subscriptions WIP)

1. Replace `plans.ts` with TARGET SKUs (do not take money on new prices until Subscriptions or honest “30-day license” copy).
2. Signup → `launch` + `trialEndsAt`.
3. Unlock Growth copy. GST exclusive display.
4. Meta footnote on pricing/checkout/connect ([17](17-META-WHATSAPP-BILLING-AND-POLICY.md) §4.6).

**Accept:** New org is Launch 14d, AI 403, 2nd number 403. Pricing page matches [01](01-PRICING-CATALOG.md).

**Do not** silently charge grandfathered orgs the new price.

## Phase 2 — Razorpay recurring

1. Razorpay Plans for each SKU (incl-GST amount vs ex-GST — [05](05-PAYMENTS-RAZORPAY.md)).
2. Subscriptions + mandate Checkout.
3. Webhooks list in 05.
4. UPI Autopay hidden when incl GST > ₹15,000.
5. Cancel at period end.

**Accept:** Test subscription renews in Razorpay test; our `currentPeriodEnd` moves once per `charged`. Halt → locked send.

## Phase 3 — Entitlements

Middleware for slots, seats (including PATCH), contacts, workflows, AI, calling flag. Content Studio remap. Campaign Launch cap.

**Accept:** Automated tests for each row in [10](10-GATING-MATRIX.md). Extra Meta numbers not attached.

## Phase 4 — Invoices / GST

Rule 46 PDF, GSTIN, place of supply, credit notes. Razorpay = receipt only.

**Accept:** CA checklist against one live invoice.

## Phase 5 — Dunning + Meta honesty

Grace/lock emails. Usage labeled estimate. Quality CTA to WhatsApp Manager. INR migration banner. Oct 2026 service-message comms. Optional `pricing` webhook ingest (still not an invoice).

**Accept:** Failed UPI shows past_due < 5 min. Usage page cannot be screenshot as “Meta bill” without disclaimer.

## Dependencies / risks

See executive “top 10 risks” in the pack README summary. Counsel: Tech Provider vs SP; GST SAC; WhatsApp legal update **2026-09-23**.

## Explicit non-goals

Product code is **not** in this pack. No Prisma migrations here. No Checkout implementation in this folder.
