# 12 — Marketing API / Ads Manager adjacency (what NOT to mix)

**Leaf:** L12  
**Accessed:** 2026-08-25 (WebSearch + official Meta docs)  
**Audience:** Sonu — Meta literacy; Samyoj billing honesty  
**Not in scope:** Building Ads Manager inside Samyoj, spending customer ad budget, implementing Marketing API as product.

**Rule:** Cite developers.facebook.com / facebook.com/business. Do not invent CPM/CTR or fold ad spend into SaaS SKUs.

Companion in repo: `docs/billing/00-PRINCIPLES.md` (two ledgers), `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` (§1.1 FEP).

---

## 0. Hinglish TL;DR (pehli baat)

Teen alag Meta “bills” hain — **kabhi ek SaaS plan price mein mat milao**:

| # | Kya | Kaun charge karta hai | Samyoj plan mein? |
|---|-----|------------------------|-------------------|
| 1 | **Ad spend** (CPM/CPC — Ads Manager / Marketing API campaigns) | Meta Ads billing on the **ad account** | **NO** |
| 2 | **Cloud API / MM API message fees** (templates delivered, future service msgs) | Meta WhatsApp Billing Hub on the **WABA** | **NO** |
| 3 | **Samyoj SaaS** (inbox, seats, bots, campaigns UI) | Samyoj via Razorpay | **YES — only this** |

**Click-to-WhatsApp (CTWA)** ads = #1 pe paisa. User click → WhatsApp chat open. Agar business **24h ke andar** reply kare (Android/iOS app click), to Meta **72h Free Entry Point (FEP)** kholta hai — us window mein Cloud API messages (templates bhi) **₹0 Meta message fee**. Ad spend **phir bhi** alag.

**Lead Ads (Instant Forms)** ≠ WhatsApp Cloud API. Form FB/IG pe submit → CRM webhook/`leadgen_id`. Conversation auto-start nahi. WhatsApp pe follow-up alag se Cloud API / CTWA se.

---

## 1. Map: three products that share “Meta” brand

```text
┌─────────────────────┐     click / CTA      ┌──────────────────────────┐
│  Marketing API /    │ ───────────────────► │  WhatsApp conversation   │
│  Ads Manager        │   CTWA / Page CTA    │  (Cloud API / Inbox)     │
│  = ad creation +    │                      │  = messages + webhooks   │
│    ad spend         │                      └──────────────────────────┘
└─────────────────────┘
          │
          │ Instant Form submit
          ▼
┌─────────────────────┐
│  Lead Ads           │ ──► Graph leadgen / CRM (no chat required)
│  (forms on FB/IG)   │
└─────────────────────┘

Separate (not Ads Manager):
┌─────────────────────┐
│  Marketing Messages │ ──► /marketing_messages  (optimized marketing
│  API for WhatsApp   │     *templates* on same phone as Cloud API)
│  (MM API)           │     Still WABA message billing — NOT ad spend
└─────────────────────┘
```

| Product | Job | Official entry |
| --- | --- | --- |
| **Marketing API** | Programmatic campaigns, ad sets, creatives, insights | [Marketing API overview](https://developers.facebook.com/docs/marketing-apis/overview/) |
| **Ads Manager** | Same ads UI for humans | [Create ads that click to WhatsApp](https://www.facebook.com/business/help/447934475640650) |
| **Cloud API** | Send/receive WhatsApp messages & calls | [About the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform) |
| **MM API for WhatsApp** | Optimized **marketing template** send (`/marketing_messages`) | [Marketing Messages API for WhatsApp](https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/) |
| **Lead Ads** | Instant Forms → lead records | [Lead Ads guide](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/) |

**Naming trap:** “Marketing Messages API” sounds like “Marketing API.”  
- **Marketing API** = ads (spend).  
- **MM API for WhatsApp** = WhatsApp **template delivery** product next to Cloud API (same WABA billing family, not CPM).

---

## 2. What Samyoj must NOT mix into SaaS plan price

From product principles (`docs/billing/00-PRINCIPLES.md`) + Meta commercial model:

### 2.1 Never fold these into Growth/Pro “included”

1. **Meta ad spend** — customer’s Ads Manager budget. Samyoj does not pay Meta CPM for the customer.
2. **Cloud API / MM API per-message fees** — charged when templates deliver (and, from **1 Oct 2026**, service messages). See [Pricing](https://developers.facebook.com/docs/whatsapp/pricing/).
3. **“Unlimited free WhatsApp from ads” as a Samyoj entitlement** — FEP is Meta’s rule, time-boxed, device-limited; not a Samyoj SKU.
4. **Lead Ads form storage / CRM sync fees** — Lead Ads are Marketing API + Page permissions; not WhatsApp conversation meters.
5. **MM API “quality boost”** — still Meta message billing; not a reason to raise Samyoj list price as if ads were included.

### 2.2 Honest UI copy (do / don’t)

| Don’t say | Say instead |
| --- | --- |
| “Growth includes free WhatsApp ads” | “Run Click-to-WhatsApp in Ads Manager; Samyoj Inbox handles the chat. Ad budget is billed by Meta.” |
| “Plan covers all Meta charges” | “Samyoj = software. Meta bills your WABA for messages and your ad account for ads — two separate invoices.” |
| “CTWA = free messaging forever” | “Reply within 24h of a CTWA/Page CTA click (mobile app) to open a **72h** free message window (FEP). After that, normal Cloud API rates.” |

### 2.3 Three-invoice mental model (teach customers)

1. **Razorpay → Samyoj** — seats, inbox, automations.  
2. **Meta Billing Hub → WABA** — message delivery.  
3. **Meta Ads billing → ad account** — impressions/clicks.

Samyoj Tech Provider path: customer owns WABA + ideally sees WhatsApp Manager. Do not hide #2 or #3 inside #1.

---

## 3. Click-to-WhatsApp (CTWA) — when it matters for Samyoj

### 3.1 What it is

Ads that send people who click **directly into a WhatsApp chat** with the business number.

- Human UI: [Create ads that click to WhatsApp in Ads Manager](https://www.facebook.com/business/help/447934475640650)  
- API: [Ads that Click to WhatsApp](https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp/)  
- Related: [Messaging ads](https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/), [Click to Multidestination](https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-multidestination/)

**API prerequisites (official):** ad account; Facebook Page with WhatsApp number linked; Page access token with ADVERTISE; permissions `ads_management`, `pages_manage_ads`, `pages_read_engagement`, `pages_show_list`.

**Campaign objectives (API):** `OUTCOME_ENGAGEMENT`, `OUTCOME_LEADS`, `OUTCOME_SALES`, `OUTCOME_TRAFFIC` (call-prompt campaigns → `OUTCOME_ENGAGEMENT`).

### 3.2 Why Samyoj cares (product adjacency, not ads product)

CTWA is the **bridge** from paid discovery → Samyoj Inbox / bots:

| Without Samyoj | With Samyoj (today’s product) |
| --- | --- |
| Chat opens on phone / Meta Suite Inbox | Same Cloud API number → Samyoj Inbox + automations + AI chat bot |
| Miss 24h reply → no FEP; later templates cost Meta money | Fast reply / auto-welcome unlocks FEP economics for the **customer’s** Meta bill |

**Samyoj value = conversation ops**, not campaign creation. Building full Marketing API inside Samyoj is a **future** product decision (App Review: `ads_management` / `ads_read`, Marketing API Access Tier) — not required for CTWA to work today if customer creates ads in Ads Manager and points them at the connected number.

### 3.3 Free Entry Point (FEP) — official pricing rule

Source: [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing/) — section **Free entry point windows**:

> If a WhatsApp user messages you via a **Click to WhatsApp Ad** or **Facebook Page Call-to-Action** button using a device running our **Android or iOS app** (desktop and web apps are **not** supported):
>
> - A 24-hour **customer service window (CSW)** opens (as normal).  
> - If you **respond within 24 hours** with any message type, that reply is free, and a **Free Entry Point (FEP)** window opens from the time you responded.  
> - FEP lasts **72 hours**. While open, **any message type including templates** is at **no charge**.  
> - **CSW is independent of FEP** — if CSW closes, you may only send **templates** (still free while FEP open).

**Product implications:**

- **Speed-to-first-reply** after CTWA is a Meta-cost lever → Inbox alerts, auto-reply, bot welcome matter.  
- Desktop/web CTWA clicks **do not** get this FEP path (official device caveat).  
- Ad **spend** is never free; only **WhatsApp message fees** inside FEP.  
- After FEP ends, marketing templates bill normally (no volume discount on marketing).

### 3.4 When CTWA “matters” vs when it doesn’t

| Situation | CTWA priority |
| --- | --- |
| India SMB acquiring leads from FB/IG into WhatsApp sales chat | **High** — primary paid funnel into Inbox |
| Existing customers, transactional / OTP / order updates only | **Low** — Cloud API templates / CSW, not ads |
| Brand wants form + CRM row before chat | Prefer **Lead Ads**; optionally later WhatsApp |
| Partner wants Samyoj to *create* ads via API | **Future** — needs Marketing API permissions + Access Tier; separate from Tech Provider WhatsApp connect |
| Customer already runs CTWA in Ads Manager | **Now** — ensure number connected, webhook inbound works, reply SLA for FEP |

---

## 4. Lead Ads vs Cloud API (do not confuse)

### 4.1 Lead Ads (Instant Forms)

Official: [Lead Ads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/)  
Webhooks: [Lead Ads webhooks integration](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/quickstart/webhooks-integration/), [Webhooks for leadgen](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/)  
Help Centre: Business Help “About lead ads” (linked from Lead Ads guide).

| Property | Lead Ads |
| --- | --- |
| Where user acts | Facebook / Instagram Instant Form (often prefilled) |
| Output | Lead record (`leadgen_id`) → fetch fields via Graph |
| Real-time path | Page webhook field **`leadgen`** → then GET lead |
| Permissions (typical) | `leads_retrieval`, `pages_manage_ads`, App Review + Business Verification for production |
| Opens WhatsApp CSW / FEP? | **No** (not a WhatsApp message) |
| Samyoj today | **Not** the WhatsApp Connect / Inbox path |

### 4.2 Cloud API / CTWA conversation path

| Property | Cloud API (+ optional CTWA) |
| --- | --- |
| Where user acts | WhatsApp chat |
| Output | Inbound webhook messages → conversation |
| Pricing link | CSW + optional FEP from CTWA/Page CTA |
| Permissions | WhatsApp business messaging / management (Embedded Signup), **not** `leads_retrieval` |
| Samyoj today | **Core** — Connect, Inbox, campaigns, bots |

### 4.3 Side-by-side

| | **Lead Ads** | **CTWA → Cloud API** |
| --- | --- | --- |
| Intent capture | Structured form fields | Chat / bot questions |
| Speed | Form submit → CRM | Must reply fast for FEP + conversion |
| Meta message fees | N/A for the form itself | Apply outside FEP / after FEP |
| Ad spend | Yes (Lead objective) | Yes (Engagement/Leads/Sales/Traffic) |
| Best when | Need phone/email before sales touch; compliance fields | Want conversation-first India SMB sales |

**Hybrid (conceptual):** Lead Ad → CRM → later Cloud API template or agent chat. That is **two** Meta products + Samyoj SaaS — still three ledgers.

---

## 5. Marketing Messages API vs Marketing API (second naming trap)

| | Marketing **API** (Ads) | Marketing **Messages** API for WhatsApp |
| --- | --- | --- |
| Endpoint family | `/act_…/campaigns`, adsets, ads | `/{phone-number-id}/marketing_messages` |
| Bills | Ad account spend | WABA message pricing (same family as Cloud API) |
| Needs ad account? | Yes | No (needs Cloud API–registered number + MM onboarding) |
| Official | [Overview](https://developers.facebook.com/docs/marketing-apis/overview/) | [MM API](https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/), [Sending](https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/sending-messages/) |
| Samyoj adjacency | Future ads tooling | Possible later send-path optimization for **marketing templates**; still not SaaS “ad package” |

MM API docs: marketing templates only on `/marketing_messages`; other types stay on Cloud API `/messages`. Optional `ads_read` only for **conversion insights**, not for buying ads.

---

## 6. Permissions wall (why Samyoj ≠ Ads Manager today)

WhatsApp Tech Provider connect uses WhatsApp scopes / Embedded Signup — **not** full ads stack.

To **manage ads** programmatically you typically need:

- Permissions: `ads_management` and/or `ads_read` — [Permissions reference](https://developers.facebook.com/docs/permissions), [Marketing API authorization](https://developers.facebook.com/docs/marketing-api/get-started/authorization/)
- Feature: **Marketing API Access Tier** (Limited / Full Access; formerly AMSA naming)
- For CTWA creatives: Page ADVERTISE + `pages_manage_ads`, etc. ([CTWA guide](https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp/))
- For Lead Ads retrieval: `leads_retrieval` + App Review / Business Verification ([Lead Ads](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/))

**Learning takeaway:** Shipping “Ads inside Samyoj” is a **different Meta app surface** from WhatsApp Inbox. Do not casually add `ads_management` to the current Connect OAuth without product + review plan.

---

## 7. Samyoj decision cheat-sheet

| Ask | Answer |
| --- | --- |
| Fold ad CPM into ₹3999 Growth? | **No** |
| Fold Cloud API template rates into plan? | **No** |
| Tell customers CTWA can unlock 72h free messaging? | **Yes**, with FEP caveats (24h reply, mobile app, CSW independent) |
| Build Ads Manager clone now? | **No** unless product explicitly asks — adjacency is Inbox + FEP SLA |
| Support Lead Ads as WhatsApp inbox? | **No** — different webhook (`leadgen` vs WhatsApp messages) |
| Care about CTWA for inbound testing? | **Yes** for go-to-market stories; still need working Cloud API webhook (`totalReceived`) |

---

## 8. Official URL list (bookmark)

### Ads / Marketing API
- https://developers.facebook.com/docs/marketing-apis/overview/
- https://developers.facebook.com/docs/marketing-api/get-started/authorization/
- https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/
- https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp/
- https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-multidestination/
- https://www.facebook.com/business/help/447934475640650
- https://developers.facebook.com/docs/permissions

### Lead Ads
- https://developers.facebook.com/docs/marketing-api/guides/lead-ads/
- https://developers.facebook.com/docs/marketing-api/guides/lead-ads/quickstart/webhooks-integration/
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/

### WhatsApp messaging + pricing (FEP / CSW)
- https://developers.facebook.com/docs/whatsapp/pricing/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform
- https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/
- https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/sending-messages/
- https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/onboarding

### Repo
- `docs/billing/00-PRINCIPLES.md`
- `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`

---

## 9. Quiz / self-check (Hinglish + English)

Answer before peeking. Score yourself honestly.

**Q1.** Samyoj Growth plan mein customer ka Facebook ad budget “included” dikhana OK hai?  
**A1.** **Nahi.** Ad spend = Meta ad account ledger. SaaS sirf software.

**Q2.** CTWA click ke baad Meta message fees kab free ho sakti hain?  
**A2.** User CTWA / Page CTA se (Android/iOS) message kare → business **24h** mein reply → **72h FEP**; templates bhi free. Desktop/web FEP path official docs mein supported nahi.

**Q3.** FEP open hai lekin CSW band — non-template text bhej sakte ho?  
**A3.** **Nahi.** CSW independent hai; CSW band → sirf templates (FEP ke andar wo templates free).

**Q4.** Lead Ad submit se WhatsApp Cloud API `totalReceived` badhega?  
**A4.** **Nahi** (by itself). Lead Ads = `leadgen` / Instant Form. WhatsApp inbound alag webhook.

**Q5.** “Marketing Messages API” = Ads Manager API?  
**A5.** **Nahi.** MM API = WhatsApp marketing **templates** endpoint. Marketing API = ads.

**Q6.** Teen invoices kaun-kaun?  
**A6.** (1) Samyoj SaaS Razorpay (2) Meta WABA message fees (3) Meta ad spend.

**Q7.** CTWA chalane ke liye Samyoj ko zaroor Marketing API ship karna padega?  
**A7.** **Nahi.** Customer Ads Manager se CTWA bana sakta hai; Samyoj number + Inbox + fast reply enough for adjacency.

**Q8.** Permissions: WhatsApp Connect OAuth automatically gives `ads_management`?  
**A8.** **Nahi.** Alag permissions + often Marketing API Access Tier / App Review.

**Q9.** FEP ke baad marketing template bhejo — kaun pay kare?  
**A9.** Customer’s **Meta WABA** message bill (not Samyoj plan).

**Q10.** Kab CTWA Samyoj ke liye “high priority” adjacency hai?  
**A10.** Jab paid FB/IG traffic ko WhatsApp sales chat mein laana primary funnel ho — Inbox/bot SLA = Meta cost + conversion lever.

---

## 10. One-line memory

**Ads buy attention; Cloud API carries the chat; Samyoj sells the inbox — three prices, never one SKU.**
