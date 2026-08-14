# 00 — Product principles

**CURRENT CODE vs TARGET:** Today Samyoj charges two one-shot licenses and writes `plan` + `planExpiresAt`. Target is a recurring SaaS with enforceable entitlements and a second, independent Meta usage ledger.

## 1. Two ledgers, never one invoice

| Ledger | Who bills | What | Currency | Where it lives |
| --- | --- | --- | --- | --- |
| **A — Samyoj SaaS** | Samyoj via Razorpay | Software: inbox, CRM, seats, contact cap, workflow cap, AI assistant, analytics, support, in-product WhatsApp *connect slots* | INR + GST | Razorpay Subscriptions + Samyoj GST invoice |
| **B — Meta Cloud API** | Meta (Tech Provider) or Samyoj-as-Solution-Partner (later) | Delivered template messages, future service messages (from 2026-10-01), Calling API minutes | INR for India Sold-To (billing localization) | WhatsApp Manager / Meta Billing Hub |

Never present Ledger B as “included in Growth.” Never hide Meta’s rate. See [17](17-META-WHATSAPP-BILLING-AND-POLICY.md) (Price Transparency clause in WhatsApp Business Terms for Service Providers).

## 2. Money safety before conversion

Do not take production INR until:

1. Activation keys off **server-side `PaymentOrder` / Subscription notes**, never client `planId`.
2. Verify and webhook are **idempotent** (replay must not extend paid time).
3. Amount charged equals catalog amount for that SKU (paise match).
4. Webhook HMAC uses a non-empty secret and **timing-safe** compare.
5. Failed payment cannot leave `subscriptionStatus = active` on a paid tier forever.

CURRENT CODE violates 1, 2, 4, 5. That is Phase 0 of [14](14-IMPLEMENTATION-BLUEPRINT.md).

## 3. Sell software, not WhatsApp

Legal and commercial:

- Samyoj may sell an inbox SaaS **as a Tech Provider** (recommended first) or later as a **Solution Partner**. Official partner comparison: [Meta Partners overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview) (updated 2026-05-21).
- Customers own their WABA and WhatsApp Manager access. Embedded Signup must not hide that.
- “1 WhatsApp number” on Starter = Samyoj will **register/connect at most one Cloud API number in our product**. Meta independently caps registered numbers per business portfolio (starts at 2, rises to 20 when verified / 2,000 messaging limit). Product gate ≠ Meta cap.
- Do not use WhatsApp trademarks as if Samyoj *is* WhatsApp. Disclose third-party platform.

## 4. Entitlements are hard; usage meters are honest

- **Hard quotas** (block): WhatsApp connect slots, team seats, contacts, published workflows (Launch/Starter), AI feature flag.
- **Warn then block**: approaching contact cap, seat cap, trial expiry.
- **Do not overage-bill** in v1 (no “₹X per extra seat”). Overage is an upgrade CTA (“Unlock Growth”), not a surprise invoice. Competitors who mix seats + conversation overages + Meta markup are what Indian SMBs complain about on G2.
- **Meta usage** is displayed as estimate + link to WhatsApp Manager. Samyoj heuristics in `usage.service.ts` are **not** invoices.

## 5. India-first payments

- Currency: INR. UPI Autopay is the default renewal rail for amounts **≤ ₹15,000 per debit including GST** (RBI e-mandate AFA-free cap for generic SaaS MCC).
- Yearly Growth (₹24,000) and yearly Pro (₹48,000) **exceed** that cap even before GST. Those SKUs must offer **card / e-NACH**, or the pricing page must steer UPI users to quarterly.
- PCI: Razorpay Checkout.js / hosted checkout → merchant SAQ A. Never store PAN. RBI CoF tokenization: raw cards stay with Razorpay.

## 6. What NOT to do

1. Do not keep `activatePlan(+30d)` as the paid model while the UI says “billed monthly · cancel anytime.”
2. Do not let `PATCH /api/team/settings` raise `seatLimit` to 500 against a 3-seat Starter.
3. Do not mix commerce `Order` (catalog checkout for the org’s *customers*) with SaaS `PaymentOrder`.
4. Do not use Payment Links as Samyoj subscription collection.
5. Do not mark FEATURE_MATRIX billing rows DONE until entitlements, invoices, and recurring exist.
6. Do not put META_APP_ID / App Secret on the Billing or Connect UI (platform credentials stay in `server/.env`).
7. Do not train foundation models on customer WhatsApp threads (WhatsApp Business Solution Terms, AI Providers clause, last modified 2026-03-06).
8. Do not block a Client from their WABA (Service Provider Terms — portability, 30 days).
9. Do not charge GST on Meta’s invoice through Samyoj unless we are the Bill-To party (Solution Partner). Under Tech Provider, Meta invoices the customer.
10. Do not invent USD/EUR SKUs in v1.

## 7. Conversion psychology (constrained by honesty)

- **Growth is Most Popular** because it is the first tier with AI included, unlimited workflows, 2 numbers, 10 seats — the jump from “inbox for a shop” to “team that broadcasts and automates.” Anchor the middle card. Do not dark-pattern Starter.
- **Trial without AI** is deliberate: Launch proves inbox + 1 workflow. AI is the paid unlock, not a free teaser that trains abuse.
- **Quarterly (~5% off)** is the India SMB default (Interakt, Gallabox bill quarterly). Lower commitment than yearly, still prepaid.
- **Yearly (~20% off)** is cash and retention. Show effective monthly (“₹2,000/mo billed ₹24,000 yearly”), never hide the prepaid total.
- **Unlock Growth** is the only upsell slogan for quota walls (2nd number, 4th seat, 6th workflow, AI). Not “Unlock WhatsApp.”

## 8. Fair use

Samyoj v1 is **feature + resource cap**, not conversation-priced SaaS (unlike Tidio / Trengo / Respond.io MACs). Fair use still applies:

- Campaigns remain subject to Meta quality, template pacing, and messaging limits (portfolio-level unique users / 24h outside CSW).
- Content Studio daily generation budgets stay as cost-guard (CURRENT CODE already does this by `org.plan` with old plan names — must remap).
- Abuse of trials (serial orgs, same GSTIN / PAN / phone) → one Launch trial per org, fingerprint later.

## 9. Roles that can spend money

CURRENT CODE: `manageSettings` (OWNER/ADMIN) for checkout. TARGET: same. Agents never see checkout. Billing page in nav stays ADMIN_ROLES; route must match.

## 10. Honesty in UI copy

Forbidden: “Unlimited WhatsApp included,” “Free messages,” “We pay Meta for you” (unless Enterprise contract + Solution Partner pass-through is signed).

Required near every paid CTA: “Samyoj subscription is separate from Meta WhatsApp conversation/message charges. Add a payment method in WhatsApp Manager to send templates.”
