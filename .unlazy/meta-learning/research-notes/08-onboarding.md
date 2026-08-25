# L8 — WABA + Business Portfolio onboarding (fast path)

**Leaf:** L8 (`PLAN.md`)  
**Audience:** Sonu explaining Connect to a first-time Indian SMB  
**Partner model assumed:** Samyoj as **Tech Provider** (customer owns WABA + Meta payment method; Samyoj SaaS is separate)  
**Researched:** 2026-08-25 via WebSearch + Meta developer / Help Center docs  
**Not in scope:** Solution Partner credit-line share, Coexistence deep dive (flag only), App Review for *our* Meta app

---

## 0. Verdict (one paragraph)

Fastest legitimate path for a first-time Indian SMB: **one session of Embedded Signup** from Samyoj → customer Facebook/Meta login → create or pick **Business Portfolio** → create or pick **WABA** → enter **business phone** + **display name** → **SMS/voice OTP** → grant app access. Samyoj’s server then exchanges the code, registers the number for Cloud API, and subscribes the WABA to webhooks. Customer still must do FB login, business details, OTP, and (as Tech Provider) add a **Meta payment method** before template sends work. Happy path wall-clock: **15–45 minutes** if the phone is free of consumer WhatsApp and OTP arrives. Business Verification (GST / Udyam docs) is **not** required to start at low messaging limits; it unlocks higher tiers / more numbers and can take **hours to several days**.

---

## 1. Asset hierarchy (what the customer is creating)

```text
Facebook / Meta personal login (admin)
  └── Business Portfolio (aka Meta Business Account / BM)
        └── WhatsApp Business Account (WABA)
              └── Business phone number(s)  ← Cloud API ID ≠ E.164 string
```

| Asset | Who creates it in fast path | Customer owns? |
| --- | --- | --- |
| Business Portfolio | Customer in Embedded Signup (or reuse existing) | Yes |
| WABA | Customer in Embedded Signup (or reuse existing) | Yes |
| Phone number + display name | Customer enters + verifies OTP | Yes |
| App access token (BISU) | Samyoj server after code exchange | Held by Samyoj for that org/number |
| Webhook subscription | Samyoj server | Samyoj app ↔ customer WABA |

**Hard Meta rules (product implications):**

- Each client gets **their own WABA** — never one shared Samyoj WABA for all tenants.
- New portfolios start at **messaging limit 250** unique users / 24h (portfolio-level, shared across numbers).
- New portfolios capped at **2 registered phones** until verified or messaging limit reaches 2,000 (then up to 20).
- WABA timezone/currency freeze once a payment method / credit line is attached — pick **India + INR** carefully on first attach (India INR migration deadline **31 Dec 2026** for eligible WABAs).
- WABAs created only via the **developer app** (self-serve test) **cannot** be selected later in Embedded Signup.

---

## 2. Fastest legitimate customer journey (checklist order)

### Before the call (prep — saves most failures)

Customer should have ready:

1. **Facebook account** that will admin the business (not a brand-new throwaway if possible — Meta blocks “account too new” for portfolio creation for ~1 hour+).
2. **Dedicated phone number** (India mobile or OTP-capable landline / cloud telephony):
   - Must receive **SMS or voice OTP**.
   - Must **not** be active on **consumer WhatsApp** (delete/logout that account first), unless using **Coexistence** (WhatsApp Business *app* + Cloud API — Samyoj must enable that flow; default Connect is Cloud-API-only).
   - Prefer **not** a personal daily number; changing display name / number later is painful.
3. **Legal / trade name**, address, website or IG/FB page URL, short description, category.
4. **Display name** that matches external branding (see display-name guidelines) — not “Test”, not generic “Shop”.
5. Optional but recommended for scale: **GST / Udyam / CIN / Shop Act** PDFs for Business Verification later.
6. **Visa/Mastercard** debit/credit for Meta WABA billing (not prepaid / not Amex per Help Center; bank 3DS ready).

### During Connect (Embedded Signup — customer screen sequence)

Typical Meta screens (abandon codes in parentheses):

1. **Permissions** (`PERMISSIONS`) — accept Cloud API / WhatsApp / Meta terms; grant Samyoj app access.
2. **Business portfolio** (`BUSINESS_ACCOUNT_SELECTION`) — create new or select existing.
3. **WABA** (`WABA_PHONE_PROFILE_PICKER` / `WHATSAPP_BUSINESS_PROFILE_SETUP`) — create or select.
4. **Phone + display name** (`PHONE_NUMBER_SETUP`).
5. **OTP** (`PHONE_NUMBER_VERIFICATION`) — SMS or voice.
6. Finish → Meta returns `waba_id`, `phone_number_id`, (often) `business_id` via `postMessage`, plus OAuth `code` via `FB.login`.

### Immediately after (Samyoj / Tech Provider — not customer UI)

Official post-flow server steps (Meta Embedded Signup overview):

1. Exchange authorization **code** → customer-scoped business token.
2. **Register** phone for Cloud API (`POST /{phone-number-id}/register` with 6-digit PIN) — **within 14 days** or customer must redo Embedded Signup.
3. **Subscribe** app to WABA webhooks (`subscribed_apps`).
4. Persist connection scoped by org + number (Samyoj: `saveWhatsappConnection` / Connect callback).
5. Tell customer to add **payment method** on the WABA (Tech Provider — Meta bills them).

Solution Partners also share a credit line; **Samyoj Tech Provider path does not** — skip that step.

### After Connect (customer still owns)

| Step | Required to… | Typical time |
| --- | --- | --- |
| Add Meta payment method on WABA | Send **templates** / paid message types | 5–15 min (bank 3DS can stall) |
| Submit utility/auth/marketing templates | Outbound outside 24h CSW | Minutes–24h+ approval |
| Business Verification (docs) | Higher messaging limits, more phone slots, Official Business Account path | Hours–several business days |
| Display name review | Name shows consistently / OBA eligibility | Tied to quality / limit eligibility |

Customer can often **start** (low tier, inbound + limited outbound) **without** full Business Verification.

---

## 3. What Samyoj can automate vs what customer must do

### Samyoj can / should automate (platform)

| Action | Notes |
| --- | --- |
| Host **Connect WhatsApp** button + Allowed Domains / OAuth redirect | Platform `META_APP_ID` / secret only — never show App Secret in UI |
| Launch Embedded Signup (`config_id` / Login for Business v4) | Migrate off ES v2 before **15 Oct 2026** |
| Receive `code` + `WA_EMBEDDED_SIGNUP` session info | Handle race: `postMessage` vs `FB.login` |
| Token exchange, encrypt & store token | Never show token to customer |
| Register phone + subscribe WABA webhooks | Fail loudly if webhook not healthy |
| Number isolation workspace (`whatsappNumberId`) | Soft disconnect; no delete history |
| Product-gate plan slots (1/2/5 numbers) | Independent of Meta’s 2→20 portfolio cap |
| Deep-link help to Meta payment / verification pages | Do not collect card numbers for Meta |

### Customer must do themselves (cannot skip)

| Action | Why |
| --- | --- |
| Facebook / Meta login | Identity + admin of portfolio |
| Create/select Business Portfolio + enter business details | Legal entity linkage |
| Enter phone + display name | Asset identity |
| Receive and enter **OTP** | Proof of number ownership |
| Accept Meta / WhatsApp ToS | Legal |
| Free the number from consumer WhatsApp (or choose Coexistence) | Number exclusivity |
| Add **Meta WABA payment method** (Tech Provider) | Meta ledger ≠ Samyoj Razorpay |
| Upload verification docs when scaling | Meta reviews documents |
| Keep FB admin access / recover PIN | Support & re-register |

### Samyoj must **not** do

- Create WABAs for unnamed future clients.
- Hold the number hostage / block WABA portability.
- Mix Meta per-message fees into Samyoj plan price.
- Ask customers for Meta App Secret or long-lived tokens to paste.
- Promise “unlimited WhatsApp included” or hide that Meta bills separately.

---

## 4. Time expectations (honest ranges)

| Scenario | Wall-clock | Notes |
| --- | --- | --- |
| **Happy path** — prepared Indian SMB, free mobile, OTP works | **15–45 min** | Portfolio + WABA + OTP + Samyoj callback |
| **OTP / carrier issues** (India SMS short-code blocks) | **+30–120 min** | Switch to **voice OTP**; wait & retry |
| **Number still on consumer WhatsApp** | **+15–60 min** | Delete WhatsApp account / wait for release |
| **New FB account** | **+1 hour+** | Meta: account too new to create business |
| **Payment method + first template** | **+15 min – 1 day** | Card + template review |
| **Business Verification (India docs)** | **same day – ~3–7 business days** | GST / Udyam / CIN; rejections restart clock |
| **Scale to 2k messaging limit** | **days–weeks** | Quality + volume path after verification / usage |

**Do not promise customers “10 minutes guaranteed.”** Promise: *agar number free hai aur OTP aa gaya, zyadatar cases mein ek hi sitting mein connect ho jata hai.*

Partner-side: unverified Tech Provider apps are limited to **10 new onboardings / rolling 7 days**; after partner Business Verification + App Review + Access Verification → **200 / 7 days**.

---

## 5. Common failure points (symptom → cause → what to tell customer)

### A. Phone / OTP

| Symptom | Likely cause | Fix language |
| --- | --- | --- |
| OTP never arrives (SMS) | Carrier blocks short codes (common in India) | “Voice call pe OTP try karo” |
| Number rejected / already registered | Still on WhatsApp consumer or another WABA | Consumer WhatsApp se account delete; wait; retry. Business app → Coexistence only if product supports it |
| Landline / 1800 fails | Toll-free often unsupported; needs OTP path | Use mobile or OTP-capable virtual number |
| Register fails days later | Missed **14-day** register window after ES | Redo Embedded Signup, then Samyoj registers again |

### B. Facebook / Business Portfolio

| Symptom | Likely cause | Fix language |
| --- | --- | --- |
| Cannot create business | FB account too new / creation limit | Wait ~1h or use existing portfolio |
| Wrong person on the call | Staff FB without admin rights | Owner / full-control admin must click Connect |
| Popup closes / blocked | Browser popup blocker; `FB.login` not in click handler | Allow popups for Samyoj domain; retry |
| OAuth redirect mismatch | Domain not in Allowed Domains / Strict Mode URI | Samyoj eng fix — not customer fault |

### C. WABA / verification / messaging

| Symptom | Likely cause | Fix language |
| --- | --- | --- |
| Connected but templates fail | No Meta payment method on WABA | WhatsApp Manager → Payment settings → add Visa/Mastercard |
| Cannot create another WABA | Unverified portfolio WABA creation cap | Start [Business Verification](https://www.facebook.com/business/help/2058515294227817) |
| Display name declined | Violates naming guidelines | Match website / legal name; no generic “Shop” |
| Low blast volume | Portfolio still **TIER_250** | Quality messages + verification + scale path |
| Partner PLBV conflict | Another BSP already started Partner-led verification | Finish with that partner or do Meta verification yourself |

### D. Samyoj-specific (support triage)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Connect OK, Inbox no replies | Webhook / tunnel / `META_WEBHOOK_URL` | Infra — not “customer OTP failed” |
| Outbound works, inbound `totalReceived: 0` | Same | Ask for **new** phone reply after webhook healthy |
| 409 on connect | Another org holds active Meta phone id | Isolation rules (SAMYOJ-49) |

Official error catalogue: [Embedded Signup Flow Errors](https://developers.facebook.com/docs/whatsapp/embedded-signup/errors/).

---

## 6. Official URLs (bookmark these)

### Embedded Signup / Tech Provider

- Overview: https://developers.facebook.com/docs/whatsapp/embedded-signup/
- Implementation: https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation/
- Default flow screens: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/default-flow
- Errors: https://developers.facebook.com/docs/whatsapp/embedded-signup/errors/
- Versions / v4 (ES v2 deprecated **15 Oct 2026**): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions
- FAQ: https://developers.facebook.com/docs/whatsapp/embedded-signup/faq/
- Client phone numbers: https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts/phone-numbers/
- Register numbers (steps 1–4; ES does 1–3): https://developers.facebook.com/docs/whatsapp/solution-providers/phone-numbers/registering-phone-numbers/
- Support for onboarded clients (payment method): https://developers.facebook.com/docs/whatsapp/solution-providers/support/business-customer-support/
- Partner-led Business Verification: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/partner-led-business-verification
- Onboard WhatsApp Business **app** users (Coexistence): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users

### Accounts / limits / phones

- WABA overview: https://developers.facebook.com/docs/whatsapp/overview/business-accounts/
- Business phone numbers: https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/
- Messaging limits (portfolio **250 → 2k → …**): https://developers.facebook.com/docs/whatsapp/messaging-limits/
- Cloud API registration reference: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration/
- Pricing (separate Meta ledger): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing

### Meta Business Help Center (customer-facing)

- Create Business Portfolio: https://www.facebook.com/business/help/1710077379203657
- Add WABA to portfolio: https://www.facebook.com/business/help/713785646327651
- Verify your business: https://www.facebook.com/business/help/2058515294227817
- Upload official documents: https://www.facebook.com/business/help/159334372093366
- Add credit card to WhatsApp Business Platform: https://www.facebook.com/business/help/488291839463771
- Add existing card to WABA: https://www.facebook.com/business/help/3146639885655187
- Display name guidelines: https://www.facebook.com/business/help/757569725593362
- About display name: https://www.facebook.com/business/help/338047025165344
- Official Business Account (green tick path): https://www.facebook.com/business/help/604726921052590
- India GSTIN on ad account (ads, not WABA — don’t confuse ledgers): https://www.facebook.com/business/help/1848545052064215

### Consoles

- Meta Business Suite: https://business.facebook.com/
- WhatsApp Manager home: https://business.facebook.com/wa/manage/home/
- Meta App Dashboard: https://developers.facebook.com/apps/

### Samyoj internal companions

- Partner / Tech Provider billing truth: `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`, `docs/billing/16-SELF-QA.md`
- Connect + webhook runbook: `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md`
- Sibling leaf L5 (partner model): `05-tech-provider.md` (when written)

---

## 7. Hinglish checklist — Sonu → customer (read aloud / WhatsApp)

**Pehle bol do (expectation set):**

> WhatsApp Business API connect **aapke Meta account** pe hota hai. Samyoj sirf **Connect** button se Meta ka form kholta hai. OTP, Facebook login, business details, aur Meta pe card add — yeh **aap** karte ho. Samyoj subscription alag hai; WhatsApp message charges **Meta** alag bill karega.

**Call se pehle (prep list):**

1. Jis Facebook se business chalana hai, uska login ready rakho (password + 2FA).
2. Jo number WhatsApp API pe chalana hai — **personal WhatsApp se hatao** (logout/delete). Warna OTP / register fail.
3. Number pe SMS **ya** call aa sakti ho — India mein SMS stuck ho to **voice OTP** try karna.
4. Shop / company ka **sahi naam** (website / board jaisa), address, website/Instagram link.
5. Display name decide kar lo — “Test Shop” mat likhna.
6. Visa/Mastercard debit-credit ready (Meta payment; prepaid / Amex usually nahi).
7. Baad mein limit badhani ho to GST / Udyam PDF ready rakho — pehle din zaroori nahi.

**Connect ke dauran:**

1. Samyoj → **Connect WhatsApp** → Meta popup allow karo (popup blocker band).
2. Terms accept → Business Portfolio **naya** banao ya sahi purana select karo.
3. WABA create/select → phone + display name enter.
4. OTP aate hi daalo — galat number pe OTP mat maango.
5. Finish ke baad Samyoj pe “connected” dikhna chahiye. Nahi dikha to humein batao (hamara server step).

**Connect ke baad (same day):**

1. Meta Business Suite / WhatsApp Manager → us WABA pe **Payment method** add karo ([Help](https://www.facebook.com/business/help/488291839463771)).
2. Pehla **utility template** submit karo (order update etc.) — marketing baad mein.
3. Apne personal phone se business number pe **ek naya message** bhejo → Samyoj Inbox mein aana chahiye.
4. Limit badhani ho / green tick chahiye → Business Verification docs upload ([Verify](https://www.facebook.com/business/help/2058515294227817)).

**Mat bolna customers ko:**

- “Hum WhatsApp free unlimited denge.”
- “App Secret / token humein WhatsApp pe bhej do.”
- “10 minute guarantee, kabhi fail nahi hota.”
- “Ek hi WABA pe saare clients.”

---

## 8. Quiz (self-check)

Answers at bottom — try first.

1. Tech Provider model mein Meta message fees kis ledger pe aate hain — Samyoj Razorpay ya customer WABA?
2. Embedded Signup ke baad Samyoj server ke **teen** mandatory Graph steps kya hain (credit-line share chhod ke)?
3. Phone verify ke baad Cloud API **register** kitne din ke andar karna hai?
4. Naye Business Portfolio ki starting messaging limit kitni unique users / 24h hai?
5. Customer ke consumer WhatsApp pe same number active ho to default Cloud API Embedded Signup kya karega?
6. India mein OTP SMS nahi aaya — pehla legitimate workaround kya hai?
7. Business Verification **bina** kya customer Embedded Signup complete kar sakta hai?
8. ES v2 Meta ne kab deprecate kiya hai (deadline)?
9. Naye portfolio pe registered phone cap pehle kitni hai; verification / 2k limit ke baad?
10. Display name “Fashion Store Delhi Test” kyun risky hai?

<details>
<summary>Answers</summary>

1. **Customer WABA** (Meta Billing Hub). Samyoj SaaS alag.
2. **Code → token exchange**, **register phone**, **subscribe webhooks** on WABA.
3. **14 days** — warna Embedded Signup dubara.
4. **250** (portfolio-level).
5. Consumer WhatsApp numbers **not supported** on plain Cloud API path — number free karo; Business *app* needs **Coexistence** customization.
6. **Voice call OTP** (then wait/retry); carrier short-code blocks common.
7. **Haan** — start at low limits; verification for scale / more WABAs / OBA path.
8. **15 October 2026** — migrate to v4.
9. **2** phones → up to **20** after verified or messaging limit 2,000.
10. Generic / “Test” / geographic fluff — display-name policy; use real brand that matches external presence.

</details>

---

## 9. Sources used this leaf (WebSearch session 2026-08-25)

Primary official:

- https://developers.facebook.com/docs/whatsapp/embedded-signup/
- https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation/
- https://developers.facebook.com/docs/whatsapp/embedded-signup/errors/
- https://developers.facebook.com/docs/whatsapp/embedded-signup/manage-accounts/phone-numbers/
- https://developers.facebook.com/docs/whatsapp/solution-providers/phone-numbers/registering-phone-numbers/
- https://developers.facebook.com/docs/whatsapp/solution-providers/support/business-customer-support/
- https://developers.facebook.com/docs/whatsapp/overview/business-accounts/
- https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/
- https://developers.facebook.com/docs/whatsapp/messaging-limits/
- https://www.facebook.com/business/help/488291839463771
- https://www.facebook.com/business/help/2058515294227817
- https://www.facebook.com/business/help/1710077379203657
- https://www.facebook.com/business/help/757569725593362

Secondary (timing / India operator color — verify against official when quoting externally):

- Dualhook ES implementer guide (verified against Meta docs 2026-08-14): https://dualhook.com/docs/whatsapp-embedded-signup-guide
- India setup narrative (BSP blog): use only for “OTP voice / GST docs” color, not as Meta law

Samyoj canon:

- `docs/billing/16-SELF-QA.md` Q1–Q3, Q6
- `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`
- `.cursor/rules/whatsapp-dev-setup.mdc` (Connect UI: no App ID/Secret for normal users)

---

*End L8 research note.*
