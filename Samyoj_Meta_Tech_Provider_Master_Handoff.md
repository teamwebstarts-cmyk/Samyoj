# Samyoj × Meta WhatsApp Tech Provider — Master Handoff (single document)

**Date:** 18 September 2026
**Project:** Samyoj — WhatsApp CRM / automation platform
**Website:** https://samyoj.com/index.html
**App:** https://app.samyoj.com/
**Purpose:** Ek hi self-contained document jo dusre AI / workspace agent ko diya ja sake. Isme poori Meta App Review history, dono rejections, testing proofs, **workspace me 18-Sep-2026 ko verify kiya hua actual code**, dashboard configuration, mismatch ka root cause, aur third submission se pehle exact strategy — sab hai.
**Safety:** Isme koi access token, app secret, System User token, ya reviewer password **nahi** hai. IDs sirf reference ke liye hain.

---

## 1. Goal

Samyoj independent WhatsApp Tech Provider ke taur par onboard hona chahta hai (Meta WhatsApp Business Platform + Facebook Login for Business + WhatsApp Embedded Signup).

**Immediate unresolved item:** App Review me `business_management` approval.

- Approved ✅: `whatsapp_business_messaging`, `whatsapp_business_management`, `public_profile`
- Rejected ❌: `business_management` (2 baar, same reason)

User chahta hai ki next submission actual implementation + reviewer-reproducible end-to-end flow par based ho, sirf better captions par nahi.

---

## 2. Key IDs (no secrets)

| Item | Value |
|---|---|
| Meta App ID | `1766674304665017` |
| Business Portfolio ID | `4568747570038284` (name: Samyoj) |
| WABA 1 | `3233664960155958` — Samyoj |
| WABA 2 | `1971498750222393` — Test WhatsApp Business Account |
| Facebook Login for Business Configuration ID | `1304098751592068` (name ~ "Tech Provider Meta-host...", WhatsApp Embedded Signup) |

---

## 3. App Review history

### 3.1 Testing phase
- Shuru me Meta Testing page par: `whatsapp_business_messaging` Completed, `whatsapp_business_management` Completed, `public_profile` 0 calls, `email` 0 calls, `business_management` 0 of 1 required.
- Note tha: successful testing data 24h tak lag sakta hai.
- Graph API tests jo run hue:
  - `GET /me/businesses?fields=id,name` → `4568747570038284` / Samyoj
  - `GET /4568747570038284/owned_whatsapp_business_accounts?fields=id,name` → upar wali dono WABAs
  - `GET /debug_token?input_token=...` → `app_id 1766674304665017`, `type USER`, `is_valid true`, scopes me `business_management`, `whatsapp_business_management`, `whatsapp_business_messaging`, `public_profile`; granular target IDs me dono WABAs.
- Wait ke baad Testing page: `business_management` → Completed.

### 3.2 First submission
- Approved: `whatsapp_business_messaging`, `whatsapp_business_management`, `public_profile`
- Rejected: `business_management`
- Reason: **Screencast Not Aligned with Use Case Details** — use case allowed tha, par screencast me described use case ka end-to-end experience demonstrate nahi hua.
- Meta ne next screencast me manga: complete Meta login flow, user granting access, requested permission ka end-to-end experience, English UI + captions/tooltips + button explanations, aur agar server-to-server / System User token hai to explicitly bolo.

### 3.3 Second submission (17 Sep 2026, ~12:56 IST)
- Result same: 3 approved, `business_management` rejected, same reason.
- Isse prove hua: sirf captions polish karne se fix nahi hua.
- Recording me third-party editing/watermark element bhi tha (rejection me cause nahi bola gaya, par next recording clean honi chahiye).
- User ka described real flow (~88 sec video):
  ```
  Samyoj signup/login → dashboard → WhatsApp not connected
  → Connect WhatsApp → Meta/Facebook authorization popup ("Continue as ...")
  → authenticate → WhatsApp number selection → connected
  → Samyoj me connected WhatsApp → Inbox / functionality
  ```
- Video me real Meta authorization + WhatsApp connection dikhta hai, par **exact `business_management` permission grant + uska use** clearly visible nahi hai. Yahi central issue hai.

---

## 4. ACTUAL current code (workspace me 18-Sep-2026 ko verified — purane handoff se correction)

Purana handoff kehta tha "code sirf manual OAuth URL banata hai, config_id use hi nahi hota". **Ab sach thoda updated hai: backend me DONO paths hain, par default abhi bhi legacy hai aur frontend ES v4 ko handle nahi karta.**

### 4.1 Backend — two connect paths

**File:** `server/src/modules/whatsapp/routes.ts` (`GET /connect-url`)
**File:** `server/src/modules/whatsapp/legacy-oauth-url.ts`
**File:** `server/src/modules/whatsapp/meta.service.ts` (`getEmbeddedSignupConfig`)
**File:** `server/src/config/index.ts` (env switch)

```ts
// server/src/config/index.ts
esConfigId: process.env.META_ES_CONFIG_ID || '',
esCoexConfigId: process.env.META_ES_COEX_CONFIG_ID || '',
connectFlow: /^(es_v4|embedded)$/i.test(process.env.META_CONNECT_FLOW || '')
  ? 'es_v4'
  : 'oauth',
```

```ts
// server/src/modules/whatsapp/routes.ts — GET /connect-url
if (config.meta.connectFlow === 'oauth' && connectMode === 'standard') {
  // legacy path (DEFAULT jab tak META_CONNECT_FLOW=es_v4 na ho)
  const signupConfig = buildLegacyOAuthConnectUrl({ appId, state, redirectUri, connectMode });
  // → { mode: 'OAUTH_DIALOG', url: 'https://www.facebook.com/{v}/dialog/oauth?...', ... }
  sendSuccess(res, signupConfig);
  return;
}
// ES v4 path (sirf jab META_CONNECT_FLOW=es_v4)
const signupConfig = MetaWhatsAppService.getEmbeddedSignupConfig(state, metaCredentials, redirectUri, connectMode);
// → { mode: 'ES_V4_SDK', appId, configId, apiVersion, state, redirectUri, connectMode }
sendSuccess(res, signupConfig);
```

```ts
// server/src/modules/whatsapp/legacy-oauth-url.ts
scope: 'whatsapp_business_management,whatsapp_business_messaging',
// NO business_management, NO config_id
// url = https://www.facebook.com/{version}/dialog/oauth?...
```

```ts
// server/src/modules/whatsapp/meta.service.ts — getEmbeddedSignupConfig
const configId = connectMode === 'coexistence'
  ? config.meta.esCoexConfigId || config.meta.esConfigId
  : config.meta.esConfigId;
if (!configId) throw new AppError(503, 'WhatsApp connect isn’t ready...', 'META_ES_CONFIG_MISSING');
// returns { mode:'ES_V4_SDK', appId, configId, apiVersion, state, redirectUri, connectMode }
```

** matlab:**
- Default (`META_CONNECT_FLOW` unset/`oauth`): **legacy `dialog/oauth` + 2 WhatsApp scopes**. Yahi woh flow hai jo reviewer ne video me dekha.
- ES v4 (`META_CONNECT_FLOW=es_v4` + `META_ES_CONFIG_ID=1304098751592068`): backend `config_id` return karta hai, par **frontend isko use nahi karta** (neeche dekho).
- `server/.env.example` me bhi likha hai: `META_CONNECT_FLOW=oauth` default; ES IDs "unused unless META_CONNECT_FLOW=es_v4".

### 4.2 Frontend gap (important, purane handoff me nahi tha)

**Files:** `client/src/hooks/useWhatsAppConnectOAuth.ts`, `client/src/utils/whatsappOAuth.ts`, `client/src/pages/WhatsappCallbackPage.tsx`, `client/src/pages/SettingsPage.tsx`

- `useWhatsAppConnectOAuth` sirf `payload.url` nikalta hai (`pickConnectUrl`). ES v4 response me `url` hota hi nahi (sirf `configId`), to `connectUrl=''` rehta hai → `toastError('Could not start WhatsApp connection...')`.
- `startWhatsAppOAuth(url)` sirf popup/redirect kholta hai. Kahin `FB.login({ config_id, response_type:'code', ... })` + Facebook JS SDK + `WA_EMBEDDED_SIGNUP` postMessage handling **nahi** mila.
- `WhatsappCallbackPage` (`/settings/whatsapp/callback`) `?code=&state=` exchange karta hai via `whatsappApi.completeConnect(code, state)` → backend `POST /whatsapp/connect/callback` → token exchange → phone list → select ya direct connect. Ye legacy OAuth ke saath kaam karta hai.
- Matlab: **ES v4 backend-ready hai, frontend-wiring missing hai.** Config ID dashboard me hai, par reviewer-visible flow me use nahi ho raha.

### 4.3 Backend token + WABA discovery (dono paths ke baad same)

**File:** `server/src/modules/whatsapp/meta.service.ts`

- `exchangeCodeForToken` + `exchangeForLongLivedToken` → POST form body (secret URL me nahi, 2026-08-25 fix). `exchangeCodeForAccessToken` dono ko chain karta hai.
- `listAccessibleWabaIds`: pehle `debug_token` granular_scopes (`whatsapp_business_management` / `whatsapp_business_messaging` target_ids), nahi mile to fallback:
  - `GET /me/businesses?fields=id,name`
  - `GET /{business_id}/owned_whatsapp_business_accounts?fields=id`
  - `GET /{business_id}/client_whatsapp_business_accounts?fields=id`
- `listPhoneNumbersForWaba`: `GET /{waba_id}/phone_numbers?fields=id,display_phone_number,verified_name`
- `POST /connect/callback`: code+state verify (JWT `connect-oauth-state.ts`, 30min, org+user bind) → token → `listAvailablePhoneNumbers` → 1 phone to direct `buildConnectionDetails` + `saveWhatsappConnection`, multiple to `pendingToken` + phone picker.
- `POST /connect/select`: pendingToken consume karke selected phone connect.
- Connect ke baad: `ensureWabaSubscribed` (`POST /{waba_id}/subscribed_apps`), webhook auto-config (`registerAppWebhook` + durable override pin), coexistence flags, token expiry probe, `saveWhatsappNumberWorkspace` (soft-disconnect model, number isolation, 409 rules — `.cursor/rules/whatsapp-number-isolation.mdc`).
- Webhook: `GET /webhook` verify, `POST /webhook` signature gate + persist-then-ack + queue; `GET /webhook/health` sirf counters + `webhookConfigured` (no URL/leak).

### 4.4 Meta dashboard configuration (user screenshots se)

Path: Meta Dashboard → Facebook Login for Business → Configurations → `1304098751592068`

- Products: WhatsApp Cloud API, Marketing Messages API for WhatsApp
- Access token: System-user access token, never expire
- Assets/tasks: WhatsApp accounts; develop, manage_templates, view/manage phone assets, view_templates, messaging, manage
- Permissions ticked: `whatsapp_business_management` ✅, `whatsapp_business_messaging` ✅
- **Unticked:** `business_management` checkbox Edit Configuration me dikhta hai par selected nahi hai.

---

## 5. Root cause (kyun twice reject hua)

```
Meta review target:        business_management
Legacy OAuth scope:        whatsapp_business_management, whatsapp_business_messaging (NO business_management)
FB Login config:           whatsapp_business_management, whatsapp_business_messaging (NO business_management)
Backend actually calls:    /me/businesses + owned/client WABAs + phone_numbers (business-level discovery)
Frontend launches:         legacy dialog URL (config_id 1304098751592068 use nahi hota)
ES v4 backend:             ready, par frontend FB.login wiring missing → reviewer kabhi ES flow dekhta hi nahi
```

Reviewer ko dikhta hai: WhatsApp connect ho gaya, par **kis screen par `business_management` grant hua aur uske baad business/WABA onboarding ka end-to-end use** — ye visible nahi hai. Isliye captions se fix nahi hua.

---

## 6. Kya NAHI karna (abhi)

1. **Blindly `business_management` tick karke video 3 submit mat karo.** Config tick karne se legacy OAuth flow auto-change nahi hoga.
2. **Blindly raw scope string me `business_management` add mat karo.** Sahi fix configuration-based Embedded Signup alignment hai, raw OAuth hack nahi.
3. **Same underlying flow par sirf polish karke third submission mat karo.** Meta already twice same reason de chuka hai.
4. Approved permissions mat hatao. Working WhatsApp connection mat todo. Tokens/secrets kahin paste mat karo.

---

## 7. Recommended strategy (third submission se PEHLE)

### Phase A — implementation + configuration alignment
1. Decide karo: production Tech Provider flow = **ES v4 config-based** (recommended, aur ES v2 sunset ~8 Oct 2026 ke wajah se time-critical) ya legacy OAuth hi rakhna hai.
2. Agar ES v4:
   - `server/.env` me `META_ES_CONFIG_ID=1304098751592068` + `META_CONNECT_FLOW=es_v4` set karo (prod `.env` 600, logs 640 — existing rule).
   - Frontend me Facebook JS SDK + `FB.login({ config_id, response_type:'code', override_default_response_type:true, ... })` + `WA_EMBEDDED_SIGNUP` postMessage (`waba_id` hint) wire karo. `useWhatsAppConnectOAuth` ka `pickConnectUrl`-only logic badlo — `mode==='ES_V4_SDK'` branch add karo.
   - `GET /connect-url` ka ES response + frontend launch + `POST /connect/callback` token handling + WABA/phone persistence — poora trace test karo.
   - Decide karo `business_management` **configuration me genuinely needed hai ya nahi** (Tech Provider business/WABA discovery operations ke liye). Dashboard ke Products/Access token/Assets/Permissions full sequence ke screenshots lekar hi tick/untick decide karo — third-party guides par guess mat karo.
3. Token type confirm karo har stage par (user token vs System User token vs app token). Agar server-side/System User processing hai to reviewer text me explicitly likhna padega.
4. Real test business/WABA se reproducible flow test karo (reviewer same kar sake).

### Phase B — evidence mapping
| Meta requirement | Visible proof |
|---|---|
| Complete Meta login | Actual Meta/FB Login for Business flow (ES v4 recommended) |
| User grants access | Consent screen jahan exact permission/assets dikhen |
| Requested permission | `business_management` ka business-access purpose clear ho |
| End-to-end use case | Business/WABA onboarding → Samyoj me connected state → Inbox/messaging use |
| English UI | English |
| Captions/tooltips + button explain | Minimal English captions |
| Server/System User | Agar true hai to explicit statement |

---

## 8. Third screencast script (ONLY after Phase A green)

Clean recording, no watermark, English UI.

- **Scene 1 — Samyoj login.** Caption: "Step 1 — Sign in to Samyoj." VO: "I am signing into Samyoj to connect a WhatsApp Business Account."
- **Scene 2 — Settings → WhatsApp → Connect WhatsApp.** Caption: "Step 2 — Start WhatsApp onboarding." VO: "I will now connect a WhatsApp Business Account to this Samyoj workspace."
- **Scene 3 — Meta authentication.** Complete Meta/FB Login for Business flow dikhao. VO: "This is Meta authentication for the business onboarding flow."
- **Scene 4 — Consent/access.** Actual authorization screen — reviewer dekh sake kya authorize ho raha hai.
- **Scene 5 — Business onboarding.** Configured Meta flow ka business/asset selection. Caption: "Step 3 — Select the business assets to connect."
- **Scene 6 — WABA/phone.** Real WABA + phone selection/onboarding.
- **Scene 7 — Return to Samyoj.** Connected business/WABA/number. Caption: "Step 4 — WhatsApp Business Account connected." VO: "The selected WhatsApp Business Account is now associated with this Samyoj workspace."
- **Scene 8 — Product use.** Connected account se Inbox/messaging dikhao. Caption: "Step 5 — Use the connected WhatsApp Business Account."
- **Scene 9 — Server note (agar true hai).** "After the business completes the Meta authorization flow, Samyoj processes the connected WhatsApp business assets server-side." Sirf tabhi jab technically accurate ho.

---

## 9. Reviewer Instructions (template — video+code se match karne ke baad hi use karna)

> Visit https://app.samyoj.com/ and sign in using the provided test account. Go to Settings → WhatsApp and select Connect WhatsApp. This launches Samyoj's Meta WhatsApp onboarding flow. Authenticate with Meta and complete the business onboarding steps, including selecting the applicable Business Portfolio and WhatsApp Business Account. After the onboarding flow is completed, return to Samyoj and verify that the WhatsApp Business Account is connected. Samyoj then uses the connected WhatsApp business assets to provide WhatsApp Business management and messaging functionality.
>
> Samyoj does not use Facebook Login as the primary authentication method for application users. Meta's Facebook Login for Business is used as part of the WhatsApp onboarding flow to authenticate the business and connect its WhatsApp Business assets.

Yes/No field ka answer exact Meta product/integration se decide karo. Ye clarification written me rakho agar accurate hai.

---

## 10. Data Handling context

Pehle App Review Data Handling me pucha tha: data processors, Meta Platform Data ka responsible entity, controller country, national security/public authority disclosures, government-request handling processes.

- User ne bola hosting Google Cloud/VPS hai. Agar Google Cloud Meta Platform Data process/store karta hai to processor hai.
- Abhi bhi unresolved: exact Google Cloud region, exact legal entity/controller name. **Invent mat karo.**
- Google Cloud DPA: https://cloud.google.com/terms/data-processing-addendum

---

## 11. References

- Meta Embedded Signup (current collection): https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup
- App Review: https://developers.facebook.com/docs/app-review/
- Screen Recording Guide: https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings
- Permissions: https://developers.facebook.com/docs/permissions
- Developer Policy: https://developers.facebook.com/devpolicy/
- YouTube tutorial: https://www.youtube.com/watch?v=zWlVkTHdP-U
- Third-party implementation idea (Meta docs se conflict ho to Meta ko prefer karo): https://github.com/vobase/vobase/blob/main/.claude/skills/whatsapp-cloud-api/references/embedded-signup.md

---

## 12. Next AI / workspace agent ke liye task prompt (copy-paste)

> Act as a senior Meta WhatsApp Tech Provider integration engineer and App Review specialist. Read this entire handoff before proposing changes.
>
> Primary goal: determine why `business_management` twice reject hua aur actual Samyoj implementation + Meta configuration + reviewer description + screencast ko same legitimate end-to-end use case par align karo.
>
> 1. Trace karo: Connect WhatsApp → Meta auth → callback → token exchange → business lookup → WABA lookup → phone lookup → DB persistence. Har stage par exact token type note karo.
> 2. Implementation ko Facebook Login for Business configuration `1304098751592068` se compare karo.
> 3. Decide karo `business_management` genuinely required hai ya nahi (intended Tech Provider use case ke liye).
> 4. Decide karo current generic `dialog/oauth` flow ko proper config-based WhatsApp Embedded Signup flow se replace/adapt karna hai ya nahi. Note karo: backend me ES v4 helper ready hai par default `META_CONNECT_FLOW=oauth` hai aur frontend sirf `url` handle karta hai, `FB.login({config_id})` wiring missing hai.
> 5. Blindly raw scope me `business_management` mat add karo. Approved permissions mat hatao. Working WhatsApp flow mat todo.
> 6. Code change se pehle root cause + minimal changes batao.
> 7. Third screencast me kya visibly demonstrate hoga, exact batao. Server-side/System User architecture agar hai to disclose karo.
> 8. Functionality, permissions, compliance, ya reviewer evidence fabricate mat karo. Third-party tutorials se zyada current Meta docs ko prefer karo.
>
> Expected output: technical diagnosis, minimal implementation plan, exact Meta Dashboard changes, exact code changes (if any), test plan, third-screencast script, final reviewer instructions.

---

## 13. Owner-facing summary (abhi ka status)

- Samyoj abhi confirmed approved independent Tech Provider **nahi** hai — `business_management` pending hai.
- 3 permissions approved, business-management API testing complete — ye part done hai.
- Dono rejections ka reason same hai: screencast business_management use case ko end-to-end demonstrate nahi karta.
- Agla submission **pehle implementation/configuration alignment problem hai, screencast problem second**.
- **Third time submit mat karo** jab tak FB Login configuration + Samyoj launch flow (legacy vs ES v4 + frontend wiring) + backend token flow + App Review evidence align na ho jayen.
- Workspace rules yaad rakho: test-deploy = yes (`bash start.sh`); customer production = NO (inbound live proof, restore on customer host, TARGET subscriptions, live transfer still open — `docs/memory/STATUS_AND_FUTURE.md`).

---

## 14. Is document me purane handoff se kya correct kiya gaya

- Purana claim "code config_id use hi nahi karta" — **partially stale**. Ab backend me `getEmbeddedSignupConfig` + `META_ES_CONFIG_ID` + `META_CONNECT_FLOW` switch hai. Par **default abhi bhi legacy OAuth hai** aur **frontend ES v4 handle nahi karta** — isliye reviewer-visible flow abhi bhi legacy hai.
- Ye correction workspace me 18-Sep-2026 ko in files ko padhkar verify ki gayi: `server/src/modules/whatsapp/meta.service.ts`, `server/src/modules/whatsapp/routes.ts`, `server/src/modules/whatsapp/legacy-oauth-url.ts`, `server/src/config/index.ts`, `client/src/hooks/useWhatsAppConnectOAuth.ts`, `client/src/pages/WhatsappCallbackPage.tsx`.
