# 05 — Payments (Razorpay)

## 1. Recommendation (one architecture)

**Razorpay Subscriptions as the recurring collection rail** (Plans + Subscriptions + Checkout + UPI Autopay + cards). **Samyoj owns entitlements, GST tax invoices, and dunning UX.**

- Do **not** keep Orders + cron as the production subscription model (no mandate; UI already pretends monthly).
- Do **not** start on Chargebee/Stripe as the first platform (India INR + UPI + GST). Chargebee is a **dunning UX reference** only ([15](15-SOURCES.md)).
- Razorpay **Invoices API cannot** emit GST-compliant invoices (no SAC/HSN/tax via API). Samyoj (or a GST product) issues Rule 46 invoices; Razorpay is the **collection** receipt.
- **Phase 0 still required** even during migration: bind money to server `PaymentOrder.planId` + amount; idempotent verify/webhook; timing-safe HMAC. CURRENT CODE fails these.

PCI: hosted Checkout.js → SAQ A. Never store PAN. RBI CoF: tokens stay with Razorpay.

Meta is a **second** merchant ([17](17-META-WHATSAPP-BILLING-AND-POLICY.md)). Do not add Meta PMP into the Razorpay Subscription amount.

## 2. CURRENT CODE (Orders only)

- `POST /create-order` → Razorpay Order INR paise for `growth|business`.
- Checkout.js → `POST /verify` uses **client `planId`** (bug: pay Growth, post `business` → Business).
- Webhook `payment.captured` keys **payment notes**; Checkout does not set payment notes → webhook may never activate.
- HMAC `===` (not timing-safe). Empty webhook secret → verify false.
- Verify replay extends another 30 days.
- No `subscription.*` webhooks.

## 3. TARGET: Razorpay objects

| Object | Use |
| --- | --- |
| **Plan** | One per SKU (`starter_monthly` …). Amount = catalog paise **ex-GST** or **incl-GST**? **Recommendation: charge incl. GST** on Razorpay (so UPI cap math matches debit) and split tax on our invoice. Alternative: Razorpay ex-GST + tax line if/when supported — as of research, Subscriptions are a single amount. Prefer **one amount = GST-inclusive** for Autopay predictability, invoice shows taxable value + 18%. |
| **Subscription** | `customer_id`, `plan_id`, `total_count` null (until cancelled), `addons` for upgrade net. |
| **Mandate** | UPI Autopay / card / eNACH. |
| **Order** | Still used for **one-shot** (Enterprise setup fee, upgrade net if not add-on). Not for monthly license. |

### UPI Autopay ₹15,000 AFA-free cap (SaaS MCC)

If SKU **incl. GST > ₹15,000**, do not offer UPI Autopay: Growth yearly ₹28,320; Pro quarterly ₹16,815; Pro yearly ₹56,640. Steer to **quarterly** or **card/eNACH**. See [01](01-PRICING-CATALOG.md).

## 4. Webhooks to handle

`subscription.authenticated`, `activated`, `charged`, `pending`, `halted`, `cancelled`, `paused`, `resumed`, `completed`, `updated`, plus `payment.captured`, `payment.failed`, `order.paid`.

Razorpay **card** retries typically T+1 / T+2 / T+3 then `halted`. Align [07](07-DUNNING-AND-FAILURES.md).

Idempotency: `event.id` unique table. Replay must not extend period twice.

Signature: `crypto.timingSafeEqual` on HMAC-SHA256; **refuse to boot billing webhook if secret empty**.

## 5. Bind payment to plan

Never trust client `planId`. Notes / Subscription notes / our `BillingCheckoutSession` row store `organizationId`, `skuId`, `amountPaise`, `gstin`. Verify: `amount === sku.amount` (or incl-GST amount we stored).

## 6. Alternatives considered

| | Why not first |
| --- | --- |
| Stripe Billing | UPI/INR/GST weak vs Razorpay; PCI/RBI complexity. |
| Chargebee | Extra 1–2% + still needs Razorpay gateway; use later if dunning/catalog pain. |
| Cashfree / PayU subscriptions | Viable; we already have Razorpay keys in CURRENT CODE. |
| Payment Links | Exist for **org’s customers** (commerce). Not Samyoj SaaS. |

## 7. Test vs live

Razorpay test cards do not prove UPI Autopay. Stage with Razorpay test + one live ₹1 auth if needed. Never log tokens.
