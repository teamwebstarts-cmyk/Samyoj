# 08 — Usage meters and Meta costs

Two ledgers. See [17](17-META-WHATSAPP-BILLING-AND-POLICY.md) for official Meta rules. This chapter is the **product** mapping.

## 1. Ledger A — Samyoj SaaS

Seats, contacts, WA slots, workflows, AI tokens, Content Studio daily caps. Billed via Razorpay. **Not** Meta.

## 2. Ledger B — Meta Cloud API

**CURRENT CODE** (`server/src/modules/billing/usage.service.ts`):

```
USD_TO_INR = 83
MARKETING 0.78 | UTILITY 0.35 | AUTHENTICATION 0.35 | SERVICE 0
```

Worker `pollConversationAnalytics` every 24h uses Graph **conversation** analytics, upserts `ConversationCharge` with `country: 'IN'`. Campaign `POST /estimate` multiplies recipients × those INR rates.

**That is not Meta’s invoice.**

Live Meta (from 1 Jul 2025): **per delivered template**, category × **recipient calling code**, INR CSV for India WABAs, volume tiers on utility/auth, service free **until 1 Oct 2026**. Polling CBP analytics is stale. FX 83 is stale.

### Product rules

- Label every Samyoj usage chart: **“Estimate — not your Meta bill. Open WhatsApp Manager.”**
- Never add estimated INR into Razorpay.
- Campaign preview: same disclaimer. Prefer webhook `pricing` on statuses (`pricing_model: PMP`, `billable`, `category`) when we implement (docs only here).
- India: eligible Sold-To must migrate WABA to **INR by 2026-12-31**.

## 3. Quality

`pollQualityRatings` → `WhatsappNumber.qualityRating`. Banner YELLOW/RED. **Do not** treat as a Samyoj billing event. CTA: WhatsApp Manager + template hygiene. Paying Pro does not restore GREEN. Details: [17 §2.5](17-META-WHATSAPP-BILLING-AND-POLICY.md).

## 4. Campaigns

Selling broadcasts = marketing templates = **Meta PMP marketing** per **delivered** message + opt-in + quality risk. Growth “unlimited automation” ≠ unlimited free marketing.

Daily budget in settings (CURRENT: 5000 msgs / ₹5000) is a **cost guard**, not Meta. Remap Launch to a **low** cap (e.g. 50/day) so trials cannot tank quality.

## 5. Calling

Meta: user-initiated free; business-initiated 6-second pulses; permission request = PMP. Samyoj Calling flag is a **module**, not minutes included.

## 6. AI tokens

`AiUsageLog` + `settings.ai.monthlyTokenLimit` (0 = unlimited today). TARGET: Growth/Pro defaults; Launch/Starter 403. Do not train foundation models on threads ([17](17-META-WHATSAPP-BILLING-AND-POLICY.md) AI Providers).

## 7. Content Studio

`GenerationCreditLedger` — the only honest meter in CURRENT CODE. Remap plan names when catalog changes.
