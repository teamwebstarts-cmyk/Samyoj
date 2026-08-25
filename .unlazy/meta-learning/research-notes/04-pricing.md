# L4 — Meta WhatsApp pricing (2025–2026) vs Samyoj SaaS

**Leaf:** L4 · **File:** `04-pricing.md`  
**Fetched / verified:** 2026-08-25  
**Rule:** Two ledgers. Do **not** invent exact ₹/msg rates — always open Meta’s live rate card. Samyoj SaaS price ≠ Meta Cloud API price.

---

## 0. Paisa Meta ka vs Samyoj ka (Hinglish TL;DR)

| Ledger | Kaun bill karta hai? | Kya charge hota hai? | Customer kahan dekhe? |
| --- | --- | --- | --- |
| **B — Meta** | Meta (WABA Billing Hub) | Delivered WhatsApp messages (templates abhi; service Oct 2026 se) | WhatsApp Manager / Meta invoice |
| **A — Samyoj** | Samyoj via Razorpay | Software: Inbox, CRM, seats, AI, campaigns UI, connect slots | Samyoj GST invoice |

**Seedha rule:** Growth plan le liya ≠ Meta ke marketing templates free. Do alag bills, do alag merchants. Meta ke paisa ko Samyoj ke plan mein mat fold karo.

> Samyoj: “hum software bechte hain.”  
> Meta: “hum WhatsApp delivery meter karte hain.”

---

## 1. Timeline — conversation → per-message (official)

| When | What | Official source |
| --- | --- | --- |
| Until **30 Jun 2025** | **Conversation-based pricing (CBP)** — one charge per 24h conversation category | [Conversation-based pricing (Deprecated)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing) |
| **1 Jul 2025** | **Per-message pricing (PMP)** — charge when a **template** is **delivered** | [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) (also [docs/whatsapp/pricing](https://developers.facebook.com/docs/whatsapp/pricing/)) |
| **1 Nov 2024** | Non-template (service) messages **free** inside CSW | Same Pricing page |
| **1 Jul 2025** | Utility templates **inside open CSW free**; volume tiers for utility & auth | Same Pricing page |
| **1 Jan 2026** | India **billing localization (INR)** for eligible Sold-To India | Same Pricing page § Billing localization |
| **1 Aug 2026** | **Meta Business Agent** → per-token billing (Meta’s own agent, not Samyoj AI) | [Upcoming pricing updates…](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages) (updated **2026-08-24**) |
| **1 Oct 2026** (**upcoming, still accurate as of 2026-08-25**) | **Service messages billed** per delivery; **utility templates inside CSW also billed**; **no volume tiers for service**; Oct rates to be published by **1 Sep 2026** | Same upcoming-updates page |
| **31 Dec 2026** | Eligible India customers: migrate **all WABAs to INR** | Pricing page |
| **1 Jan 2027** | Meta **stops delivering** messages from non-INR WABAs of eligible India customers | Pricing page |

**Deprecated page still exists for history:** [Conversation-based pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing) — banner: replaced by PMP on July 1, 2025.

---

## 2. Ledger B — What Meta charges (Cloud API)

Official overview (page updated **2026-08-05**):  
https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing

### 2.1 Meter (today, before Oct 2026)

Quoted rules from Meta:

- Effective **July 1, 2025**, Meta charges on a **per-message** basis for messages businesses deliver.
- You are only charged when a **template** message is **delivered** (`"type":"template"`).
- Rates = **template category** × **recipient country calling code**.

| Message | Charged today? | Notes |
| --- | --- | --- |
| User → business (inbound) | **Never** | “Messages sent from a WhatsApp user to a business are not charged.” |
| Non-template outbound (`text`, `image`, …) | **No** (until Oct 1, 2026) | Only allowed inside open **24h CSW** |
| Utility template **inside** open CSW | **No** (until Oct 1, 2026) | Free since Jul 1, 2025 |
| Utility template **outside** CSW | **Yes** | Volume tiers may apply |
| Authentication template | **Yes** | Volume tiers; watch **authentication-international** |
| Marketing template | **Yes** | Always (except FEP); **no** volume discount |
| Anything inside open **72h FEP** | **Free** (delivery) | See §4 |

Webhook shape for billable PMP:

```json
"pricing": {
  "billable": true,
  "pricing_model": "PMP",
  "type": "regular",
  "category": "marketing"
}
```

Free in-CSW service / utility today uses `type: "free_customer_service"`.

### 2.2 Categories (templates vs service)

Templates (can be sent **outside** CSW): **marketing**, **utility**, **authentication**.

**Service** is **not** a template category — it is non-template replies inside CSW (`category: service`). Free since Nov 2024; **billable from 1 Oct 2026** at the same market rates as utility/authentication, **without** volume tiers.

Source: [non-template / upcoming updates](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages).

### 2.3 Oct 2026 — service messages paid (still accurate)

As of fetch **2026-08-25**, Meta’s upcoming page (updated **2026-08-24**) still states:

- **Effective October 1, 2026** — charge per delivered **service** message (same as templates meter).
- **Effective October 1, 2026** — charge utility templates sent **inside** open CSW (no longer free).
- Service rates = utility/auth rates for that market; **no volume tiers for service**.
- Meta will publish Oct 1 rates (including service) by **September 1, 2026**.
- Payment method must be on file by **September 30, 2026** or Meta may **stop delivering** service messages when charging starts.

**Samyoj product implication:** do not promise “unlimited free WhatsApp replies” on any SaaS plan. Inbox replies are Meta Ledger B after Oct 2026.

### 2.4 Volume tiers

Official Pricing page § Volume tiers:

- Apply to **utility and authentication only** (not marketing, not service).
- Aggregated at **business portfolio** across **all WABAs**.
- Only **charged** messages count (free in-CSW utility / FEP utility do not count toward tiers).
- Reset monthly at 12:00 WABA timezone.
- Webhook: `account_update` / `VOLUME_BASED_PRICING_TIER_UPDATE` (from Oct 1, 2025).

### 2.5 Rate cards — **do not invent INR**

Meta does **not** want static blog numbers in product copy. Live rates:

1. **Interactive rate card (pick INR + India):**  
   https://business.whatsapp.com/products/platform-pricing  
   (linked from Pricing docs as “WhatsApp Business website”)
2. **Developer Pricing page → Rate cards and volume tiers** (CSV / PDF by currency, including **INR**):  
   https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing  
   CDN CSV URLs rotate — always download from the live page, do not hardcode paths.
3. **Alternate canonical path:**  
   https://developers.facebook.com/docs/whatsapp/pricing/
4. **Updates / notices mirror:**  
   https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/
5. **Authentication-international:**  
   https://developers.facebook.com/docs/whatsapp/pricing/authentication-international-rates/
6. **Calling API pricing (separate meter):**  
   https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/

Third-party blogs often quote India list rates (e.g. marketing ~₹0.86, utility/auth ~₹0.115). Treat those as **unofficial snapshots**. For budgets: open Meta INR CSV / interactive tool, or WhatsApp Manager / `pricing_analytics`.

India rate-card events Meta documented (without pasting ₹ amounts here):

- **1 Jan 2026** — India marketing rate **increased**.
- **1 Apr 2026** — India **authentication-international** rate **increased**.

### 2.6 India INR WABA notes (documented)

From Pricing page § Billing localization for Brazil and India:

- Localization **launched 1 Jan 2026** for Solution Providers / directly-integrated businesses whose **Sold-To country is India** in Billing Hub.
- Eligible customers must migrate **all WABAs in the portfolio to INR by 31 Dec 2026**.
- As of **1 Jan 2027**, Meta will **no longer deliver** messages of **non-INR** WABAs of eligible customers.
- **WABA Currency Migration APIs** available as of **1 Jun 2026**.

Help / Billing Hub entry (linked from Pricing “Billing”): Meta Business Suite → About billing for your WhatsApp Business Account.

**Sold-To country** = billing attribute on the account — not “where your customers live.”

---

## 3. Free entry points (FEP) + CSW

Official: Pricing page § Free entry point windows; CSW: [Send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages).

### 3.1 Customer service window (24h)

- Opens when user **messages or calls** the business; resets on each user message/call.
- Open → any message type (templates + non-templates).
- Closed → **templates only**.

### 3.2 Free entry point (72h)

Trigger (Android/iOS app — **not** desktop/web):

1. User messages via **Click to WhatsApp Ad** or **Facebook Page CTA**.
2. Business replies within **24 hours** with any message type → that reply is free **and** a **72-hour FEP** opens from the reply time.

While FEP open: **all** marketing / utility / authentication / service messages are **free for message delivery**.  
CSW is **independent** of FEP — if CSW closes, you can still send **templates** free inside FEP, but not free-form non-templates.

**Oct 2026 note:** FEP free delivery for marketing/utility/auth/service remains; **Meta Business Agent** still incurs **token** charges even inside FEP (per upcoming-updates page).

---

## 4. Ledger A — What Samyoj SaaS can charge

Internal TARGET catalog (spec, not “Meta fees”): `docs/billing/01-PRICING-CATALOG.md`, principles: `docs/billing/00-PRINCIPLES.md`.

| Samyoj may sell | Samyoj must **not** sell / fold |
| --- | --- |
| Seats, contact caps, workflow caps | Meta per-message delivery as “included unlimited” |
| WhatsApp **connect slots** (product gate: how many numbers in Samyoj) | Green tick / Official Business Account |
| Inbox, campaigns UI, template builder, AI bots (Samyoj AI) | Meta Business Agent tokens as Samyoj SKU without disclosure |
| Analytics, reports, Content Studio credits | Passing Meta INR off as Samyoj SaaS GST without being Bill-To |
| AI top-ups / plan period (current code path) | Hiding that customer still pays Meta for Cloud API |

**Partner posture (Tech Provider default):** customer attaches payment method on **their** WABA; Meta bills the customer. Samyoj Razorpay invoice is a **different** merchant. Price transparency: [WhatsApp Business Terms for Service Providers](https://www.whatsapp.com/legal/business-terms-for-service-providers/).

Partner overview:  
https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview

---

## 5. Two ledgers — never one invoice

```
┌─────────────────────────┐     ┌─────────────────────────────┐
│  A — Samyoj SaaS        │     │  B — Meta Cloud API         │
│  Razorpay + GST         │     │  Meta Billing Hub / WABA    │
│  Software entitlements  │     │  Delivered msgs (PMP)       │
│  Connect slots, AI, …   │     │  Calling pulses (separate)  │
└─────────────────────────┘     └─────────────────────────────┘
         ≠ never merge into one “WhatsApp plan price”
```

**CURRENT CODE gap (honest):** `usage.service.ts` heuristics (`MARKETING 0.78`, `UTILITY/AUTH 0.35`, `SERVICE 0`, `USD_TO_INR = 83`) + conversation analytics poll are **not** Meta’s live invoice. Label any Samyoj chart: “Estimate — not your Meta bill.” Details: `docs/billing/08-USAGE-AND-META-COSTS.md`, `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`.

---

## 6. Charge example (Meta’s own table, today)

From Pricing page — 4 messages sent, **2** billed (pre–Oct 2026 rules):

| Hour | Action | Charge |
| --- | --- | --- |
| 0 | Marketing template | Marketing |
| 2 | User replies → CSW opens | — (inbound free) |
| 3 | Business `type:text` | Free (non-template in CSW) |
| 4 | Utility template (CSW open) | Free (until Oct 2026) |
| 26 | CSW closes | — |
| 30 | Utility template outside CSW | Utility |

After **1 Oct 2026**, hours 3 and 4 become billable (service + in-CSW utility) unless inside FEP.

---

## 7. Official URL checklist (cite these)

| Topic | URL |
| --- | --- |
| Current PMP pricing | https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing |
| Same (docs path) | https://developers.facebook.com/docs/whatsapp/pricing/ |
| Pricing updates / calendar notes | https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/ |
| Deprecated CBP | https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing |
| Service / utility Oct 2026 + Meta Business Agent | https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages |
| Interactive rate card (INR) | https://business.whatsapp.com/products/platform-pricing |
| Auth-international | https://developers.facebook.com/docs/whatsapp/pricing/authentication-international-rates/ |
| CSW / send rules | https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages |
| Calling pricing | https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/ |
| Partners (TP vs SP) | https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview |
| Service Provider terms (price transparency) | https://www.whatsapp.com/legal/business-terms-for-service-providers/ |

---

## 8. Quiz (self-check)

**Q1.** Samyoj Growth ₹2,499/mo (TARGET) include Meta marketing template delivery?  
→ **No.** Ledger A only. Marketing delivery = Ledger B on the customer WABA.

**Q2.** Since when is Meta’s model per-message, not per-conversation?  
→ **1 July 2025.** CBP is deprecated.

**Q3.** Today (Aug 2026), is an Inbox free-text reply inside CSW charged by Meta?  
→ **No** (service free since Nov 2024). **From 1 Oct 2026 → yes**, per message, utility/auth market rate, no volume tier.

**Q4.** Are utility templates inside CSW free forever?  
→ **No.** Free since Jul 2025; **charged from 1 Oct 2026**.

**Q5.** What opens a 72h free entry point?  
→ Click-to-WA ad or FB Page CTA (mobile app) + business reply within 24h.

**Q6.** Where do you get official India ₹ rates?  
→ [business.whatsapp.com/products/platform-pricing](https://business.whatsapp.com/products/platform-pricing) (INR) or INR CSV from the Pricing docs page — **not** memory, not Samyoj `usage.service.ts`.

**Q7.** India Sold-To WABA still on USD after 31 Dec 2026?  
→ Eligible customers risk **stop delivery** of non-INR WABAs from **1 Jan 2027**.

**Q8.** Volume discount on marketing templates?  
→ **No.** Only utility & authentication.

**Q9.** Who invoices Meta Cloud API under Tech Provider?  
→ **Meta** (customer payment method on WABA). Samyoj invoices SaaS separately via Razorpay.

**Q10.** Hinglish one-liner?  
→ **“Software ka paisa Samyoj ka; WhatsApp delivery ka paisa Meta ka — mix mat karo.”**

---

## 9. Pointers into Samyoj docs (do not re-research from scratch)

- `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` — full commercial + partner policy pack  
- `docs/billing/08-USAGE-AND-META-COSTS.md` — product mapping of two ledgers  
- `docs/billing/00-PRINCIPLES.md` — never one invoice  
- `docs/billing/15-SOURCES.md` — URL inventory  
- `.cursor/rules/billing-research.mdc` — TARGET vs CURRENT CODE reminder  

**Out of scope for this leaf:** implementing Razorpay Subscriptions / SAMYOJ-35 TARGET billing code.
