# 17 — Meta WhatsApp billing and partner policy

**Accessed:** 2026-08-14  
**Purpose:** Official Meta commercial model + partner rules that constrain Samyoj SaaS billing. Not product code.  
**Rule:** Cite developers.facebook.com / developers.meta.com / business.whatsapp.com / whatsapp.com/legal. Do not invent INR/msg rates from memory.

Companion: [08-USAGE-AND-META-COSTS.md](08-USAGE-AND-META-COSTS.md), [00-PRINCIPLES.md](00-PRINCIPLES.md), [15-SOURCES.md](15-SOURCES.md).

---

## 0. Date-stamped model change (read this first)

| When | What Meta documented | Source (fetched 2026-08-14) |
| --- | --- | --- |
| Until **30 Jun 2025** | **Conversation-based pricing (CBP).** One charge per 24h conversation of a category (marketing / utility / authentication / service). Multiple templates of the same category in that window = one conversation charge. | [Conversation-based pricing (Deprecated)](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing) — page updated **2026-05-21**, banner: *Deprecated — replaced by per-message pricing on July 1, 2025.* |
| From **1 Jul 2025** | **Per-message pricing (PMP).** Charged when a **template** is **delivered** (`"type":"template"`). Rate = template category × recipient country calling code. | [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) — page updated **2026-08-05**. |
| From **1 Nov 2024** | Service conversations / non-template messages **free** (including AI-enabled conversational experiences, per CBP page). | Same CBP page; current Pricing page: “As of November 1, 2024 — Meta does not charge for non-template messages.” |
| From **1 Jul 2025** | Utility templates **inside an open 24h customer service window (CSW) are free**. Volume tiers for utility & authentication. | Current Pricing page. |
| **1 Jan 2026** | India **billing localization** (INR) for eligible Sold-To India customers. | Current Pricing page, “Billing localization for Brazil and India.” |
| **1 Aug 2026** | Meta Business Agent **per-token** pricing (Meta’s own agent, not Samyoj AI). | Current Pricing page + [Upcoming pricing updates for Meta Business Agent, service and utility messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages). |
| **1 Oct 2026** (**upcoming as of this fetch**) | **Service messages charged per-message** (same rates as utility/auth for that market). **Utility templates inside CSW also charged.** **No volume tiers for service.** Rates to be published by **1 Sep 2026**. | Same upcoming-updates page (search snippet + Pricing page calendar). |
| **31 Dec 2026** | Eligible India customers must migrate **all WABAs to INR** or, from **1 Jan 2027**, Meta will **stop delivering** messages of non-INR WABAs. Currency Migration APIs available **1 Jun 2026**. | Current Pricing page. |
| **15 Oct 2026** | Embedded Signup **v2 deprecated** — migrate to v4 (product note; confirm changelog before engineering). | Platform changelog. |

**What this means for Samyoj docs and UI:** any copy that still says “conversation charge,” “₹X per conversation,” or that uses Graph `conversation_analytics` as if it were the live bill is **legacy**. Live Meta billing is **per delivered template** (and, from Oct 2026, per delivered service message). CURRENT CODE `ConversationCharge` + `pollConversationAnalytics` still uses the **old conversation analytics shape**. That is a known gap, not Meta’s current invoice.

---

## 1. Cloud API commercial model (current, 2025+)

Official page: [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) (updated **Aug 5, 2026**). Canonical path also: `https://developers.facebook.com/docs/whatsapp/pricing/`.

### 1.1 What Meta charges today (as of 2026-08-14)

Quoted from that page:

- “Effective July 1, 2025, Meta charges on a **per-message basis** for messages businesses deliver to WhatsApp users.”
- “You are only charged when a template message is *delivered* (`"type":"template"`).”
- “Rates vary based on the template’s category and the recipient WhatsApp phone number’s country calling code.”

**Not charged (still documented as free as of this fetch):**

| Message | Condition | Notes |
| --- | --- | --- |
| Inbound user → business | Always | “Messages sent from a WhatsApp user to a business are not charged.” |
| Non-template outbound (`text`, `image`, interactive, etc.) | Only inside open **24h CSW** | Cannot be sent outside CSW. |
| Utility **templates** | Inside open CSW | Free **until 1 Oct 2026**. |
| All types including templates | Inside **72h free entry point (FEP)** window | Click-to-WhatsApp ads / Facebook Page CTA, if business replies within 24h of the click. FEP lasts 72h from the business reply. CSW is **independent** of FEP. |
| WhatsApp Business **app** messages (coexistence) | App sends | “messages sent by the business via the WhatsApp Business app will continue to be free, but messages sent via Cloud API will be subject to Cloud API pricing.” Source: [Onboard WhatsApp Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users). App messages **do not** open/extend Cloud API CSW. |

### 1.2 Categories

Templates (only type that can be sent **outside** CSW):

| Category | Typical use | Charged when delivered? |
| --- | --- | --- |
| **Marketing** | Promos, offers, cart, broadcasts | Always (except inside FEP). **No volume discount.** |
| **Utility** | Order updates, reminders, account alerts | Outside CSW: yes. Inside CSW: free until 1 Oct 2026, then yes. Volume tiers apply when charged. |
| **Authentication** | OTP / login | Yes (plus **authentication-international** in some markets). Volume tiers apply. |

**Service** is **not** a template category. It is non-template replies inside CSW. Historically a CBP conversation category; under PMP it is `category: service` in webhooks / Pricing Analytics. Free today; **billable from 1 Oct 2026**, same market rates as utility/auth, **no volume tiers**.

Businesses accept the category on the **approved template at time of use**. Recategorization by Meta can change what the next send costs.

### 1.3 Customer service window (24h) — who pays

Official: [Sending messages / customer service windows](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages).

- Opens when a **user messages or calls** the business. Resets on each subsequent user message/call.
- While open: business may send **any** message type (templates and non-templates).
- When closed: **only approved templates**.
- **Who pays:**
  - User inbound: never billed.
  - Business non-template in CSW: **Meta $0 today**; **Meta bills per message from 1 Oct 2026**.
  - Business marketing template anytime (except FEP): **customer’s Meta bill**.
  - Business utility template in CSW: **Meta $0 today**; **billed from 1 Oct 2026**.
  - Samyoj SaaS subscription: **never** this meter. Inbox reply volume is software, not Meta.

**Product implication:** Inbox “free replies” copy is true **for Meta** only until Oct 2026. After that, even support replies cost Meta money. Samyoj must not promise “unlimited free WhatsApp messages” on Growth/Pro. Disclose the date.

### 1.4 Official charge example (Meta’s table, not ours)

From the Pricing page (hours 0–30):

1. Hour 0 — marketing template → **Marketing charge**.
2. Hour 2 — user replies → CSW opens → **no charge**.
3. Hour 3 — business `type:text` → **free** (non-template in CSW).
4. Hour 4 — utility template (order confirm) while CSW open → **free** (until Oct 2026).
5. Hour 26 — CSW closed.
6. Hour 30 — utility template outside CSW → **Utility charge**.

Four messages sent, **two** billed (today).

### 1.5 Volume tiers

Official Pricing page, “Volume tiers”:

- Apply to **utility and authentication only**. Marketing has **no** volume discount.
- Aggregated at **business portfolio** across **all WABAs**.
- Market–category specific (e.g. India–authentication).
- Only **charged** messages count (free in-CSW utility and FEP utility do **not** count).
- Reset monthly at 12:00 WABA timezone.
- Webhook: `account_update` / `VOLUME_BASED_PRICING_TIER_UPDATE` (from 1 Oct 2025).
- Insights are approximate; “Volume tiers will be determined solely by Meta.”

From 1 Oct 2026: **no volume tiers for service messages**.

### 1.6 India specifically

Do **not** paste unofficial ₹/msg as Meta’s rate. Official rates are **INR CSVs** linked from the Pricing page (row **INR** — Rates CSV / Volume tiers CSV / PDF). Those CDN URLs rotate; always download from the live Pricing page.

Documented India events on that page:

- **1 Jan 2026:** India marketing **rate increased**.
- **1 Apr 2026:** India **authentication-international** rate increased.
- **Billing localization:** launched **1 Jan 2026** for partners and directly-integrated businesses whose **Sold-To country is India** in Billing Hub.
- **Hard stop:** migrate every WABA in the portfolio to **INR by 31 Dec 2026**, or **1 Jan 2027** Meta stops delivering non-INR WABAs of eligible customers.

**Authentication-international:** If the business is **not** in the same country as the user’s calling code, and the destination has an auth-international rate (India is on that list), delivered auth templates can be billed at the **international** rate. India-based WABA → India (+91) user: **not** international. India-based WABA → Indonesia user (if criteria met): **can be**. Source: [Authentication-international rates](https://developers.facebook.com/docs/whatsapp/pricing/authentication-international-rates/).

**Samyoj CURRENT CODE gap:** `usage.service.ts` uses `MARKETING: 0.78`, `UTILITY/AUTH: 0.35`, `SERVICE: 0`, `USD_TO_INR = 83`. Those are **heuristics**, not the live INR rate card, not volume-tiered, not country-mapped, and they still think in **conversations**. Campaign preview (`POST /estimate`) uses the same table. Never show this as “your Meta invoice.”

Third-party blogs in 2026 cite India PMP list rates around **₹0.86 marketing / ~₹0.115 utility-auth** (Jan 2026 vintage). **Not official.** If UI needs a number, fetch Meta CSV or WhatsApp Manager / `pricing_analytics`, and label “estimate.”

### 1.7 What Meta bills vs what a SaaS bills

| Asset | Who owns | Who Meta bills | What Samyoj may charge |
| --- | --- | --- | --- |
| **WABA** (WhatsApp Business Account) | Customer’s Business Portfolio | API usage on that WABA (or partner credit line) | Software to operate it (inbox, templates UI, campaigns) |
| **Phone number** registered on Cloud API | Customer | Usage on that number; **no separate “number rental” in the PMP docs** (throughput/quality live on the number) | **Connect slot** in Samyoj (1 / 2 / 5 / unlimited by plan) |
| **Display name / verified name** | Customer (Meta review) | Not a Samyoj SKU | Help with display-name process as support, not a Meta fee |
| **Official Business Account (green tick)** | Meta eligibility | Not sold by Samyoj | Never sell “blue/green tick” |
| **Templates** | Customer WABA | Per delivered template | Template builder is software |
| **Calling API** | Customer WABA | Business-initiated minutes (6s pulses) + permission-request messages as PMP | Samyoj Calling **feature flag** ≠ Meta calling rates |
| **Samyoj seats / contacts / AI / workflows** | Samyoj org | Never | SaaS subscription |

Meta Help: [About billing for your WhatsApp Business Account](https://www.facebook.com/business/help) — Billing Hub / WhatsApp Manager. Samyoj Razorpay invoice is a **different merchant, different tax invoice**.

### 1.8 Payment method Meta requires

[Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup/):

- **Tech Provider / Tech Partner:** “onboarded business customers must add a payment method to their WhatsApp Business account” before they can message. Help Center: *Add a credit card to your WhatsApp Business Platform account*.
- **Solution Partner:** partner **shares credit line**; customer can message **without** attaching their own card during onboarding.

**Customers still pay Meta even if they pay Samyoj.** Two cards: Razorpay (Samyoj SaaS) and Meta BM (Cloud API), unless we later become / partner as Solution Partner and the contract is pass-through.

Test WABAs / test numbers: Cloud API docs say they have relaxed limits and **do not require a payment method** to send templates — not for production customers.

---

## 2. Partner / product policy for software like Samyoj

### 2.1 Partner types (official comparison)

[Partners overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview) — updated **2026-05-21**.

Meta’s word is **Tech Provider / Solution Partner / Tech Partner**, not “BSP.” **BSP** in industry slang ≈ **Solution Partner** (credit line + invoice clients for API usage). Do not call Samyoj a BSP in UI unless we actually are a Solution Partner.

| | Solution Partner | Tech Provider | Tech Partner |
| --- | --- | --- | --- |
| Full Cloud API services to clients | Yes | Yes | Yes |
| Credit line with Meta | **Yes** | No | No |
| Customers skip adding a card | **Yes** | No | No |
| Partner invoices clients for **API usage** (vs Meta billing them) | **Yes** | **No** | **No** |
| Meta Business Partner | Yes | No | Yes |
| Accelerator | Yes | No | Yes |
| Direct Support | Yes | Yes | Yes |

Quoted:

- Solution Partners “have **credit lines** which can be extended to clients… removing the need for those clients to enter their own payment method… Solution Partners can **directly invoice** their clients for the WhatsApp Business Platform services.”
- “Becoming a Solution Partner is a **lengthy process**, so if you don’t need a credit line and don’t need to invoice your clients for API usage directly, consider becoming a **Tech Provider** instead.”
- Tech Providers: “clients… must provide their own payment method after onboarding is complete. **Meta will then bill these clients for API usage, and the Tech Provider will bill for other services.**”

**Samyoj TARGET partner model: Tech Provider.** Sell inbox/AI/seats. Meta bills the customer’s WABA. Optional later: Multi-Partner Solution with a Solution Partner who shares a credit line, or apply to become Solution Partner (Enterprise pass-through).

Onboarding: Embedded Signup (recommended), Hosted ES, client-created WABA shared in Meta Business Suite. Partner-initiated WABA creation is **Solution Partner only**. Tech Provider uses **business tokens** only (not system token credit-line share).

App Review: `whatsapp_business_management` + `whatsapp_business_messaging` need **Advanced access** or Embedded Signup will not grant them; API returns error `200` without it.

Onboarding volume: Meta historically limits unverified Tech Providers (commonly **10 new customers / 7 days** until verification + App Review, then higher). Confirm live Tech Provider get-started page before promising sales capacity.

### 2.2 What ISPs/SaaS **may** charge vs **must not**

**WhatsApp Business Terms for Service Providers** — last modified **2018-06-12** — [whatsapp.com/legal/business-terms-for-service-providers](https://www.whatsapp.com/legal/business-terms-for-service-providers/):

Quoted **Price Transparency**:

> You may (a) charge fees to your Clients for accessing and using the WhatsApp Business APIs, including your customary fees for technology integration, support, management, and storage services, and applicable taxes related to the WhatsApp Business APIs; and/or (b) offer access to the WhatsApp Business APIs as part of a **bundled offering** with any other products or services. You have **sole discretion** as to the fees that you charge… **However, you will clearly disclose to each Client, separate from your fees, the amount that Facebook charged you for the Client’s use of the WhatsApp Business APIs, and the amount that you charge the Client for its use of the WhatsApp Business APIs.**

Also:

- Use the Solution **solely for the benefit of each Client**.
- Each Client must accept WhatsApp Business Solution Terms (or you accept **on their behalf** and are jointly liable).
- **May not** create a WABA without Client request/consent.
- **May not** create a WABA for a **future unnamed Client**.
- **Must not** block a Client from its WABA (unless WhatsApp requests disable).
- **Portability:** on Client request, transfer WABA + data within **30 calendar days**, then delete unless instructed otherwise.
- If Client asks Meta for billing info on their WABA, Meta **may send it**.

**When this clause bites Samyoj:**

- **Tech Provider, Meta bills customer:** Samyoj does **not** “charge for API usage.” Price Transparency’s “amount Facebook charged **you**” is **₹0** on Samyoj’s books. Still **disclose** that Meta bills the customer separately (UI + contract). Do **not** put Meta usage as a line on the Samyoj GST invoice as if we collected it.
- **Solution Partner / credit line:** Samyoj **is** charged by Meta. Then we **must** show Meta’s charge **separately** from our markup/software fee. Never a single blended “WhatsApp ₹X.”

**WhatsApp Business Solution Terms** — last modified **2026-03-06** — [whatsapp.com/legal/business-solution-terms](https://www.whatsapp.com/legal/business-solution-terms/):

- Comply with Documentation + **WhatsApp Business Messaging Policy**.
- **Third Party Service Provider** (Samyoj, when the customer retains us): process Business Solution Data **only on the Client’s behalf**, not for our own purposes; industry-standard security.
- **Restrictions:** do not use data (except message-thread content as needed) to **track/build/augment profiles** on individual WhatsApp users; do not sell/license/distribute Business Solution Data.
- **AI Providers clause (critical for Growth/Pro AI):**
  - AI/ML as the **primary** product offered **via WhatsApp** is **prohibited** (exception: users with EEA or Brazil country codes).
  - You **may** retain an AI vendor as Third Party Service Provider.
  - **Must not** use Business Solution Data (including anonymous/aggregate/derived) to **create, develop, train, or improve** general AI models.
  - **May** fine-tune a model for the **Client’s exclusive use** if that does not leak into other models.
  - Meta may terminate for breach. Survives termination.

**WhatsApp Business Terms of Service** — [whatsapp.com/legal/business-terms](https://www.whatsapp.com/legal/business-terms/):

- Company is responsible for carrier/internet fees and taxes for **their** use.
- Must obtain lawful **opt-in** to share contacts with WhatsApp and to message them.
- Honor user opt-out / block / spam reports. WhatsApp may suspend the business.
- Service providers who manage communications get access to aggregated metrics when the Client grants permissions.

**Commerce Policy:** [whatsapp.com/legal/business-policy](https://www.whatsapp.com/legal/business-policy) — selling via Catalogs/payments must follow **Meta Commerce Policy**. Samyoj commerce checkout for the *org’s customers* is not SaaS billing; it is still in-scope for Commerce Policy if we surface Catalog.

**Brand:** WhatsApp Brand Guidelines (listed on [whatsapp.com/legal](https://www.whatsapp.com/legal/?lang=en)). Do not present Samyoj as WhatsApp. Do not use the WhatsApp logo as our app icon. Footer: third-party platform.

**Legal index note (2026-08-14):** WhatsApp Legal Resources states terms for WhatsApp for Business are updating **effective 2026-09-23**. Re-read Business Terms / Service Provider Terms after that date.

### 2.3 Multi-tenant Cloud API, customer WABAs, Embedded Signup

- Each Client = **their** WABA under **their** Business Portfolio (or shared to us). Not one Samyoj WABA for all tenants.
- Embedded Signup generates assets and authorizes **our app** on **their** WABA.
- If not Solution Partner: **payment method on their WABA** before production messaging.
- Multi-Partner Solutions: Tech Provider + Solution Partner can jointly manage; SP shares credit line.
- Hosted Embedded Signup exists if we do not want to host the JS ourselves.
- Coexistence: Client can keep WhatsApp Business app 1:1; we must ingest `smb_message_echoes` to keep Inbox history honest. App sends are **free** and **do not** drive our Meta usage widget.

### 2.4 Data privacy / storing messages / AI on conversations

- Store messages to provide the inbox the Client asked for (Service Provider: solely for the Client).
- DPA / India DPDP / retention policy = Samyoj legal, not Meta billing — but Solution Terms require safeguards “meet or exceed industry standards.”
- **Do not** send conversation logs to train OpenAI/Anthropic/general models. Vendor contracts: no training. Fine-tune **per-tenant exclusive** models only.
- Growth “AI Included” / Pro “AI Advanced” must remain **ancillary** (summaries, suggested replies, bots **inside the inbox**), not “Samyoj is an AI chatbot you message on WhatsApp as the product.” Escalation to a human in CSW is a Messaging Policy expectation for automation.
- Do not build shadow profiles of WhatsApp users across tenants.

### 2.5 Template quality, quality rating, bans — billing UX

Official quality: last 7 days of user feedback (blocks, reports, mutes, archives), recency-weighted. Shown in WhatsApp Manager → Account tools → Phone numbers. API `quality_rating`: `GREEN` / `YELLOW` / `RED` / `NA`. High-traffic numbers can flip in minutes.

[Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/): unique users outside CSW / rolling 24h, now **portfolio-level**. Quality still **per number**. Throughput upgrades need Medium+ quality.

**CURRENT CODE:** `QualityRatingBanner` flags YELLOW/RED and links **View usage → `/billing`**. That is only half-right:

- Billing page can **display** quality we already poll (`pollQualityRatings` → `WhatsappNumber.qualityRating`).
- Paying Samyoj **does not** restore GREEN. Do not imply “upgrade to Pro to fix quality.”
- Primary CTA should be **Open WhatsApp Manager** + template/opt-in hygiene, not Razorpay.
- RED: warn campaigns, optionally pause marketing sends in-product (policy-aligned, not a Meta requirement to pause).

Bans / restrictions are Meta enforcement on the WABA/number. Samyoj subscription continues until the customer cancels; we do not refund SaaS because Meta banned a number (state this in Terms). Offer support to appeal via Meta, not a billing credit.

### 2.6 Coexistence and Calling (commercial)

**Coexistence:** App messages free; Cloud API billed; app does not open CSW. Entitlement “Inbox” should still show app echoes so agents do not double-send.

**Calling API pricing** — [docs](https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/) updated **2026-07-09**:

- “**All user-initiated calls are free.**”
- Business-initiated: duration in **six-second pulses** (fractional pulse rounds **up**), country of **called** number, **volume tiers** on minutes / calendar month (same accrual idea as messaging).
- Call that crosses a tier: **entire call** at the **lower** (higher-tier) rate.
- “**A valid payment method is required to place calls.**”
- **Call permission request messages** = **per-message pricing** (templates).
- INR rate cards exist on that page (do not invent ₹/min here).
- Separate from Samyoj Calling entitlement (`OrgFeatureFlag.calling` is currently **never enforced**).

**AI voice / Samyoj Calling:** Meta bills minutes + permission templates. Samyoj may include the **feature** on Pro/Enterprise, not the **minutes**. AI-on-call still hits the AI Providers clause (no general-model training; primary-product restriction).

### 2.7 Marketing / opt-in — if we sell campaigns

[Business Policy](https://www.whatsapp.com/legal/business-policy):

- Opt-in **required** before initiating messages/calls.
- Business chooses method; must be **lawful**. Best practice: category-specific opt-in; **separate opt-in to call**.
- Honor opt-out per category.
- Templates only for designated purpose; Meta may pause/reject templates.

Nov 2024 industry note (confirm against current Messaging Policy): opt-in may be **general** (not WhatsApp-branded) if lawful — still **must** have consent. Samyoj campaigns = **marketing templates** = **Meta PMP marketing rate per delivered message** + quality risk. Plan price does **not** include that. Selling “unlimited broadcasts” on Growth is **software unlimited**, not Meta-free.

---

## 3. How this compares to Samyoj’s plan

| Samyoj SKU language | Means | Does **not** mean |
| --- | --- | --- |
| Launch/Starter/Growth/Pro **INR prices** | Software subscription (inbox, automation, AI, seats, contacts, **WA connect slots**) | Meta PMP, Calling minutes, display-name, OBA |
| Starter “**1 WhatsApp number**” | Samyoj will connect **one** Cloud API number in-product | Meta’s portfolio cap (starts at **2**, rises to **20** when verified or messaging limit 2,000). Not a Meta phone-number fee. |
| Growth “2 numbers” / Pro “5” | Same: product gate | Customer may still register more on the WABA in WhatsApp Manager; **Samyoj must not sync/send on extras** until they upgrade |
| “AI Included” | Ancillary inbox AI | Meta Business Agent tokens (from 1 Aug 2026) or “we are an AI Provider whose primary product is WhatsApp AI” |
| Campaign cost in UI | Heuristic from `CATEGORY_RATES_INR` | Live Meta rate card / volume tier / auth-international |
| QualityRatingBanner → `/billing` | Convenient dump of polled `qualityRating` | Paying Samyoj fixes Meta quality |

**Never “included” unless Enterprise contract explicitly pass-through** (requires Solution Partner credit line + GST treatment of Meta recharge — see [06](06-INVOICING-TAX-COMPLIANCE.md)). Default: **always extra, paid to Meta (or a BSP), shown separately.**

---

## 4. Must-answer (counsel + product)

### 4.1 Can Samyoj legally sell a WhatsApp inbox SaaS with our own INR plans? Under what partner model?

**Yes.** As a **Tech Provider** (recommended now): offer Cloud API services to onboarded clients; **Meta bills API usage**; **we bill other services** (quoted Partners overview). INR Razorpay plans are those “other services” (integration, inbox, storage, support, AI ancillary, seats). Service Provider Terms explicitly allow charging for integration/support/management/storage and **bundling** with other products.

We must: App Review + business verification path; Embedded Signup; Client accepts WhatsApp Business Solution Terms; not resell “WhatsApp itself”; not hide that Meta charges apply; brand as third-party; portability; no WABA for unnamed future clients.

**Not required** to be a Solution Partner / BSP to sell SaaS. Become SP only if we want to **float Meta spend** and invoice it.

### 4.2 Must we show Meta fees separately from Samyoj subscription on invoices?

| Model | Samyoj GST invoice | Meta fees |
| --- | --- | --- |
| **Tech Provider (TARGET)** | SaaS only (plan SKU + GST). **Do not** mix Meta INR. | Appear on **Meta / WhatsApp Manager / Billing Hub**. UI + contract **must still disclose** that conversation/message charges apply and are billed by Meta. |
| **Solution Partner** | Software fee **and**, separately, “Meta Cloud API usage ₹X (as charged to us) + our processing ₹Y” if we invoice usage | Price Transparency **requires** disclosing Facebook’s charge **separate from** our charge. |

**Recommendation:** never mix Meta INR into the Samyoj subscription invoice. Competitors who bury a 20–30% Meta markup inside “platform fee” are the pattern Indian SMBs punish on G2; it is also the clause Meta wrote to prevent.

### 4.3 Who is the Meta billed party — customer’s BM or Samyoj’s BM (on-behalf / credit line)?

| Model | Bill-To for Cloud API |
| --- | --- |
| Tech Provider | **Customer’s Business Manager / WABA payment method** (card in BM). Samyoj is not the billed party. |
| Solution Partner | **Partner credit line.** Partner is liable to Meta, then invoices the Client. Partner is Bill-To. |
| Multi-partner | SP’s credit line shared onto WABAs onboarded via the joint solution. |

Embedded Signup: if we are **not** SP (and not partnered with one), customer **must attach a payment method before messaging**.

### 4.4 Numbers beyond plan — product gate vs Meta allowing more?

Meta **phone number cap** ([Business phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/)): new portfolios **2** registered numbers; **verified** or messaging limit **2,000** → cap **20**. Webhook `max_phone_numbers_per_business`.

That cap is **independent** of Samyoj Starter=1 / Growth=2 / Pro=5.

**If the customer connects more numbers than the plan:** Meta may accept the register. **Samyoj must product-gate** connect/register in our UI and refuse to attach extras to the org. Do not “sync all WABA numbers” on webhook without counting against entitlement.

“1 WhatsApp number” = **entitlement to connect one Cloud API number in Samyoj**, not Meta’s phone-number fee, not the portfolio cap.

### 4.5 Calling / AI voice — Meta billing/policy to mention in entitlements?

Yes, in the entitlements footnote and Calling settings:

- User-initiated calls: **Meta free**.
- Business-initiated: **Meta bills** 6-second pulses × country × volume tier. Payment method required.
- Call permission request = **PMP** (usually utility/marketing template).
- Separate from Samyoj plan (even if Pro includes the Calling **module**).
- AI on calls: Third Party / AI Providers rules — no general-model training; do not make “AI voice on WhatsApp” the **primary** product; human escalation; calling opt-in separate from messaging opt-in (Business Policy best practice).

### 4.6 What we must disclose in UI

Minimum copy (Connect WhatsApp, Billing, Campaigns, Calling):

1. Samyoj is a **third-party** platform. We are **not** WhatsApp / Meta.
2. **Conversation / per-message charges apply** and are billed by **Meta** (or a Solution Partner) to the **WhatsApp Business Account**, not included in the Samyoj plan (unless an Enterprise pass-through contract says otherwise).
3. A **payment method in WhatsApp Manager / Meta Business Suite** is required to send templates (Tech Provider).
4. **Opt-in** required before campaigns / business-initiated calls; honor STOP.
5. **Quality and bans** are Meta’s; upgrading Samyoj does not buy a better rating.
6. From **1 Oct 2026**, even **service replies** may incur Meta charges (link official Pricing page).
7. India Sold-To: migrate WABA currency to **INR by 31 Dec 2026**.

Forbidden: “Unlimited WhatsApp included,” WhatsApp logo as ours, collecting Meta App Secret from the user, selling green ticks.

---

## 5. QualityRatingBanner vs WhatsApp Manager

**Keep** the banner (YELLOW/RED is operationally urgent). **Change the destination and copy** (docs-only recommendation):

- Title: “WhatsApp number quality (Meta)” not “Billing problem.”
- Link 1: View in Samyoj usage (estimates).
- Link 2: **Open WhatsApp Manager** (phone numbers / quality).
- Do not sit this only on `/billing` next to Razorpay plans.

---

## 6. Campaign cost heuristics vs Meta rate cards

| | CURRENT CODE | Meta official (2026-08-14) |
| --- | --- | --- |
| Unit | Conversation-like `conversation` count + optional `cost` USD | Delivered **template** (PMP); `pricing_model: PMP` |
| Marketing IN | ₹0.78 / unit | Live INR CSV (do not hard-code); **no** volume tier |
| Utility/Auth IN | ₹0.35 | Live CSV + **volume tiers** + auth-international |
| Service | ₹0 | ₹0 until **1 Oct 2026**, then utility-equivalent, **no tiers** |
| FX | USD × 83 | INR WABA billed in INR for eligible India Sold-To |
| Country | Forced `'IN'` | Recipient **calling code** |

**Document the gap in-product:** “Estimated using Samyoj rates, not your Meta invoice. Check WhatsApp Manager.” Phase 3+ of blueprint: replace poll with `pricing_analytics` / status webhook `pricing` objects.

---

## 7. Implementation notes for billing (no code in this pack)

1. Checkout / pricing page footnote: Meta fees extra (section 4.6).
2. Connect WhatsApp success screen: “Add a card in WhatsApp Manager before sending templates.”
3. Entitlement `whatsappNumbers` = Samyoj slots; compare count of **connected** `WhatsappNumber` rows, not Meta’s cap.
4. Do not add Meta usage to Razorpay Subscription amount.
5. Enterprise SOW only: optional pass-through if/when Solution Partner.
6. Before 1 Oct 2026: product + email that service messages become paid.
7. India INR WABA migration reminder in Settings for Sold-To IN.
8. Re-read WhatsApp legal pages after **2026-09-23** terms update.
