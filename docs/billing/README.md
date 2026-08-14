# Samyoj billing & subscription — documentation pack

**Status:** Target product specification. Not implemented.  
**Date:** 2026-08-14  
**Scope:** Documentation only. No product code was changed.  
**Audience:** Billing PM, payments engineer, founder, counsel (GST / Meta partner).

This pack is the **source of truth for the commercial product Samyoj intends to sell**. It is not a description of the live codebase.

| Layer | What is true |
| --- | --- |
| **TARGET PRODUCT** | Launch 14-day trial → Starter / Growth / Pro / Enterprise. Monthly, quarterly, yearly. User-supplied INR prices. Feature + quota packaging. Recurring collection. GST invoices. Dunning. |
| **CURRENT CODE** | Hard-coded Starter (free) / Growth ₹3,999 / Business ₹11,999 / Enterprise. One-shot Razorpay Order. `activatePlan` = now + 30 calendar days. Almost no entitlements. See [13-GAP-ANALYSIS](13-GAP-ANALYSIS-CURRENT-VS-TARGET.md) and `docs/audit/BILLING_SYSTEM_REVIEW.md`. |
| **META LAYER** | Always separate. Customer (or a Solution Partner) pays Meta for Cloud API usage. Samyoj SaaS never pretends to include WhatsApp message fees. See [17-META-WHATSAPP-BILLING-AND-POLICY](17-META-WHATSAPP-BILLING-AND-POLICY.md). |

If a sentence in this pack contradicts `server/src/modules/billing/plans.ts`, **this pack wins for product intent**. Code is the implementation debt.

---

## How to read

1. **[00-PRINCIPLES.md](00-PRINCIPLES.md)** — money safety, two-ledger rule, what not to do.
2. **[01-PRICING-CATALOG.md](01-PRICING-CATALOG.md)** — exact SKUs, paise, discounts, GST exclusive, Unlock Growth.
3. **[02-ENTITLEMENTS-AND-QUOTAS.md](02-ENTITLEMENTS-AND-QUOTAS.md)** — every limit as an enforceable rule mapped to modules.
4. **[03-TRIAL-AND-CONVERSION.md](03-TRIAL-AND-CONVERSION.md)** — 14-day Launch trial.
5. **[04-SUBSCRIPTION-LIFECYCLE.md](04-SUBSCRIPTION-LIFECYCLE.md)** — create / renew / upgrade / cancel / grandfather. Proration formulas.
6. **[05-PAYMENTS-RAZORPAY.md](05-PAYMENTS-RAZORPAY.md)** — Orders vs Subscriptions vs UPI Autopay. **Recommended architecture.**
7. **[06-INVOICING-TAX-COMPLIANCE.md](06-INVOICING-TAX-COMPLIANCE.md)** — GST, SAC, place of supply, credit notes.
8. **[07-DUNNING-AND-FAILURES.md](07-DUNNING-AND-FAILURES.md)** — retries, grace, lock vs soft-lock.
9. **[08-USAGE-AND-META-COSTS.md](08-USAGE-AND-META-COSTS.md)** — ConversationCharge vs SaaS; campaign heuristics vs Meta rate cards.
10. **[09-SCREENS-AND-WORKFLOWS.md](09-SCREENS-AND-WORKFLOWS.md)** — every UI surface and journey.
11. **[10-GATING-MATRIX.md](10-GATING-MATRIX.md)** — plan × feature, current vs target.
12. **[11-EDGE-CASES-AND-FAILURE-MODES.md](11-EDGE-CASES-AND-FAILURE-MODES.md)** — 40+ failure modes.
13. **[12-COMPETITOR-RESEARCH.md](12-COMPETITOR-RESEARCH.md)** — India + global packaging.
14. **[13-GAP-ANALYSIS-CURRENT-VS-TARGET.md](13-GAP-ANALYSIS-CURRENT-VS-TARGET.md)** — keep / change / build / do-not-build.
15. **[14-IMPLEMENTATION-BLUEPRINT.md](14-IMPLEMENTATION-BLUEPRINT.md)** — phased rollout, acceptance criteria, no code.
16. **[15-SOURCES.md](15-SOURCES.md)** — 40+ numbered URLs, accessed 2026-08-14.
17. **[16-SELF-QA.md](16-SELF-QA.md)** — hard questions and researched answers.
18. **[17-META-WHATSAPP-BILLING-AND-POLICY.md](17-META-WHATSAPP-BILLING-AND-POLICY.md)** — official Meta commercial model + partner policy for a SaaS like Samyoj.

Companion audit (current code, not target): `docs/audit/BILLING_SYSTEM_REVIEW.md`.

---

## Non-goals of this pack

- Implementing checkout, Prisma migrations, or UI.
- AI-call / audio product design.
- Stripe as a primary India rail (documented only as a concept source).
- Bundling Meta conversation/message fees into Samyoj list prices.
- Treating the old ₹3,999 Growth / ₹11,999 Business 30-day license as the product.

---

## One-line architecture (see 05 + 13 for debate)

**Razorpay Subscriptions** collect INR SaaS fees (UPI Autopay / cards / e-mandate). **Samyoj** is the source of truth for entitlements, GST tax invoices, and dunning UX. **Meta** bills the customer’s WhatsApp Business Account (Tech Provider model) or, later, a Solution Partner credit line. Two invoices, two ledgers, never mixed.

---

## Document conventions

- **CURRENT CODE** — verified against the repo on 2026-08-14.
- **TARGET** — user-supplied pricing and this pack.
- Amounts are **INR exclusive of GST** unless labelled “incl. GST”.
- SKU IDs are `plan_cadence` (example: `growth_yearly`). Plan IDs without cadence (`growth`) are entitlement tiers.
- “WhatsApp number” in a Samyoj plan = **in-product connect slot**, not Meta’s registered-number cap and not a Meta phone-number hosting fee.
