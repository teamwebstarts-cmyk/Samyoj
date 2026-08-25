# L6 — Policy, spam, quality bans & SaaS consent design

> Leaf for master guide merge. Hinglish explanations + English terms. Sources checked 2026-08-25 via official Meta / WhatsApp URLs + WebSearch. **Policies change** — always re-open the linked docs before shipping compliance UI.

---

## 1. Teen line (pehle yeh samajh lo)

WhatsApp Business Platform pe “ban” ek single switch nahi hai. Teen alag ladders hain:

| Ladder | Kya measure hota hai | Typical result |
|--------|----------------------|----------------|
| **Policy / spam enforcement** | Messaging Policy, Commerce Policy, ToS violations (spam, high-risk verticals, template misclass) | Warning → time-boxed send blocks → account lock → permanent disable |
| **Phone quality rating** | Blocks, reports, mutes, archives (last ~7 days, recency-weighted) | Green / Yellow / Red; sustained Low can freeze tier upgrades / downgrade messaging limits |
| **Template quality** | Per-template feedback + engagement | Active (High/Med/Low) → Paused (3h → 6h) → Disabled |

SaaS platform (Samyoj jaisa) Meta se “ban nahi hoga” guarantee nahi de sakta. Jo kar sakta hai: **consent fail-closed**, **opt-out honor**, **quality signals surface**, **campaign gates**, **error/webhook mapping**.

---

## 2. Official policy stack (bookmark karo)

### 2.1 Legal / product policy (WhatsApp.com)

| Doc | URL | Role |
|-----|-----|------|
| **WhatsApp Business Messaging Policy** | https://www.whatsapp.com/legal/business-policy | Opt-in, opt-out, quality experience, prohibited orgs/verticals, Platform-specific rules (templates, 24h CSW, escalation paths), commerce pointer, political/gov limits |
| Same (marketing mirror) | https://www.whatsapp.com/legal/business-policy / https://whatsappbusiness.com/policy/ | Same content family |
| **WhatsApp Messaging Guidelines** | https://www.whatsapp.com/legal/messaging-guidelines | Broader messaging / enforcement detection notes |
| **WhatsApp Business Terms of Service** | https://www.whatsapp.com/legal/business-terms | Legal wrapper: consents, honor opt-out, spam/block/report → Meta action |
| **WhatsApp Legal index** | https://www.whatsapp.com/legal/ | Hub for App vs Platform terms |

### 2.2 Commerce

| Doc | URL | Role |
|-----|-----|------|
| **Policy for WhatsApp Commerce Features** | Embedded in Business Messaging Policy (same page, commerce section) | Catalogs / sell experiences → must follow Meta Commerce Policy |
| **Meta Commerce Policies** | https://www.facebook.com/policies_center/commerce | Prohibited products across FB/IG/WA commerce surfaces |
| Catalog / sell guide (dev) | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/ | Catalog review, India compliance API note, product report path |

### 2.3 Developer enforcement + opt-in

| Doc | URL | Role |
|-----|-----|------|
| **Policy & spam enforcement** | https://developers.facebook.com/docs/whatsapp/overview/policy-enforcement/ | Escalating restrictions, appeals, `account_update` |
| Alt path (same topic) | https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement | Newer docs tree |
| **Getting opt-in** | https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/ | Nov 2024+ opt-in rules (general consent OK if law-compliant) |
| Alt path | https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in | Same |
| **Messaging limits** | https://developers.facebook.com/docs/whatsapp/messaging-limits/ | Unique-user caps outside CSW; portfolio-level field |
| **Quality rating (Help Center)** | https://www.facebook.com/business/help/896873687365001 | Green / Yellow / Red meaning |
| **Error codes** | https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/ | Ban/quality/template/spam codes |
| **Health Status API** | Linked from error `131031` docs | Extra insight when account locked |
| **Template quality** | https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality | Scores + monitoring |
| **Template pausing** | https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing/ | 3h / 6h / Disabled |
| **Template pacing** | https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing/ | Early feedback throttle |
| **account_update webhook** | https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/account_update | `ACCOUNT_VIOLATION`, `ACCOUNT_RESTRICTION`, `DISABLED_UPDATE`, … |
| Webhook field list | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/ | `phone_number_quality_update`, `message_template_status_update`, `user_preferences` |
| Per-user marketing limits | Linked from error `131049` → marketing template per-user limits docs | Ecosystem engagement throttle |
| FAQ / appeal (Help) | Policy enforcement pages + Business Support Home in Meta Business Suite | Request Review |

---

## 3. Messaging Policy — practical bullets (Hinglish)

Source of truth: [Business Messaging Policy](https://www.whatsapp.com/legal/business-policy).

### 3.1 Contact karne se pehle

- Person ne **mobile number diya ho**, aur
- Business ne **opt-in** liya ho — recipient confirm kare ke woh subsequent messages/calls chahta hai.
- Nov 2024 update (dev opt-in doc): opt-in **WhatsApp-specific hona zaroori nahi**, general communication consent chal sakta hai **agar local law follow ho**. Phir bhi best practice: channel + categories clear bolo.

Opt-in method business decide karta hai, lekin **must**:

1. Clearly state: person opting in to receive communication from the business.
2. Clearly state **business name**.
3. Comply with applicable law.

Best practices (policy page): category-wise opt-in (order updates vs offers), separate call opt-in, clear opt-out instructions, value explain karo. Pre-checked / buried consent = product risk (spam reports ↑).

### 3.2 Opt-out / block / stop

- On WhatsApp **ya off WhatsApp** — stop / opt-out / block request **respect** karo; contact list se hatao where appropriate.
- Confuse, deceive, spam, surprise mat karo.
- Users can **block**, mark **spam**, or **report** → Meta quality + enforcement feed.

### 3.3 Platform-specific

- Business-initiated outside CSW → **approved Message Template** only; templates only for designated purpose; Meta can pause/reject anytime.
- User message ke 24h ke andar free-form reply OK.
- Automation OK in CSW **but** human escalation paths available (in-chat agent, phone, email, web, store, form).

### 3.4 Prohibited / high-risk (summary — full list policy pe)

Terrorism/crime facilitation, illegal goods, many regulated verticals (firearms, alcohol/tobacco, drugs, gambling, adult, dating, MLM, payday loans, crypto/ICO-style, etc.) — with **limited country exceptions** for some Regulated Verticals on **Platform only** (not Business App), age/geo gating, licenses. Online gambling often needs Meta permission form.

**Political parties / politicians / campaigns** and several LE/military/intel uses **prohibited** on Platform; gov entities via Solution Provider with extra rules.

### 3.5 Data / sensitive

- Notices, privacy policy, lawful consents.
- Don’t share/ask full PAN/card/bank/sensitive IDs in chat.
- Health/telemedicine constraints where regs require heightened systems.
- Don’t forward one customer’s chat info to another customer.

---

## 4. Commerce Policy — short map

- Catalog / payments / sell UX → **Meta Commerce Policies** apply ([policies_center/commerce](https://www.facebook.com/policies_center/commerce)).
- Business owns transactions, taxes, fulfillment, sales/returns disclosures. WhatsApp is not the merchant of record.
- Catalog items auto-reviewed; violating SKUs flagged; users can report products; appeal in Commerce Manager.
- Messaging Policy: if you sell prohibited commerce goods via catalog features, Meta can cut WhatsApp Business Services access.

---

## 5. Spam & policy enforcement ladder

Official: [Policy enforcement](https://developers.facebook.com/docs/whatsapp/overview/policy-enforcement/).

Repeated violations (spam, template misclassification, high-risk categories: adult, alcohol/tobacco, drugs, gambling, unsafe supplements, etc.) → **increasing duration** restrictions:

1. **Warning** (policy called out).
2. **1 or 3 day** block: marketing / utility / authentication **template** sends + adding phone numbers.
3. **5, 7, or 30 day** block: **any** messages + adding phone numbers.
4. **Account lock**: indefinite no-send; **appeal only**.
5. **Permanent disable** if business ignores warnings / keeps violating.

**Ops:**

- Meta Business Suite → **Business Support Home** → Account Overview → restriction details / Request Review when available.
- Subscribe **`account_update`** webhook (`ACCOUNT_VIOLATION`, `ACCOUNT_RESTRICTION`, `DISABLED_UPDATE`, …).
- Fix root behavior **fast** — next rung worse hota hai.
- Read Commerce + Business policies; follow Messaging Policy quality best practices.

Time-boxed blocks often must be **waited out**; not every restriction is appealable.

---

## 6. Quality-based blocking (number + template)

### 6.1 Phone number quality

- Rolling ~**7-day**, recency-weighted feedback: blocks, reports, mutes, archives, block reasons.
- UI: WhatsApp Manager → Account tools → Phone numbers → **Green / Yellow / Red** ([Help](https://www.facebook.com/business/help/896873687365001)).
- API field historically `quality_rating` on phone number node; messaging capacity is increasingly **business portfolio** scoped — use `whatsapp_business_manager_messaging_limit` (old `messaging_limit_tier` deprecated per [messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/)).
- Sustained low quality → Meta can **rate-limit** sends/calls (Messaging Policy §7). Industry + older Help docs also describe **Flagged** windows (~7 days): no tier upgrade; if still Low, tier may **downgrade**. Re-verify current labels in WhatsApp Manager — Meta has evolved portfolio vs per-number wording.
- Webhook: **`phone_number_quality_update`** (subscribe on WABA).

**Recovery pattern (product practice, not a Meta SLA):** pause cold marketing, send only high-intent / service traffic, clean lists (no purchased dumps), fix opt-in copy, wait for 7-day window to heal before blasting again.

### 6.2 Messaging limits (capacity, not “ban”)

- Cap = unique WhatsApp users you can message **outside customer service window** in a moving **24h**.
- Scaling needs quality + verification / volume paths (see messaging-limits doc). Bad quality blocks growth even if volume is high.

### 6.3 Template quality + pause

- Per-template Active + quality pending/high/med/low.
- Hits **Low (`RED`)** → auto-pause: **1st 3h → 2nd 6h → 3rd Disabled** ([template pausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing/)).
- **Template pacing** may throttle new / non-green templates to gather early feedback.
- Halt campaigns on paused templates; API rejects sends (`132015` / `132016`). Edit + re-approve or create new content after disable.
- Webhook: **`message_template_status_update`**.

---

## 7. Common ban / restriction causes (field checklist)

| Cause | Why Meta cares | What SaaS should prevent |
|-------|----------------|--------------------------|
| Cold blast / purchased lists | High block+report → spam | Fail-closed consent; no “import = opted in” |
| Vague / missing opt-in | Policy + quality | Store business name disclosure + timestamp + source |
| Ignoring STOP / opt-out | Explicit policy breach | Instant suppress + audit |
| Marketing content in Utility template | Misclassification → enforcement | Category honesty; template review |
| High-risk verticals without gates | Commerce + Messaging bans | Vertical flags; block catalog SKUs |
| Same user hammered with templates | `131056` / engagement limits | Per-recipient throttle |
| Marketing after user preference stop | `131050` | Honor `user_preferences` webhook |
| Outside CSW free-form | `131047` | Template gate in composer |
| Template Low quality spam | Pause → disable → number pain | Preview + sample send + pacing |
| Impersonation / fake profile | Policy §1 | Display name review monitoring |
| Political / prohibited org use | Hard prohibition | Onboarding KYC / vertical questionnaire |

---

## 8. Developer error codes (ban / quality / spam cluster)

Canonical table: [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/).

| Code | Meaning (short) | SaaS reaction |
|------|-----------------|---------------|
| **368** | WABA restricted/disabled — policy | Stop outbound org-wide; surface Support Home / appeal; log `account_update` |
| **131031** | Restricted/disabled **or** verification mismatch (e.g. 2FA pin) | Same + Health Status API |
| **130497** | Country messaging restricted for category | Geo/category gate |
| **131048** | Spam/block-driven send restrictions on number | Check quality; pause marketing |
| **131064** | Messaging limit hit due to **template classification** violations | Fix categories; wait enforcement period |
| **130429** | Cloud API **throughput** | Backoff (infra, not policy ban) |
| **131056** | Too many msgs to **same** recipient quickly | Per-peer rate limit |
| **131047** | Outside 24h CSW free-form | Switch to template |
| **131049** | Not delivered — healthy ecosystem engagement / per-user marketing limits | Don’t tight-loop retry; wait ≥24h; read per-user marketing limits |
| **131050** | User stopped **marketing** from this business | Permanent suppress marketing; `user_preferences` |
| **132007** | Template content policy violation | Fix template; don’t resubmit clones blindly |
| **132015** | Template **paused** low quality | Pause campaigns; edit/wait |
| **132016** | Template **disabled** after repeated pauses | New template content |
| **131026** | Undeliverable (not WA / ToS / old client) | Number hygiene; not a ban |

Map these into Samyoj campaign `classifyProviderError` / admin health — don’t retry-spam policy codes.

---

## 9. Webhooks SaaS must subscribe (compliance ops)

| Field | Why |
|-------|-----|
| `account_update` | Violations, restrictions, disable, partner events |
| `phone_number_quality_update` | Quality / throughput changes |
| `message_template_status_update` | Approved / paused / disabled |
| `user_preferences` | Marketing stop/resume (`131050` companion) |
| `account_review_update` | Policy review outcomes |
| `messages` (+ statuses) | Delivery + user STOP keywords if you parse inbound |

UI: show tenant “WhatsApp health” from these — don’t bury only in server logs.

---

## 10. How SaaS platforms should design consent / opt-out

Meta does **not** host your CRM consent ledger. Platform (Samyoj) owns proof + enforcement. Align with Messaging Policy + [Getting opt-in](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/) + local law (India DPDP / TRAI-style expectations where relevant — product counsel, not Meta).

### 10.1 Consent model (fail-closed)

Recommended fields (Samyoj already leans this way for campaigns):

| Field | Purpose |
|-------|---------|
| `optedIn` | Boolean gate |
| `consentSource` | EXPLICIT / IMPORT / MANUAL / … — **IMPORT alone must not unlock marketing** |
| `consentAt` | When permission captured |
| `consentVersion` | Form/copy version |
| `consentDecision` | Structured OPT_IN method (checkbox, keyword, …) |
| `optOutAt` | Non-null ⇒ never market |
| Optional: category scopes | marketing vs utility vs auth |

**Campaign send rule (fail-closed):** require `optedIn` + auditable `consentSource` + `consentAt` + `optOutAt == null`. No silent defaults.

### 10.2 Opt-in UX

- Unchecked checkbox + business **legal name** + channel (“WhatsApp”) + message types.
- Separate call consent if using Calling API.
- Capture IP/user-agent / form id when web opt-in (audit).
- QR / keyword “JOIN” OK if text is clear.
- Never pre-tick; never “by creating account you agree to WhatsApp spam”.

### 10.3 Opt-out UX (must be easy)

- Inbound keywords: STOP / UNSUBSCRIBE / रुकवाओ — set `optOutAt`, `optedIn=false`, suppress immediately.
- Settings / contact profile one-click opt-out.
- Honor Meta marketing preference stops (`131050` / `user_preferences`) even if CRM still says opted-in.
- Off-channel requests (email/call “don’t WhatsApp me”) → same suppress.
- Double opt-out: category-level (stop offers, keep order OTPs) when product supports it — policy encourages category clarity.

### 10.4 Product safeguards that protect tenants’ WABAs

1. **Dry-run / sample** before campaign.
2. **Warm-up** + respect messaging limits; don’t “blast to tier ceiling” day 1.
3. **Template category** warnings; block Utility-as-Marketing patterns in composer tips.
4. On quality Yellow/Red or `131048`: **auto-pause** scheduled marketing for that number.
5. On `368` / `131031`: hard kill switch + tenant banner + link to Business Support Home.
6. Per-number workspace isolation (Samyoj `whatsappNumberId`) so one bad list doesn’t confuse another number’s ledger.
7. Don’t share one customer’s chat data across contacts (policy).
8. Educate: Meta Cloud API fees ≠ Samyoj SaaS plan; bans are Meta-side.

### 10.5 What SaaS cannot do

- Appeal Meta bans for the customer without their Business Manager access.
- Guarantee delivery if user blocked the business.
- Override paused/disabled templates.
- Mix prohibited verticals “because tenant asked.”

---

## 11. Appeal / recovery playbook (tenant-facing copy)

1. WhatsApp Manager / Business Support Home → see exact policy + restriction duration.
2. If appeal allowed → Request Review; wait Meta decision (often ~1–2 days; not guaranteed).
3. Stop offending traffic **before** appealing (continuing spam while appealing worsens lock risk).
4. Fix templates, lists, opt-in forms; document changes.
5. Subscribe webhooks so next warning isn’t a surprise.
6. Time-boxed blocks: wait clock; don’t spin up shadow numbers to evade (ToS / multi-number add may already be blocked during restriction).

---

## 12. Samyoj touchpoints (for master guide § surface)

- Campaign consent: `optedIn` + `consentSource` + `consentAt` + no `optOutAt` (see campaign validation / safety tests).
- Contacts module consent helpers (`contactConsentData`, sources like `MANUAL`, `MANUAL_BULK`).
- Do **not** claim customer production “ban-proof”; test-deploy ≠ Meta enforcement immunity.
- Future: surface `account_update` / quality webhooks in tenant Settings health (if not already).

---

## 13. Quiz / self-check

**Q1.** Business-initiated message outside the 24h customer service window requires what?  
**A:** An **approved Message Template** (free-form → typically `131047`).

**Q2.** Opt-in ke liye minimum policy points kya hain?  
**A:** Clear that they’re opting in to communications; clear **business name**; comply with **applicable law**.

**Q3.** Spam enforcement ladder ka pehla multi-day template block kitne din ka hota hai (official doc)?  
**A:** **1 or 3 day** block on marketing/utility/authentication templates (+ adding numbers).

**Q4.** Template Low quality pe pehli pause kitni der? Teesri baar?  
**A:** **3 hours**; third instance → **Disabled**.

**Q5.** User ne marketing band kar diya — kaunsa error / webhook?  
**A:** Send error **`131050`**; webhook field **`user_preferences`**.

**Q6.** WABA policy restrict/disable pe common Graph codes?  
**A:** **`368`**, **`131031`** (also check Health Status API).

**Q7.** Commerce catalog sell pe kaunsi Meta policy apply hoti hai?  
**A:** **Meta Commerce Policies** (+ WhatsApp Commerce Features section in Business Messaging Policy).

**Q8.** SaaS campaign fail-closed consent me kya-kya chahiye?  
**A:** `optedIn` + auditable `consentSource` + `consentAt` + `optOutAt` null (IMPORT-only typically insufficient).

**Q9.** Quality rating mainly kis feedback se banti hai?  
**A:** Recent (~7 day) user signals: **blocks, reports, mutes/archives**, etc.

**Q10.** Political party kya WhatsApp Business Platform pe message kar sakti hai?  
**A:** **No** — Messaging Policy prohibits political parties/politicians/campaigns (gov entities have separate Solution Provider rules).

---

## 14. Source checklist (copy into master guide bibliography)

1. https://www.whatsapp.com/legal/business-policy  
2. https://www.whatsapp.com/legal/messaging-guidelines  
3. https://www.whatsapp.com/legal/business-terms  
4. https://www.whatsapp.com/legal/  
5. https://www.facebook.com/policies_center/commerce  
6. https://developers.facebook.com/docs/whatsapp/overview/policy-enforcement/  
7. https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement  
8. https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/  
9. https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in  
10. https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/  
11. https://developers.facebook.com/docs/whatsapp/messaging-limits/  
12. https://www.facebook.com/business/help/896873687365001  
13. https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing/  
14. https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing/  
15. https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality  
16. https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/account_update  
17. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/  
18. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/sell-products-and-services/  
19. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/ (message quality section)  
20. https://whatsappbusiness.com/policy/ (mirror entry point)

---

## 15. Open diligence (merge-time)

- Confirm whether Meta still shows **Flagged/Restricted** phone statuses vs portfolio-only messaging limit language in live WhatsApp Manager (docs evolved 2025–2026).
- Confirm Samyoj currently persists/subscribes `account_update` / `user_preferences` / quality webhooks end-to-end (code map = L14).
- Legal: India-specific consent language for Samyoj tenant TOS — out of scope for this leaf beyond Meta requirements.
