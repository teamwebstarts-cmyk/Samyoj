# L3 — Templates, categories, quality, CSW

> Leaf for Meta Business learning sprint (2026-08-25).  
> Audience: Sonu / PM — Hinglish + English. Official Meta docs only (2025–2026).  
> Scope: UTILITY / MARKETING / AUTHENTICATION, approval, quality, pacing, 24h CSW, outside-window templates, Template Library clone.  
> Not in scope: exact INR rate cards (→ L4 pricing), full ban policy encyclopedia (→ L6), Samyoj code map (→ L14).

---

## 30-second Hinglish summary

**Template** = Meta-approved message skeleton (name + language + category + components).  
**CSW (Customer Service Window)** = user message/call ke baad **24 hours** — us window mein free-form text/media/interactive bhej sakte ho.  
**Window band** → sirf **approved template** se pehle message.  
**Category galat** (utility dikhao, marketing content) → auto-recategorize, rate-limit, even WABA restriction.  
**Quality Low (RED)** → pause → baar-baar → **disabled**. Campaigns / Inbox “template send” break.  
**Pacing** = naya/low-quality template pehle thode users ko; feedback kharab → hold/drop.  
**Library clone** = Meta ka curated `message_template_library` se UTILITY/AUTH copy → WABA pe create (Samyoj: SAMYOJ-11 / `/from-library`).

---

## 1. Key facts

### 1.1 Three template categories (pricing + policy)

| Category | Intent (short) | Typical use | Hard rules |
|----------|----------------|-------------|------------|
| **MARKETING** | Awareness, sales, retargeting, app promo, relationship nudges | Offers, cart abandon, renewals, “happy birthday + promo” | Most flexible; mixed utility+promo = **marketing** |
| **UTILITY** | Non-promotional follow-up to a **user action** / account / order OR essential/critical safety | Order confirm, shipment, refund, balance alert, opt-in confirm | Must be non-promotional **and** user-specific/requested **or** essential |
| **AUTHENTICATION** | Identity verify via OTP | Login, account recovery | **Only** AUTH templates may send OTPs; no URLs/media/emojis in content/params; params ≤ 15 chars; prefer Template Library + OTP button (copy-code / one-tap / zero-tap) |

**Miscategorization traps (Meta examples):**
- Order update **with promo / survey that upsells** → MARKETING  
- Unclear body (`{{1}}` only, “Congratulations!”) → often MARKETING  
- Cart abandon / subscription renew / “you left items” → MARKETING even if “user requested”  
- OTP in a UTILITY/MARKETING template → wrong; AUTH only  

**2025 category enforcement (important dates):**
- **Apr 9, 2025:** Creating as `UTILITY` but Meta says marketing → approved as **MARKETING** (not rejected). `allow_category_change` is effectively **default**.
- **Apr 16, 2025:** After a **utility-abuse warning**, UTILITY→MARKETING changes can be **instant** (no 24h notice).
- Recurring process can still flip approved UTILITY → MARKETING (normally ~1-day notice unless warned).
- MARKETING/UTILITY that should be AUTH → status eventually **REJECTED** (category not quietly fixed).

Sources: [Template categorization](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/), [Template fundamentals](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/).

### 1.2 Approval & template status lifecycle

Templates are **WABA assets**. Create via WhatsApp Manager or Graph `POST /{waba-id}/message_templates`. Review often minutes–hours; docs say review can take **up to ~24 hours**.

| Status (Manager / conceptual) | Meaning | Can send? |
|------------------------------|---------|-----------|
| In-Review / `PENDING` | Category OK; content under review | No |
| Active – Quality pending | Approved; no feedback yet (`quality_score` ≈ `UNKNOWN`) | Yes |
| Active – High / Medium / Low | Approved + quality band | Yes (Low = danger zone) |
| Rejected | Failed review / wrong category | No — edit + resubmit or appeal |
| Paused | Quality / pacing pause | No |
| Disabled | Too many low-quality pauses | No — create new template |
| Archived | Inactive ~12+ months; deleted after ~28 days unless unarchived | No |

Webhook to watch: **`message_template_status_update`** (`APPROVED`, `REJECTED`, `PAUSED`, `DISABLED`, `FLAGGED`, …).  
Category changes: **`template_category_update`**.

Source: [Template fundamentals](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/), [Monitor quality signals](https://developers.facebook.com/docs/whatsapp/guides/how-to-monitor-quality-signals/).

### 1.3 Quality rating (template-level)

API `quality_score`:

| Score | Manager label | Meaning |
|-------|---------------|---------|
| `GREEN` | High quality | Little/no negative feedback |
| `YELLOW` | Medium | Negative feedback and/or low read-rates; may pause soon |
| `RED` | Low | Same, worse — pause/disable risk |
| `UNKNOWN` | Quality pending | New / not enough signal yet |

Signals (opaque formula): blocks, reports, mutes/archives, engagement/read rates, weighted by recency.  
**Phone-number quality** is related but separate (messaging tier / ban path — see L6). Sustained bad templates can eventually hurt the **number**.

Source: [Template quality rating](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality).

### 1.4 Template pausing

When a template hits **Low / RED**:

1. **1st pause:** ~**3 hours**  
2. **2nd pause:** ~**6 hours**  
3. **3rd:** **Disabled** permanently for that template  

Paused → API rejects sends (error e.g. **132015**); attempt usually **not charged** and **doesn’t consume messaging limit**, but campaigns must stop.  
After pause duration, status can return Active; quality resets from recent feedback.  
**Pacing-related pause** may need **manual unpause** (Manager or `POST /{template_id}/unpause`).

Source: [Template pausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing/), [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/).

### 1.5 Template pacing vs portfolio pacing

**Template pacing** (marketing + utility; AUTH generally not the focus here):
- Applies to: newly created, recently unpaused, or not-yet-`GREEN` templates; history of low quality / pauses increases chance.
- Utility pacing often activates **after any utility was paused**, then ~**7 days** of heightened pacing risk for new/unpaused/non-GREEN utility.
- Behavior: send normally until an internal threshold → later sends **held** for feedback → good signal = release/scale; bad = drop held + opportunity to fix content/targeting.
- Send response may include `message_status` / pacing-related held status (e.g. `held_for_quality_assessment` in portfolio pacing docs).

**Business portfolio pacing** (different):
- Batches large template blasts for portfolios with &lt; ~500K template sends / 365d lookback, or under suspicion monitoring.
- Bad signals → drop held messages (status failed, code **135000**), temporary create/send freeze, possible disable + appeal.

Sources: [Template pacing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing/), [Business portfolio pacing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/portfolio-pacing/).

### 1.6 Messaging limits (outside CSW)

Messaging limit = max **unique user numbers** you can deliver to **outside** open CSWs in a **rolling 24h**.  
Scaling (e.g. toward 2K+) needs business verification / partner verify / volume of high-quality template deliveries, then Meta quality analysis. Further tiers need high quality + utilizing ≥ half of current limit over ~7 days.

Source: [Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits).

Also: **per-user marketing template limits** (how many marketing templates a given user may receive from businesses) — product should not blast the same user endlessly.

### 1.7 Customer service window (CSW) — 24 hours

- Opens when the **WhatsApp user messages you or calls you**.  
- Each new inbound message/call **resets** the 24h timer.  
- While open: send **service messages** (free-form text, media, interactive, etc.) — **no pre-approval**. Non-template service messages are **free** (Meta pricing model as of current Cloud API docs).  
- When closed: **only** pre-approved **template** messages.

Source: [Service messages / CSW](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/), also [conversation-types style CSW docs](https://developers.facebook.com/docs/whatsapp/conversation-types/).

### 1.8 Templates outside the window (and free utility inside)

- **Outside CSW:** templates are the **only** way to message the user (marketing / utility / auth).  
- **Per-message pricing (effective Jul 1, 2025):** charge on **delivered** template messages; rates by **category + country**; utility & auth volume tiers; marketing per-message (not old “conversation” model).  
- **Utility template delivered inside an open CSW:** **free** (`pricing.type` ≈ `free_customer_service`, `category` utility in status webhooks).  
- Non-template messages: free, but **only** inside CSW.

Source: [Pricing](https://developers.facebook.com/docs/whatsapp/pricing/).

### 1.9 Free entry point (FEP) — 72 hours (not the same as CSW)

Trigger: user messages via **Click-to-WhatsApp Ad** or **Page CTA** on Android/iOS app (desktop/web not supported), **and** you reply within **24h**.

- Opens normal **24h CSW**.  
- Your timely reply also opens **FEP ~72h** from reply time.  
- While FEP open: **all messages including templates are free**.  
- **CSW still independent:** if CSW closes mid-FEP, you can still send **templates** (free under FEP), but **not** free-form service messages until user writes again.

Source: [Pricing — Free entry point windows](https://developers.facebook.com/docs/whatsapp/pricing/).

### 1.10 Template Library & “clone” concept

Meta ships a curated library browsable via:

```http
GET /message_template_library
```

Filters: `search`, `topic`, `usecase`, `industry`, `language`, `name`.

**Clone into your WABA:**

```http
POST /{WABA_ID}/message_templates
```

with `library_template_name`, category (docs emphasize **UTILITY** for many library clones; AUTH also via library), language, optional `library_template_button_inputs` / body inputs (URL `base_url` + `url_suffix_example`, phone, OTP add-ons, etc.).

Benefits: faster approval path for standard order/OTP/shipment patterns; AUTH should use library patterns (security disclaimer / expiry optional add-ons).

**Samyoj product note (not Meta):** UI/API already maps library browse + `POST /from-library`; Graph clone hardening / live WABA verify tracked as **SAMYOJ-11**. Do not invent a parallel “Samyoj marketing library” — use Meta’s + product starters.

Sources: [Template Library](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library/), [AUTH templates](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/auth-otp-template-messages/).

### 1.11 AUTH extras (2026)

- Prefer one-tap autofill / copy-code; zero-tap exists with constraints.  
- **Effective Jun 15, 2026:** Keyboard suggestions / native OTP autofill on **iOS 26+** from push notification (default on for AUTH templates; no integration for that iOS path).  
- Upsert / previews APIs exist for multi-language AUTH with security + expiry strings.

---

## 2. Why it matters for a WhatsApp SaaS like Samyoj

| Product area | Implication |
|--------------|-------------|
| **Inbox** | Free-form reply only while CSW open; after 24h silence → force template picker / block free text |
| **Campaigns** | Always templates; pacing/portfolio hold can make “accepted” API responses not mean delivered; pause → campaign must halt |
| **Billing UI** | Never fold Meta template fees into Samyoj SaaS plan (two ledgers). Utility-in-CSW free ≠ “all utility free” |
| **Template builder** | Category picker is a **compliance** control; miscategorize → customer WABA rate-limit / utility freeze |
| **Library clone** | Fast path for order/OTP; validate button URL suffix examples; AUTH only via AUTH templates |
| **Webhooks** | Surface `message_template_status_update`, quality, category updates in Settings/Templates so orgs see pause before support tickets |
| **Quality coaching** | Low quality → pause → disable: product should warn on YELLOW/RED and on high block rates |

---

## 3. Ban / quality risks (templates + CSW adjacent)

**High risk behaviors**
1. Labeling **marketing** content as **UTILITY** to chase free/cheaper utility rates → warning → rate limit → all utility forced to MARKETING → portfolio-level restriction.  
2. Sending OTP via non-AUTH templates.  
3. Blasting cold users with marketing templates → blocks/reports → template RED → pause → number quality drop → messaging limit freeze / disable.  
4. Ignoring paused templates in automations (error spam; bad UX; may look like “Samyoj broken”).  
5. Large first campaigns on new portfolios → **portfolio pacing** holds/drops (135000).  
6. Editing a healthy template into spammy copy → re-review + pacing again.  
7. Assuming FEP = unlimited free-form for 72h (false once CSW closes).

**Escalation ladder for utility miscategorization (Meta)**  
Warning → utility volume rate-limit (min ~7 days) → utility restriction (7 / 30 days) → **business portfolio** restriction (~30 days). Webhook: `account_update` + `UTILITY_TEMPLATE_ABUSE*`.

**Error codes to remember**
- **132015** — template paused (low quality)  
- **132016** — template disabled after too many pauses  
- **131064** — messaging limit / classification restriction (check Manager)  
- **135000** — portfolio pacing dropped held messages  

---

## 4. Official URLs (bookmark set)

| Topic | URL |
|-------|-----|
| Template fundamentals (create/status/limits overview) | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/ |
| Same (guidelines path) | https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/ |
| Newer BM overview | https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview |
| Category guidelines + 2025 enforcement | https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/ |
| Template quality rating | https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality |
| Template pausing | https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing/ |
| Template pacing | https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing/ |
| Business portfolio pacing | https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/portfolio-pacing/ |
| Messaging limits | https://developers.facebook.com/docs/whatsapp/messaging-limits |
| Service messages + CSW | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/ |
| Pricing (per-message Jul 2025, CSW free utility, FEP 72h) | https://developers.facebook.com/docs/whatsapp/pricing/ |
| Template Library | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library/ |
| AUTH / OTP templates | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/auth-otp-template-messages/ |
| Status / quality webhooks | https://developers.facebook.com/docs/whatsapp/guides/how-to-monitor-quality-signals/ |
| Cloud API error codes | https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/ |
| Platform changelog | https://developers.facebook.com/docs/whatsapp/business-platform/changelog/ |

---

## 5. Hinglish study cards (din 1–2)

1. **CSW = 24h conversation room.** User likhe → room open → free-form OK. Room band → sirf template.  
2. **Template = Meta ke paas registered format.** Category = bill + policy. Galat category = sasta nahi, **saza**.  
3. **Utility free kab?** Jab CSW open ho **aur** delivered template category utility ho. Outside window utility = paid (per-message).  
4. **Marketing = sabse mehnga / sabse risky** blocks ke liye — cold blast mat maar.  
5. **AUTH = OTP only lane.** Library se lo; URL/emoji mat daalo.  
6. **Quality GREEN rakho** — warna pause 3h → 6h → disabled.  
7. **Pacing** = Meta pehle sample leke feedback leta hai; “API 200” ≠ “sabko deliver ho gaya”.  
8. **FEP 72h** ads/CTA se — free templates, lekin free-form ab bhi CSW pe depend.  
9. **Clone** = Meta library se WABA pe copy; Samyoj wizard isi pe hai.  
10. **Do ledgers:** Meta Cloud fees ≠ Samyoj SaaS plan.

---

## 6. Quiz / self-check

Answer without scrolling; then check **Answers** below.

**Q1.** User ne 30 hours pehle message kiya, ab free-form text bhejna hai. Allowed?  
**Q2.** Order confirm + “10% off next order” — recommended category?  
**Q3.** OTP “123456 is your code” as UTILITY — OK?  
**Q4.** Template quality `RED` pe pehli baar kya hota hai roughly?  
**Q5.** Utility template **andar** open CSW deliver hua — Meta fee?  
**Q6.** CSW vs FEP — ek line difference?  
**Q7.** `allow_category_change` / Apr 2025 ke baad UTILITY create pe Meta marketing maane to typical outcome?  
**Q8.** Template pacing hold pe product team ko kya assume nahi karna chahiye?  
**Q9.** Utility miscategorization ladder ka pehla permanent-ish “all utility → marketing” step kya hai?  
**Q10.** Template Library clone ka primary Graph browse endpoint?

### Answers

1. **No** — CSW closed (~24h); use an approved **template**.  
2. **MARKETING** (mixed / promo).  
3. **No** — must be **AUTHENTICATION** (ideally from Template Library).  
4. Auto **pause ~3 hours** (then 6h, then disable).  
5. **Free** (utility in open CSW).  
6. **CSW** = 24h free-form eligibility from user msg/call; **FEP** = 72h **free billing** window after CTWA/Page CTA + timely reply — CSW still gates free-form.  
7. Template **approved as MARKETING** (not rejected).  
8. That “sent/accepted” means all recipients got the message — some may be **held/dropped**.  
9. **Utility restriction** (approved utilities recategorized to MARKETING; new utility create/reviews disabled for 7 or 30 days). Warning/rate-limit come first.  
10. **`GET /message_template_library`**.

---

## 7. Open questions / verify live (do not invent)

- Exact messaging-limit tier table numbers change; always open [Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits) for current caps.  
- Country-specific utility/auth/marketing rates → L4 + [Pricing](https://developers.facebook.com/docs/whatsapp/pricing/) rate cards.  
- Samyoj live WABA e2e for library clone URL buttons → SAMYOJ-11.  
- Whether a given send shows `held_for_quality_assessment` depends on live pacing state — check send response + status webhooks.

---

## 8. Leaf checklist (for master guide merge)

- [x] Categories UTILITY / MARKETING / AUTHENTICATION + 2025 auto-category rules  
- [x] Approval / status / webhooks  
- [x] Quality GREEN/YELLOW/RED/UNKNOWN + pause ladder  
- [x] Template pacing + portfolio pacing  
- [x] Messaging limits (outside CSW)  
- [x] CSW 24h + templates outside window + free utility in CSW  
- [x] FEP 72h contrast  
- [x] Template Library clone concepts  
- [x] Ban/quality risks + error codes  
- [x] Official URLs  
- [x] Hinglish cards + quiz  

*End L3 notes.*
