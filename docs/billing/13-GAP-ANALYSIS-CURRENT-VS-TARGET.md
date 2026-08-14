# 13 — Gap analysis: CURRENT CODE vs TARGET

Companion audit: `docs/audit/BILLING_SYSTEM_REVIEW.md` (2026-08-14). Score there: 4/10 demo checkout.

## Keep

- Razorpay as India rail; Checkout.js; `PaymentOrder` row as an audit seed.
- `manageSettings` for spend.
- Usage poll + quality poll **as signals** (rewrite source to PMP later).
- Content Studio cost-guard idea.
- Connect WhatsApp OAuth using **platform** `META_APP_ID` only (never user-pasted secrets).
- Payment Links module **for org customers**, not SaaS.

## Change

| Current | Target |
| --- | --- |
| Plans starter/growth/business/enterprise ₹0 / 3999 / 11999 | launch/starter/growth/pro/enterprise; user prices |
| One-shot Order +30d | Razorpay Subscriptions + cadences |
| `activatePlan` client planId | Server SKU + amount bind |
| HMAC `===`, empty secret OK | timing-safe; boot fail |
| Verify replay extends | Idempotent |
| `subscriptionStatus` stuck active | Full state machine |
| Seat PATCH 1–500 | Clamp to plan |
| Quality banner → /billing only | + WhatsApp Manager; not a paid upgrade |
| Heuristic ₹0.78/0.35 conversations | Disclaimer + later PMP analytics |
| Signup = eternal starter | 14d Launch trial |
| FEATURE_MATRIX billing DONE | Reopen |

## Build

1. Catalog service (SKU, paise, GST exclusive display, incl-GST Autopay).
2. Entitlement middleware (slots, seats, contacts, workflows, AI).
3. Trial clock + emails.
4. Subscription webhooks + dunning.
5. GST invoices (Rule 46 PDF).
6. GSTIN + place of supply.
7. Unlock Growth modals.
8. Grandfathering job.
9. Campaign estimate disclaimer + GET/POST fix (when implementing).
10. India INR WABA migration reminder.
11. Oct 2026 service-message copy.

## Do not build (v1)

- Stripe.
- Bundled Meta credits (Tech Provider).
- Per-seat overage invoices.
- USD SKUs.
- Selling OBA / green tick.
- Chargebee as system of record.
- AI as the **primary** WhatsApp product.
- User-facing Meta App Secret.

## Payment architecture (repeat)

**Razorpay Subscriptions collect INR SaaS. Samyoj is SoT for entitlements + GST invoices + dunning UX. Meta bills the customer WABA (Tech Provider).** Phase 0 money-safety on the existing Order path until Subscriptions ship.
