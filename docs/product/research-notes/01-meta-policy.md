# Meta policy research — quality, limits, OBA, templates, clicks (Samyoj)

**Audience:** Samyoj founders / PMs (WhatsApp Cloud API SaaS, Tech Provider).  
**Scope:** Research only. Do **not** implement product code from this note.  
**Researched:** 2026-08-29 against official Meta / WhatsApp docs (Graph **v26.0** examples). Policies and Graph fields change — re-open the linked pages before shipping UI copy.  
**Partner model:** Samyoj is a **Tech Provider** (Embedded Signup). We do not own the customer WABA’s Meta bill.

### Two ledgers (never mix)

| Ledger | Who bills | What it is |
|--------|-----------|------------|
| **Meta Cloud API** | Meta → customer’s WABA payment method | Per-message template delivery (from **1 Jul 2025**); rates = category × recipient country. **Do not invent INR/msg numbers.** See [Pricing](https://developers.facebook.com/docs/whatsapp/pricing/). |
| **Samyoj SaaS** | Samyoj → customer (Razorpay when TARGET ships) | Software: Inbox, campaigns, bots, Connect. Plan price is **not** Meta message fees. |

Upcoming Meta commercial dates (disclose, do not invent rates): **1 Oct 2026** service messages + utility-in-CSW become charged; **31 Dec 2026** India INR WABA migration deadline. Canonical: [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).

**Development vs Live:** Tester / test WABA numbers have relaxed limits and no payment method for templates. Customer Live numbers inherit **that customer’s** portfolio quality, tier, and Meta invoice. Samyoj’s own test number is **not** the customer’s quality or tick.

---

## Quality rating

### Phone `quality_rating` vs template `quality_score`

These are **two different Graph objects**. Do not collapse them into one “quality” chip.

| Surface | Graph field | Typical values | WhatsApp Manager label |
|---------|-------------|----------------|------------------------|
| **Business phone number** | `quality_rating` on `GET /{phone-number-id}` | `GREEN`, `YELLOW`, `RED`, `UNKNOWN`, `NA` | High / Medium / Low (last **7 days** of user feedback) |
| **Message template** | `quality_score.score` (+ `date`) on Template API | `GREEN`, `YELLOW`, `RED`, `UNKNOWN` | Active — High / Medium / Low / Quality pending |

Official phone examples return `"quality_rating": "GREEN"`. Official template examples return `"quality_score": { "score": "GREEN", "date": … }`.

Throughput docs also say a phone needs a `quality_score` of **YELLOW or higher** to auto-upgrade to 1,000 messages/second. That is Meta mixing names for the **same phone quality ladder** (Medium+). For the dashboard, **read `quality_rating` on the phone node** and `quality_score` on the **template** node. Do not invent a third field called “promo quality.”

Help Center (Platform, not Business App): quality is based on **recent messages customers received over the past 7 days**, driven by **blocks, reports, and related feedback** (block reasons: no longer needed, didn’t sign up, spam, offensive, no reason). Recency-weighted. High-traffic numbers can flip in minutes.

**Discontinued (do not show in new UI):** phone statuses **Flagged** and **Restricted** were discontinued **7 Oct 2025**.

### What the dashboard should show vs “promo / marketing vs utility mix”

**Show (honest, Graph-backed):**

- Phone `quality_rating` as Meta returns it (map GREEN→High, YELLOW→Medium, RED→Low; keep UNKNOWN/NA literal).
- Per-template `quality_score` for templates we send.
- Webhook `phone_number_quality_update` and `message_template_quality_update` to refresh without polling.
- Throughput `GET /{phone-number-id}?fields=throughput` (`STANDARD` vs higher) — **separate** from quality color.

**Do not show as if Meta computed it:**

- “Promo messages %” / “marketing vs utility mix” as a **quality rating**. Graph does **not** expose a mix score that drives GREEN/YELLOW/RED.
- Causal story (true, not a field): unsolicited **MARKETING** blasts → more blocks/reports → YELLOW/RED. Utility/auth to people who asked for the update tends to attract less spam feedback. That is **ops advice**, not a meter we can fake from our send logs.

### Throughput impact (quality is a gate, not the mps number)

Two different caps:

1. **Messaging limit** (portfolio unique users / 24h outside CSW) — quality + volume drive **automatic scaling**. Low quality **blocks** tier growth even if volume is high.
2. **Throughput** (messages per second on **one** phone) — default **80 mps**; automatic **1,000 mps** if: portfolio messaging limit is **unlimited**, the number messaged **100K+ unique users** outside CSW in a moving 24h, and phone quality is **YELLOW or higher**. Higher throughput is **not** a Meta fee. Coexistence (Business App + Cloud API) is fixed at **20 mps**.

Exceeding mps → error **130429**. Spam/block send restrictions → **131048**. Pair rate (too many to the **same** user) → **131056**. Throughput upgrade window (~1 min) → **131057**.

**Samyoj SaaS:** software seats do not buy GREEN. Meta Cloud API **fees** also do not buy GREEN. Recovery is behavioral (pause cold marketing, honor opt-out, wait for the 7-day window) — not a paid “boost.”

**Sources:** [Business phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers) · [Template quality](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality) · [Throughput](https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput) · [Quality rating Help](https://www.facebook.com/business/help/896873687365001)

---

## Messaging limits

### What the limit actually is (2025–2026)

From **Graph v24.0+** (changelog: limits moved from **per phone** to **business portfolio**):

- Cap = **unique WhatsApp user phone numbers** the **portfolio** can **deliver** messages to **outside a customer service window**, in a **moving 24-hour** period.
- **Shared** by every business phone on that portfolio. One number can consume the whole bucket.
- New portfolios start at **250**. Scaling path → **2,000**. Then automatic: **10,000** → **100,000** → **Unlimited**.
- Scaling path to 2,000 (one of): Business Verification; partner-led verification; **or** 2,000 delivered **outside-CSW** messages to unique users in a **30-day** window using **high-quality** templates. Then Meta **analyzes quality** and may **deny**.
- After 2,000: auto-upgrade one tier within **6 hours** if (a) high-quality messages across numbers/templates and (b) **≥50% of current limit used in last 7 days**.

**In-window (CSW) deliveries do not consume this unique-user cap.** Counting every Inbox reply against “daily remaining” is wrong.

Deprecated: `messaging_limit_tier` as the **phone’s own** limit. Use `whatsapp_business_manager_messaging_limit` instead. Webhook `max_daily_conversation_per_phone` is being replaced by `max_daily_conversations_per_business`; Meta said the old parameter would be **removed February 2026** — confirm the live webhook payload before coding.

### What Graph actually exposes vs what we must NOT fake

**Graph returns a tier enum, not remaining quota.**

```
GET https://graph.facebook.com/v26.0/{PHONE_OR_WABA_OR_BUSINESS_ID}?fields=whatsapp_business_manager_messaging_limit
→ { "whatsapp_business_manager_messaging_limit": "TIER_250" }
```

Documented enum: `TIER_50`, `TIER_250`, `TIER_2K`, `TIER_10K`, `TIER_100K`, `TIER_UNLIMITED`, `UNTIERED`. Same field exists on Business Portfolio, WABA, and phone (field expansion OK).

WhatsApp Manager → **Account tools → Messaging limits** can show remaining unique-user capacity in Meta’s UI. **That remaining integer is not a documented Graph field** as of this research. `health_status` tells AVAILABLE / LIMITED / BLOCKED with reason text — not “187 left today.”

**Do not fake remaining as `tier_size − our_send_count`.** Reasons:

- Limit is **unique users**, not message count.
- Only **outside CSW** deliveries count.
- Window is **moving 24h**, not calendar IST day.
- Cap is **portfolio-wide**; our org may see only one number.
- Unlimited has no remaining integer.
- We do not see other numbers on the same BM.

Honest dashboard: show **tier label** + link/copy “WhatsApp Manager shows remaining unique users.” Optional: “unique users we attempted outside CSW in the last 24h” as **Samyoj telemetry**, clearly labeled **not Meta’s remaining quota**.

**Sources:** [Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/) · [WABA Graph fields](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/) · [Upcoming messaging-limits changes](https://developers.facebook.com/documentation/business-messaging/whatsapp/upcoming-messaging-limits-changes/) · [Health status](https://developers.facebook.com/docs/whatsapp/cloud-api/health-status/)

---

## Official Business Account

### OBA (WhatsApp) vs Meta Verified vs Business Verification

| Program | What the user sees | Who grants it | Paid to Meta? |
|---------|--------------------|---------------|---------------|
| **WhatsApp Official Business Account (OBA)** | **Blue checkmark** beside the display name in **contacts / profile / chat header** (current Platform docs, updated 2026-05-21). India sales slang still says “green tick” — **do not promise a color we do not control.** | Meta review of **that phone number**. | Not a Samyoj SKU. Not sold by a BSP. |
| **Meta Verified for businesses** | Paid subscription badge / support / impersonation tools on **Instagram, Facebook, and WhatsApp** (separate Help article). | Meta subscription + eligibility. | Customer pays **Meta**, not Samyoj. |
| **Business Verification** (Meta Business Suite) | Legal entity verified. **Does not give a chat badge by itself.** Help Center: verifying the business is **different** from Meta Verified and **won’t give you a verified badge**. | Document review. | Process fee if any is Meta’s; still not a tick. |

Developer definition: OBA = a business phone **verified as authentic per Meta’s criteria**. **Blue** check in contacts view. Request via WhatsApp Manager **or** Graph (`official_business_account` field / `POST /{phone-number-id}/official_business_account`). Rejection → wait **30 days** to re-apply. **Not granted** to employees, **test accounts**, or **WhatsApp Business App** numbers.

Eligibility (developer + Help — both; Help also allows a volume path):

- Comply with [WhatsApp Business Messaging Policy](https://www.whatsapp.com/legal/business-policy).
- On Platform **≥ 30 days**.
- Portfolio **Business Verification** **or** (Help) high-quality history with **≥ 1,000 conversations over 30 consecutive days**.
- Phone **two-step verification** on; **display name approved**.
- Notable-business language still appears on some display-name Help pages (news presence). Treat **Meta review as opaque**. If the apply button is missing, Meta says contact Meta / Solution Provider / Support — **eligibility is not guaranteed**.

Discoverability note (dev docs): **without OBA**, the number may **not appear in in-app search** until the user saves the contact.

### Can a BSP / Tech Provider sell or guarantee the tick?

**No.** Meta reviews. Samyoj cannot guarantee approval, color, timeline, or that a rejected account will pass on retry. Selling “green tick package” as if we were Meta is a **ban-risk + fraud-risk** marketing claim.

**Honest service we can offer (software / concierge labor — Samyoj SaaS, not Meta):**

1. Checklist: 30-day age, display name guidelines, 2FA PIN, Business Verification docs, policy-clean messaging.
2. Document prep: what Business Verification typically asks (legal name, address, website) — **customer submits to Meta**.
3. Poll `official_business_account.oba_status` (`NOT_STARTED` and later states) and show it honestly.
4. Deep-link / instructions to WhatsApp Manager → Profile → Official business account → Submit request.
5. After denial: 30-day clock + profile fields they *can* edit (photo, email, website, description).

**NO-GO marketing claims:** “Buy verified WhatsApp from Samyoj,” “100% green tick,” “we issue the badge,” “pay us instead of Meta Verified,” “clone another brand’s tick.”

**Earning model honesty:** Charge for **onboarding time / SaaS feature** (checklist, status, docs vault). **Never** position the fee as purchasing Meta’s badge. Meta Verified, if the customer wants it, is a **Meta** checkout. OBA approval does not change Cloud API **per-message** rates.

**Sources:** [Official Business Accounts](https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts) · [Phone numbers / OBA](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers) · [Request OBA Help](https://www.facebook.com/business/help/604726921052590) · [Meta Verified for businesses](https://www.facebook.com/business/help/1980422732333373) · [Business Verification ≠ badge](https://www.facebook.com/business/help/2058515294227817)

---

## Template categories

### MARKETING / UTILITY / AUTHENTICATION

Templates are the **only** message type that can be sent **outside** the 24h customer service window. Category drives **Meta’s per-message price** (from 1 Jul 2025) **and** review outcome. Businesses accept the category on the **approved template at time of use**.

| Category | Intent (guidelines) | Typical Meta fee behavior (no INR invented) |
|----------|---------------------|-----------------------------------------------|
| **MARKETING** | Awareness, sales, retargeting, mixed promo+utility, unclear bodies (`{{1}}` / “Congratulations!”). Most flexible. **No volume discount.** | Charged on **delivery** except inside a **72h free entry point** window. |
| **UTILITY** | Non-promotional **and** user-specific (order/account) **or** essential/critical. Triggered by user action. Mixed promo → **MARKETING**. | Outside CSW: charged. Inside CSW: **free until 1 Oct 2026**, then charged. Volume tiers when charged. |
| **AUTHENTICATION** | OTP / identity only. Library templates + OTP button. **No URLs, media, emojis**; params ≤ 15 chars. **Only** this category may send OTPs. | Charged (plus authentication-international in some markets). Volume tiers. |

`allow_category_change` is **default true** (from **9 Apr 2025**): if you pick UTILITY and Meta says MARKETING, the template can be **APPROVED as MARKETING** (customer then pays marketing rates). Recurring recategorization after approval exists; abuse of utility-as-promo can lose the 24h notice (from **16 Apr 2025**).

Statuses: `PENDING` → `APPROVED` / `REJECTED` (`INCORRECT_CATEGORY`). Webhooks: `message_template_status_update`, `template_category_update`. Quality pause is separate (3h → 6h → Disabled).

### Approval and why cloning one WABA’s APPROVED template into every customer WABA is usually NOT instant-approved

1. **Create** `POST /{waba-id}/message_templates` is **per WABA**. Meta re-validates **category + content + that business**. Another tenant’s `APPROVED` row is not a certificate.
2. **Migrate Message Templates** (`POST /{destination-waba-id}/migrate_message_templates`) **recreates** templates; it does **not** move them. **Limitation: source and destination WABAs must be owned by the same Meta business.** Tech Provider customers typically each have **their own** portfolio — **cross-customer migrate is not the API.** Eligible only `APPROVED` + template `quality_score` `GREEN` or `UNKNOWN`. Failures include `"Incorrect category"`.
3. **Phone-number migration** duplicates eligible templates into the destination WABA and **runs category checks again**.
4. **Template Library** clones Meta’s **pre-written** utility/auth copy (`library_template_name`) into **this** WABA — faster categorization, still **created on that WABA**, still not “already approved because Samyoj’s demo WABA has it.”

Product implication (SAMYOJ-11 style): “clone from library” ≠ “stamp APPROVED onto 500 SMB WABAs.” Show **PENDING** until webhook `APPROVED`. Miscategorized marketing-as-utility is a **policy + billing** landmine.

**Sources:** [Template categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization) · [Template guidelines (pricing updates)](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/) · [Template migration](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-migration) · [Template Library](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library/) · [Pricing](https://developers.facebook.com/docs/whatsapp/pricing/)

---

## Click tracking

### URL buttons, dynamic suffixes, Meta click webhooks

**Standard Cloud API templates / interactive CTA URL:** tapping a **URL** button opens the **device browser**. That is **not** an inbound WhatsApp message. **Quick-reply** buttons **do** fire `messages` webhooks (`button` / `button_reply` payload). **URL taps do not** get a first-class “clicked” webhook on ordinary Cloud API sends.

**Dynamic suffix:** URL buttons support **one** variable **appended** to the approved base URL (`https://shop.example/o/{{1}}`). At send time you pass the suffix (order id, UTM). `url_suffix_example` is required at **template create** for review. This is **first-party analytics** on **the customer’s site** (or a Samyoj redirect **we** host) — not Meta Insights.

**Template field `cta_url_link_tracking_opted_out`:** Graph documents a per-template boolean to opt **out/in** of **CTA URL link tracking**. That is Meta wrapping/redirecting some CTA URLs for **their** measurement — **not** a documented firehose of click events into our Cloud API webhook for every SMB campaign.

**Marketing Messages API / Ads Manager click webhooks (limited):** Meta can send `user_actions` with `action_type: marketing_messages_link_click` (`click_component` `cta` | `body`, `click_id` also appended to the landing URL). Official limitations: **limited availability**; **MM API for WhatsApp and Ads Manager only**; clicks only for messages sent in the **last 7 days**. **Do not build the SMB campaign dashboard on this** unless the tenant is actually on MM API / ads and we have confirmed the app is in the gated set.

### Useful vs noise for SMB Indian SaaS

| Signal | Useful? | Why |
|--------|---------|-----|
| Delivery / read status webhooks | Yes | Cloud API already has these. |
| Quick-reply / list reply webhooks | Yes | In-chat intent. |
| UTM / order-id URL suffix + customer GA/Meta Pixel on **their** site | Yes | Matches how Indian SMBs already measure. |
| Native Meta click webhook for every template blast | Usually **noise / unavailable** | Not on standard Cloud API; gated MM API. |
| Claiming “WhatsApp click-through rate like Google Ads” from Graph | **No** | We would be inventing a metric. |

Privacy: extra click IDs on URLs are another identifier — keep DPDP/consent copy honest if we wrap links.

**Sources:** [Track click events (MM API)](https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/track-click-events) · [Interactive CTA URL messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-cta-url-messages/) · [Reply buttons (webhooks)](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages/) · [HSM `cta_url_link_tracking_opted_out`](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-hsm/) · [Template Library URL suffix](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library/)

---

## Click to WhatsApp

Four different products. Samyoj can **productize the plumbing**; we are **not Meta**.

| Surface | What it is | Samyoj productization (honest) |
|---------|------------|--------------------------------|
| **`wa.me` / click-to-chat** | Official WhatsApp universal link: `https://wa.me/{E164_NO_PLUS}?text=urlencoded`. Opens chat without saving the contact. Also `api.whatsapp.com`. Ice breakers **dismiss** if the link has pre-filled text. | Settings: copy link, QR, “Chat on WhatsApp” HTML snippet using **their** connected number. Label: **WhatsApp click-to-chat**, powered by WhatsApp, **inbox in Samyoj**. |
| **Website chat button** | Not the **Messenger** Customer Chat Plugin / Facebook JS SDK widget (that is **Messenger / Page**). A site button is just a styled link to `wa.me`. | Snippet generator. **Do not** embed the Messenger plugin and call it WhatsApp. **Do not** reuse **Embedded Signup** `FB.login` (that connects the **business** WABA) as a shopper widget. |
| **Facebook Page Call-to-Action** | Page button “WhatsApp” — user messages the business from Facebook. | Guide the customer in Meta Business Suite. If they reply within 24h from Android/iOS (not desktop/web), Meta may open a **72h free entry point (FEP)** — **Meta** fee waiver, not Samyoj. |
| **Ads that Click to WhatsApp** | Marketing API / Ads Manager: ads on FB/IG that open a WhatsApp thread. Inbound webhook `referral` includes **`ctwa_clid`**. Optional Automatic Events + Conversions API. | DEFER ads manager. If we later attribute: store `ctwa_clid`, do not sell “we run Meta ads for you” unless we actually do. FEP 72h applies when they reply in time. |

**FEP vs CSW (fees, not SaaS):** FEP = 72h **Meta** free delivery for **all** message types after a qualifying CTWA ad or Page CTA click **and** a business reply within 24h. CSW is **independent** — after 24h without a user message you still need **templates** even if FEP is open. India INR rates stay on Meta’s rate card; Samyoj does not pocket FEP.

**Brand honesty:** “Chat with us on WhatsApp” + Samyoj logo on the **inbox product**. Never “Official Meta widget,” never fake WhatsApp UI chrome that implies we are WhatsApp.

**Sources:** [Click to chat Help](https://faq.whatsapp.com/5913398998672934) · [Conversational components / wa.me](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/conversational-components/) · [Ads that Click to WhatsApp](https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp/) · [Conversions API / `ctwa_clid`](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging/) · [Pricing / FEP](https://developers.facebook.com/docs/whatsapp/pricing/) · [Automatic events](https://developers.facebook.com/docs/whatsapp/embedded-signup/automatic-events-api) · [Messenger plugins (not WhatsApp)](https://developers.facebook.com/docs/messenger-platform/discovery/facebook-chat-plugin/)

---

## GO / DEFER / NO-GO

### GO

- Surface phone **`quality_rating`** and template **`quality_score`** separately; subscribe `phone_number_quality_update` / `message_template_quality_update`.
- Show portfolio **`whatsapp_business_manager_messaging_limit`** as a **tier**; tell users remaining unique users live in **WhatsApp Manager**.
- OBA: checklist + `official_business_account` status + Manager instructions. Charge only for **software/labor**.
- Template create/library clone **per customer WABA**; wait for **APPROVED**; `allow_category_change` honesty (utility may land as marketing **fees**).
- Campaign URL buttons: **dynamic suffix / UTM** + first-party landing analytics.
- Website: generate **`wa.me`** links/snippets; ice breakers via Conversational Components API.
- Keep **Meta Cloud API fees** and **Samyoj SaaS** on two invoices / two sentences of copy.

### DEFER

- Fake or reverse-engineer **daily remaining** unique-user quota from our send logs.
- Marketing Messages API **click webhooks** until a tenant is in that limited program.
- Full **Ads Manager / CTWA campaign builder** inside Samyoj (keep `ctwa_clid` attribution as a later leaf).
- Meta Verified **subscription proxy** (customer buys from Meta).
- Cross-WABA **migrate_message_templates** for **different** Meta businesses (API forbids it).
- Promising Inbox replies stay **Meta-free** after **1 Oct 2026**.

### NO-GO

- “Buy green tick / we guarantee Official Business Account.”
- Dashboard **remaining messages today** invented as `250 − sends`.
- “Clone this APPROVED template to every customer — instant live.”
- Mixing **Meta ₹/message** into the **Samyoj plan** price (or inventing rates).
- Calling the **Messenger** Facebook SDK chat plugin “WhatsApp.”
- Marketing that Samyoj **is** Meta / WhatsApp / the badge issuer.
- Treating tester/dev WABA quality, limits, or OBA as the **customer’s** Live state.

---

## Self-check questions

1. If Settings shows GREEN, is that the **phone** `quality_rating` or a **template** `quality_score`?
2. Can we display “183 messages left today” from Graph alone? (If yes, which field? If no, what do we show instead?)
3. Who can grant the WhatsApp checkmark, and what color do **current** Platform docs specify?
4. Why does `POST .../migrate_message_templates` fail for Tenant B’s WABA when Tenant A’s template is APPROVED?
5. Does a URL-button tap create a Cloud API webhook on a normal template send?
6. Is the website Facebook chat plugin WhatsApp or Messenger?
7. When a CTWA ad starts a chat, which ledger (Meta vs Samyoj) owns the 72h FEP waiver?

---

## Official source URLs (bookmark)

- https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers
- https://developers.facebook.com/docs/whatsapp/messaging-limits/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/official-business-accounts
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-migration
- https://developers.facebook.com/documentation/business-messaging/whatsapp/marketing-messages/track-click-events
- https://developers.facebook.com/docs/whatsapp/pricing/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput
- https://developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp/
- https://www.facebook.com/business/help/896873687365001
- https://www.whatsapp.com/legal/business-policy
- https://faq.whatsapp.com/5913398998672934
