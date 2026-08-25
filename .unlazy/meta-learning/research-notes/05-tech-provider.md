# L5 — Tech Provider / Embedded Signup / Partner model

**Leaf:** L5 · **Topic:** How multi-tenant SaaS (Samyoj jaisa) customer WABAs connect karta hai  
**Researched:** 2026-08-25 · **Lang:** Hinglish + English  
**Not code.** Study notes for Sonu → later folds into master guide.

---

## 0. Seedha jawab (TL;DR)

Samyoj-type SaaS = **Tech Provider** (TARGET). Har customer ka **apna WABA** + Meta payment method. Samyoj sirf software bill karta hai (Razorpay). Meta Cloud API fees customer ke WhatsApp Manager pe jaati hain.

**Connect path Meta ke hisaab se:** **Embedded Signup (ES) v4** — Facebook Login for Business + JS SDK (`config_id`). Popup se customer WABA/phone banata/select karta hai; server code → **business token** exchange; app ko WABA pe subscribe + number register.

**BSP ≠ Tech Provider.** Industry slang “BSP” ≈ **Solution Partner** (credit line). Contract/UI mein “BSP” mat bolo jab tak SP na bano.

**Deadline:** Embedded Signup **v2/v3 deprecate = 15 Oct 2026**. Ab **v4** chalao (config-driven). Coexistence (`coex` / Business-app onboarding) auto-upgrade nahi — manually migrate.

**Samyoj aaj:** Connect flow **classic OAuth dialog** (`/dialog/oauth` + scopes) + platform `META_APP_ID` — yeh self-serve / early-dev pattern hai. Scale pe **Embedded Signup v4** hi supported partner onboarding product hai.

---

## 1. Partner types — pehle yeh clear karo

Official comparison (updated ~2026-05-21):

| | **Solution Partner (SP)** | **Tech Provider (TP)** | **Tech Partner** |
|---|---|---|---|
| Full Cloud API services to clients | Yes | Yes | Yes |
| Meta **credit line** | **Yes** | No | No |
| Customer card skip during onboard | **Yes** (SP shares credit) | No — customer adds PM | No |
| Who bills **API usage** | Partner invoices client | **Meta bills client** | Meta bills client |
| Partner bills **software / services** | Yes | Yes | Yes |
| Meta Business Partner | Yes | No | Yes |
| Accelerator / Partner Portal extras | Yes | No | Yes (after upgrade) |
| Direct Support | Yes | Yes | Yes |

### Hinglish meaning

- **Tech Provider** = tum software bechte ho (inbox, AI, seats). WhatsApp message fees Meta customer se leti hai. **Do cards:** Razorpay (Samyoj) + Meta BM (Cloud API).
- **Solution Partner** = tumhare paas Meta credit line; tum clients ko API usage pe bhi invoice kar sakte ho; onboard pe customer ko card nahi lagana padta (tum share karte ho). Process **lamba**.
- **Tech Partner** = Tech Provider jo Meta Business Partner ban gaya (portal, accelerator) — abhi bhi **credit line nahi**.

Meta khud kehta hai: agar credit line / API-usage invoice ki zarurat nahi, **Tech Provider bano**, SP mat chase karo pehle din se.

### Official URLs

- Partners overview: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview  
- Same (docs path): https://developers.facebook.com/docs/whatsapp/solution-providers/  
- Become a Tech Provider: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers  
- Also: https://developers.facebook.com/docs/whatsapp/solution-providers/get-started-for-tech-providers/  
- Upgrade TP → Tech Partner: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/upgrade-to-tech-partner/

### Samyoj TARGET

`docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` + pack: **Tech Provider pehle**. Optional baad mein Multi-Partner Solution with SP, ya khud SP apply.

---

## 2. Multi-tenant SaaS — customer WABA kaise connect hota hai

### Rule

**Ek Samyoj WABA sab tenants ke liye = galat / unsupported at scale.**  
Har Client = **unhone WABA** (unke Business Portfolio ke under) + tumhari **app** ko access grant.

### Supported onboarding products (partner)

1. **Embedded Signup** (recommended, scalable) — tumhari site/portal pe button → Meta wizard.
2. **Hosted Embedded Signup** — Meta host karta hai flow; kam frontend code.
3. **Client-created WABA** share via Meta Business Suite (manual / low volume).
4. **Partner-initiated WABA creation** — **Solution Partner only**, Tech Provider ke liye nahi.

### Tech Provider post-ES server steps (official)

Customer flow complete → tumhe milta hai: `waba_id`, usually `phone_number_id`, exchangeable **code**.

Phir server-to-server:

1. `GET /oauth/access_token` — code → **business integration system user token** (“business token”). TP **sirf business tokens** use karta hai (SP credit-line share ke liye system token alag).
2. `POST /{WABA_ID}/subscribed_apps` — tumhari app ko us WABA ke webhooks pe subscribe.
3. Register phone number for Cloud API (`/{PHONE_NUMBER_ID}/register`) — **Coexistence pe skip** (number pehle se registered).
4. Customer **payment method** WABA pe add kare (TP/Tech Partner) — tabhi production messaging.

Subscribe `account_update` webhook — ES complete hone pe business info aati hai.

### Official URLs

- Embedded Signup overview: https://developers.facebook.com/docs/whatsapp/embedded-signup/  
- Newer path: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview  
- Implementation (v4): https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation/  
- Also: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation  
- Onboard as Tech Provider: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider  
- FAQ: https://developers.facebook.com/docs/whatsapp/embedded-signup/faq/

---

## 3. OAuth vs Embedded Signup — confusion clear

| | **Classic Facebook OAuth dialog** | **Embedded Signup** |
|---|---|---|
| What it is | Generic Login / `/dialog/oauth` with scopes | **Partner onboarding product** built **on** Facebook Login for Business |
| Who it fits | Single BM / early self-test / internal | Tech Provider / SP / Tech Partner **multi-customer** |
| Creates WABA + phone wizard? | No (you already have assets / manual) | **Yes** — portfolio, WABA, number, ToS, grant |
| Returns | User/page-ish tokens depending on config | Exchangeable **code** → **customer-scoped business token** + asset IDs via `postMessage` |
| Meta stance for partners at scale | Not the onboarding product | **The** supported scalable path |

**Important nuance:** Embedded Signup **uses** OAuth under the hood (Login for Business + `response_type=code`). Logically “OAuth vs ES” ka matlab yeh nahi ki ES OAuth nahi hai — matlab **generic dialog OAuth ≠ full WABA onboarding wizard**.

**Facebook Login vs Facebook Login for Business:** ES ke liye **Login for Business** chahiye — assets, permissions, token type declare. Pure “Facebook Login” consumer app se ES mature setup mushkil.

### Samyoj code map (current)

- Connect: `meta.service.ts` builds `https://www.facebook.com/{apiVersion}/dialog/oauth` with `whatsapp_business_management,whatsapp_business_messaging`.
- State: `connect-oauth-state.ts`; callback exchange `/oauth/access_token`.
- Product rule: users **never** type App ID/Secret in Settings — platform `.env` only.
- Docs: `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md`.

Yeh flow outbound/inbound testing ke liye chal sakta hai; **partner-grade multi-tenant onboarding** ke liye Meta docs ES push karte hain. Migration planning = ES v4 Builder + `config_id` + BISU token storage per org/number (existing `WhatsappNumber` isolation keep).

---

## 4. Embedded Signup — flow anatomy

ES teen kaam ek saath:

1. Customer identity + ToS (Cloud API, WhatsApp Business, Meta, …).
2. Assets generate/select: Business Portfolio, WABA, phone, display name.
3. Tumhari **app** ko un assets pe access grant.

### Client (v4)

```js
FB.login(callback, {
  config_id: "<CONFIGURATION_ID>", // Login for Business config from Builder
  response_type: "code",
  override_default_response_type: true,
  extras: {
    setup: {
      // optional: solutionID for Multi-Partner Solutions
    },
    // Coexistence ONLY — omit for plain Cloud API number onboard:
    // featureType: "whatsapp_business_app_onboarding",
  },
});
```

**Do return channels (alag, race kar sakte hain):**

1. `FB.login` callback → `authResponse.code`
2. `window.postMessage` type `WA_EMBEDDED_SIGNUP` → `waba_id` / `phone_number_id` / finish event

Hard bugs aksar inhe ek channel samajhne se aate hain.

### Permissions (Cloud API messaging SaaS)

- `whatsapp_business_management` — WABA settings, templates
- `whatsapp_business_messaging` — send/receive, phone settings  

**Advanced Access (App Review)** zaroori — bina iske live customers pe grant fail / API error `200`. Dev mode mein sirf app roles pe chalega.

### Billing fork after onboard

- **TP / Tech Partner / not partnered with SP:** customer **must** attach payment method to WABA before messaging.  
  Help: “Add a credit card to your WhatsApp Business Platform account.”
- **SP (or MPS with SP credit share):** credit line share; customer messaging pehle shuru kar sakta hai without own card.

### Hosted ES

Partners overview: Hosted Embedded Signup = simpler alternative — tumhe full JS host nahi karna. Same partner outcomes; less UI control.

---

## 5. Versions — v2 / v3 / v4 migration (documented)

Official Versions page (Business Messaging docs):

| Version | Introduced | Available until |
|---|---|---|
| **v4** | **8 Oct 2025** | TBD (current) |
| v4-public-preview | 12 May 2026 | TBD |
| v3 | 29 May 2025 | **Oct 2026** |
| v2 | Jan 2023 | **Oct 2026** |
| v2/v3 public previews | 14 Aug 2025 | Oct 2026 |

**Hard date:** **15 October 2026** — v2 (and blog: v3) **deprecated**. Migrate to **v4**.

### v4 kya badla

- Pehle (v2): assets/permissions zyada tar `FB.login` / `extras` mein.
- v3: `extras.version: "v3"` opt-in.
- **v4:** products/assets/permissions **Facebook Login for Business Configuration / Embedded Signup Builder** mein. JS mein mainly `config_id` + response type + launch selector.

Upgrade steps (Meta blog 14 May 2026, Keilani Collins):

1. App Dashboard → **Facebook Login for Business → Configurations → Create**.
2. Login variation: **WhatsApp Embedded Signup**.
3. Select Business Messaging APIs/products (WhatsApp-only OK).
4. Test in **Embedded Signup Builder** (version pick mat karo — config drives v4).
5. Client code mein naya `config_id` plug; retest callbacks + token exchange.

Effort estimate (Meta): ~**1 week** including testing (kabhi minutes of config + test).

### Auto-upgrade caveat (critical)

Most leftover v2/v3 integrations **auto-upgrade** after deadline — **except** these feature types **cannot** auto-upgrade; **manual** update before 15 Oct 2026, warna default standard flow:

- `only_waba_sharing`
- `marketing_messages_lite`
- **`coex`** (Coexistence legacy feature type)

Coexistence ab v4 mein `featureType: "whatsapp_business_app_onboarding"` se supported rehta hai — legacy `coex` string pe mat atke raho.

### Official URLs

- Versions: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions  
- Version 4 detail: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4  
- Migration blog: https://developers.facebook.com/blog/post/2026/05/14/embedded-signup-v4/  
- Changelog (confirm before build): https://developers.facebook.com/docs/whatsapp/business-platform/changelog/

---

## 6. Coexistence (WhatsApp Business app onboarding)

**Naam:** docs mein “Onboard WhatsApp Business app users”; support/partner channels mein **“Coexistence”**.

### Kya milta hai

Customer **existing WhatsApp Business app** number Cloud API se jod sakta hai. Phir:

- Tumhari app se **high-volume** Cloud API messaging.
- App pe **1:1** messaging jaari.
- History sync (app ↔ Cloud API) — webhooks / coexistence sync APIs.

### Prerequisites (documented)

- Solution Partner **or** Tech Provider.
- WhatsApp Business app version (docs cite **2.24.17+** / confirm live page).
- Webhooks digest (incl. echoes / sync).
- Session logging enabled (per coexistence guide).

### How to launch

`extras.featureType = "whatsapp_business_app_onboarding"` (v4 pe bhi **JS extras** mein — Builder se Coexistence enable karna alag; launch selector abhi bhi code mein).

Success event: `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` (vs normal `FINISH`).

**Skip** Cloud API phone **register** step — number already registered.

### Product / billing implications (Samyoj)

- App-side sends often **free at Meta**; Cloud API sends **billed**.
- App messages **do not** open Cloud API 24h customer service window the same way — Inbox must show **`smb_message_echoes`** (or coexistence echoes) warna agents double-send.
- Switching partners: coexistence errors say disconnect current partner in Business app first (`3441042`-class issues).

### Official URLs

- Coexistence / Business app users: https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/  
- Newer path: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users  
- Flow errors (coexistence codes): https://developers.facebook.com/docs/whatsapp/embedded-signup/errors/

---

## 7. Multi-Partner Solutions (MPS)

Agar Samyoj Tech Provider hai lekin kabhi **SP credit line** chahiye (Enterprise “we float Meta”):

- TP + SP joint **solution**; `solutionID` in `extras.setup`.
- Customer ES complete → **dono** partners ko asset access.
- Galat `solutionID` inject mat karo agar multiple solutions active hain.

### Official URLs

- MPS: https://developers.facebook.com/docs/whatsapp/solution-providers/multi-partner-solutions/  
- Also: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/multi-partner-solutions  
- Embedded MPS creation (SP hosts button for TPs): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/multi-partner-solution-embedded-creation

---

## 8. Tokens — yaad rakhne wali table

| Role | Token use |
|---|---|
| **Tech Provider / Tech Partner** | **Business tokens only** (per onboarded customer) |
| **Solution Partner** | Business tokens for messaging/management; **system token** only to **share credit line** (`business_management` on that system user + Admin/Financial Editor on partner portfolio) |

Never put customer business token in browser / logs / support screenshots.

---

## 9. Policy / limits that hit onboarding (short)

- App Review Advanced Access for WA management + messaging scopes.
- Unverified TP onboarding volume historically capped (commonly cited **~10 new customers / 7 days** until verification — **confirm live Get Started page** before sales promises).
- Service Provider Terms: no WABA for unnamed future clients; portability 30 days; Price Transparency if **you** charge for API usage (SP); TP still **disclose** Meta bills separately.
- Brand: third-party; do not look like WhatsApp.

Legal pointers:

- https://www.whatsapp.com/legal/business-terms-for-service-providers/  
- https://www.whatsapp.com/legal/business-solution-terms/  
- Legal index (terms update note ~2026-09-23): https://www.whatsapp.com/legal/?lang=en  

---

## 10. Samyoj checklist — “kaise connect karna chahiye”

| Step | TARGET (docs) | Notes |
|---|---|---|
| Partner status | Tech Provider | Not SP day-one |
| Onboarding UX | Embedded Signup **v4** | `config_id` from Login for Business |
| App credentials | Platform-only `.env` | Users never see App ID/Secret |
| Per-tenant data | Customer WABA + number rows scoped by org | Number isolation already in code |
| Token store | Per-number **business token** encrypted | Not one global user token for all tenants |
| Webhooks | Single app callback → route by `phone_number_id` | `subscribed_apps` per WABA |
| Meta billing | Customer attaches card | UI copy: Meta fees separate from SaaS |
| SaaS billing | Razorpay | Never mix Meta PMP into plan price |
| Coexistence | Optional product decision | If yes: `featureType` + echo ingestion |
| Before 2026-10-15 | Be on v4 | Especially if coexistence / special feature types |

Current OAuth Connect = transitional / testing. Production partner story = ES v4 + TP.

---

## 11. Official URL index (bookmark)

**Partners**

1. https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview  
2. https://developers.facebook.com/docs/whatsapp/solution-providers/  
3. https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers  
4. https://developers.facebook.com/docs/whatsapp/solution-providers/get-started-for-tech-providers/  
5. https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/upgrade-to-tech-partner/  
6. https://developers.facebook.com/docs/whatsapp/solution-providers/multi-partner-solutions/  
7. https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/multi-partner-solutions  

**Embedded Signup**

8. https://developers.facebook.com/docs/whatsapp/embedded-signup/  
9. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview  
10. https://developers.facebook.com/docs/whatsapp/embedded-signup/implementation/  
11. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation  
12. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider  
13. https://developers.facebook.com/docs/whatsapp/embedded-signup/faq/  
14. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions  
15. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4  
16. https://developers.facebook.com/blog/post/2026/05/14/embedded-signup-v4/  
17. https://developers.facebook.com/docs/whatsapp/business-platform/changelog/  

**Coexistence**

18. https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/  
19. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users  
20. https://developers.facebook.com/docs/whatsapp/embedded-signup/errors/  

**Login / tokens context**

21. https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/  

**Internal Samyoj (not Meta, but SoT for product)**

22. `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`  
23. `docs/billing/15-SOURCES.md`  
24. `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md`  
25. `.cursor/rules/billing-research.mdc`

**Third-party (secondary only — verify against Meta)**

- Dualhook ES guide (implementer notes, Aug 2026): https://dualhook.com/docs/whatsapp-embedded-signup-guide  
- UnifyPort coexistence migration checklist: https://www.unifyport.ai/blog/whatsapp-embedded-signup-v4-coexistence-migration/

---

## 12. Quiz / self-check

Answer without scrolling. Then check § below.

1. Samyoj TARGET partner type — Tech Provider, Solution Partner, or BSP?  
2. Who pays Meta Cloud API message fees under Tech Provider?  
3. Does Embedded Signup replace OAuth, or sit on top of Login for Business?  
4. What three server steps must a Tech Provider do after ES returns a code?  
5. v2/v3 deprecation date? Current version name?  
6. Which three feature types will **not** auto-upgrade and need manual work before the deadline?  
7. Coexistence launch: which `featureType` string? Which finish event?  
8. For Coexistence, do you still call phone `/register`?  
9. Tech Provider which token type only? When does SP use system token?  
10. Can Tech Provider create WABAs for customers without ES / customer consent path the way SP partner-initiated creation works?  
11. What goes in `extras.setup.solutionID`?  
12. Why is Advanced Access required before real customers complete ES?  
13. Two parallel return channels from ES client — name them.  
14. Samyoj today: dialog OAuth or ES v4 Builder `config_id`?  
15. If customer keeps WhatsApp Business app open and agent also sends from Inbox without echoes, what goes wrong?

### Answers

1. **Tech Provider.** “BSP” slang ≈ Solution Partner — avoid the word until SP.  
2. **The customer** (Meta bills their WABA). Samyoj bills SaaS only.  
3. **Sits on** Facebook Login for Business / OAuth code flow — it is the **partner onboarding wizard**, not “instead of OAuth.”  
4. Exchange code → **business token**; **subscribe** app to WABA webhooks; **register** phone (unless coexistence). Then customer adds **payment method**.  
5. **15 Oct 2026**; current **v4** (since 8 Oct 2025).  
6. `only_waba_sharing`, `marketing_messages_lite`, `coex`.  
7. `whatsapp_business_app_onboarding`; event `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`.  
8. **No** — skip register; already registered on Business app.  
9. TP: **business tokens only**. SP: system token **only to share credit line**; else business tokens.  
10. **No** — partner-initiated WABA creation is SP-oriented; TP uses ES / customer-driven asset creation or share. Don’t create WABAs for unnamed future clients.  
11. **Multi-Partner Solution ID** so both TP and SP get access.  
12. Without Advanced Access, live customers don’t get the WA permissions in the flow / API returns permission errors (`200`).  
13. `FB.login` **code** callback + `WA_EMBEDDED_SIGNUP` **postMessage** with asset IDs.  
14. **Classic `/dialog/oauth`** today — ES v4 is the documented scale path ahead.  
15. Agent may **double-send**; Meta may bill Cloud API send while app send was free; Inbox history dishonest without `smb_message_echoes`.

---

## 13. One-paragraph memory hook

**Tech Provider** SaaS = customer WABA + Meta bill + tumhara software bill. Connect = **Embedded Signup v4** (`config_id`) → code → **business token** → subscribe + register → customer card. **Coexistence** = Business app number rehne do, `featureType` set karo, register skip, echoes ingest. **15 Oct 2026** se pehle v4 pe aa jao; `coex`/`only_waba_sharing`/`marketing_messages_lite` auto nahi bachenge. Samyoj aaj OAuth dialog pe hai — partner production story ES hai.

---

*End L5 notes. Cross-link master guide when branch integrates.*
