# Meta Business Platform — Master Learning Guide (Samyoj / Sonu)

**Audience:** Product founder building a WhatsApp-first SaaS (Samyoj), who will later add Instagram + Messenger.  
**Language:** Hinglish + English (study notes).  
**Not coding.** Code freeze on features — this is Meta literacy for customers + roadmap.  
**Compiled:** 2026-08-25 · Unlazy scope: `.unlazy/meta-learning/`  
**Status:** Internal study pack. **Does NOT mean Samyoj is customer-production-ready.**

---

## 0. 2-minute map (pehle yeh padho)

| Layer | Kya hai | Samyoj aaj |
|-------|---------|------------|
| **Meta App** | Tumhari developer app (`META_APP_ID`) | Platform credentials in `server/.env` only |
| **Business Portfolio** | Customer ka Meta Business | Connect flow ke through customer creates/links |
| **WABA** | WhatsApp Business Account | Saved on Connect; multi-tenant by `whatsappNumberId` |
| **phone_number_id** | Cloud API send/receive target | Client header `X-WhatsApp-Number-Id` |
| **Graph API** | `https://graph.facebook.com/{version}/…` | Default `META_API_VERSION=v21.0` |
| **Webhooks** | Meta → tumhara HTTPS | ngrok in test-deploy; production needs durable HTTPS |
| **Meta bill** | WABA pe Meta charges templates (soon service msgs) | Customer Meta ledger — **never fold into Samyoj plan price** |
| **Samyoj bill** | SaaS software (Razorpay TARGET later) | Separate ledger |

**Sonu rule #1:** Do invoices, do ledgers. Meta paisa ≠ Samyoj subscription.

---

## 1. Mental model — Meta objects

### 1.1 Hierarchy (simplest)

```
Meta App (Samyoj platform)
  └── Customer Business Portfolio
        ├── WABA(s)
        │     └── Phone number(s) → phone_number_id
        ├── (Future) Facebook Page(s) → Messenger
        └── (Future) Instagram Professional → IG Messaging
```

### 1.2 Tokens (yaad rakho)

| Token | Use |
|-------|-----|
| User / short-lived | OAuth code exchange ke baad |
| Long-lived user | ~60 days; Samyoj exchanges after Connect |
| System User | Partner/scale patterns; Tech Provider often uses business tokens from Embedded Signup |
| App access token | `app_id|app_secret` style calls (subscriptions, etc.) |
| Page access token | **Future** Messenger/IG (not WhatsApp Cloud send) |

### 1.3 Permissions Samyoj WhatsApp uses today

OAuth scope string in code: `whatsapp_business_management,whatsapp_business_messaging`  
(`server/src/modules/whatsapp/meta.service.ts`)

| Permission | Kya milta hai |
|------------|---------------|
| `whatsapp_business_messaging` | Send/receive messages, calls webhooks |
| `whatsapp_business_management` | Templates, WABA subscribe, quality updates, etc. |

### Official reads

- https://developers.facebook.com/docs/graph-api/overview
- https://developers.facebook.com/docs/graph-api/reference
- https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform
- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- https://developers.facebook.com/docs/permissions/reference

---

## 2. WhatsApp Cloud API — jo actually chalta hai

### 2.1 Core loop

1. Customer Connect → OAuth / Embedded Signup → WABA + phone  
2. App/WABA webhook subscribe → Meta POSTs inbound + statuses  
3. Samyoj `POST /{phone_number_id}/messages` → outbound  
4. Templates for outside 24h window; free-form only inside **Customer Service Window (CSW)**

### 2.2 Customer Service Window (CSW)

- User message/call → 24h window opens/resets  
- Window open → any message type  
- Window closed → **only approved templates**  
- Samyoj code: Meta error **131047** = CSW closed (`META_CSW_ERROR_CODE`)

Docs:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/

### 2.3 Message types (product language)

| Type | Outside CSW? | Typical use |
|------|--------------|-------------|
| Template MARKETING | Yes (paid) | Offers, campaigns |
| Template UTILITY | Yes (paid; free-in-CSW rules changing Oct 2026) | Order updates |
| Template AUTHENTICATION | Yes (paid) | OTP |
| text / image / interactive | **No** — CSW only | Inbox replies, bots |
| Calls | Separate Calling API + permissions | Samyoj calling module |

### 2.4 Webhooks (inbound proof)

Outbound localhost pe chal sakta hai. **Inbound = public HTTPS** (ngrok in test-deploy).

Samyoj subscribed fields (`META_WEBHOOK_FIELDS`):

`messages`, `calls`, `account_alerts`, `business_capability_update`, `phone_number_quality_update`, `phone_number_name_update`, `message_template_status_update`, `message_template_quality_update`, `message_template_components_update`, `template_category_update`, `user_preferences`

Docs:

- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/
- https://developers.facebook.com/docs/whatsapp/webhooks/

### 2.5 Media

Upload/download via Cloud API media edges.  
Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/

### 2.6 Templates

Create/list/delete on `/{wabaId}/message_templates`. Quality + category updates via webhooks.  
Library clone path exists in Samyoj templates module.

Docs:

- https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/
- https://developers.facebook.com/docs/whatsapp/message-templates/guidelines

---

## 3. Samyoj current Meta surface (code PoC)

> Yeh section **repo se mapped** hai — invent nahi.

### 3.1 Config

| Env | Role |
|-----|------|
| `META_APP_ID` / `META_APP_SECRET` | Platform only — **Settings UI mein nahi** |
| `META_VERIFY_TOKEN` | Webhook challenge |
| `META_API_VERSION` | Default `v21.0` |
| `META_WEBHOOK_URL` | Public callback |
| `META_REDIRECT_URI` | OAuth callback (popup path preferred) |

### 3.2 Feature → Meta call map

| Samyoj feature | Meta surface | Primary code |
|----------------|--------------|--------------|
| Connect WhatsApp OAuth | `facebook.com/{ver}/dialog/oauth` + `oauth/access_token` POST | `meta.service.ts` |
| Long-lived token | `oauth/access_token` fb_exchange_token | same |
| List WABAs / phones | `/{business}/owned_whatsapp_business_accounts`, `/{waba}/phone_numbers` | same |
| debug scopes | `debug_token` | same |
| Send message | `POST /{phone_number_id}/messages` | `meta.service.ts` + send.service |
| Templates CRUD / library | `/{waba}/message_templates` | meta.service + templates module |
| Media upload | `/{phone_number_id}/media`, Resumable uploads | meta.service |
| App webhook subscription | `POST /{appId}/subscriptions` object=`whatsapp_business_account` | meta.service |
| WABA subscribed_apps | `POST /{waba}/subscribed_apps` | meta.service |
| Mark read / typing | messages status / typing indicators | meta.service |
| Calling | `/{phone_number_id}/calls`, `/settings`, `/call_permissions` | `meta-calling.service.ts` |
| Call permission msg | messages interactive call_permission_request | calling + inbox cards |
| Webhook receive | GET challenge + POST signed body | `whatsapp/routes.ts` |
| Signature verify | `X-Hub-Signature-256` | org-meta / meta.service |

### 3.3 Explicitly NOT in Samyoj today

- Instagram Messaging API  
- Messenger / Page inbox automation  
- Marketing API / Ads Manager as product  
- Full Embedded Signup **v4** unified multi-product onboarding (deadline ~**15 Oct 2026**)  
- HttpOnly cookie auth (SAMYOJ-3) — product Phase 2  

### 3.4 Test-deploy vs “original” customer account

| Dimension | Dev / Tester / sandbox-ish | Real customer Live |
|-----------|----------------------------|--------------------|
| Meta App Mode | Development: only App Roles can auth | Live + Advanced Access for public users |
| Second Facebook login | “App not active” unless Tester/Live | Works after Live + review |
| Payment method on WABA | Test numbers may not need card | Tech Provider customers **must** add card for Cloud API billing |
| Webhook host | ngrok OK for internal | Durable HTTPS; no tunnel in production URL policy |
| Message limits / quality | Soft; small volume | Quality rating GREEN/YELLOW/RED; messaging limits |
| Template approval | Faster on test WABA sometimes | Real review + category enforcement |
| Pricing | You may not see real invoices | Per-message PMP on customer WABA |
| Ban risk | Lower volume | Marketing spam → quality drop → blocks |

Docs:

- https://developers.facebook.com/docs/development/release
- https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review
- https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/
- https://developers.facebook.com/docs/whatsapp/messaging-limits/

---

## 4. Pricing — Meta kya leti hai, Samyoj kya le sakta hai

**Canonical Samyoj writeup:** `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` + `docs/billing/15-SOURCES.md`  
**Official:** https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing  
Also: https://developers.facebook.com/docs/whatsapp/pricing/

### 4.1 Timeline (date-stamped — re-read Meta before promising customers)

| Date | Change |
|------|--------|
| Until 30 Jun 2025 | Conversation-based pricing (deprecated) |
| **1 Jul 2025** | **Per-message pricing** for delivered **templates** |
| 1 Nov 2024 onward (until Oct 2026) | Non-template service msgs free in CSW |
| Utility in CSW | Free under PMP until **1 Oct 2026**, then charged |
| **1 Oct 2026** | Service messages charged per-message (utility/auth rates; **no** volume tiers for service) |
| Rates for Oct 2026 | Meta said publish by **1 Sep 2026** |
| India INR WABA | Localization; migrate by **31 Dec 2026** or delivery risk 2027 |
| Embedded Signup v2/v3 | Deprecated **15 Oct 2026** → migrate **v4** |

Upcoming service/utility: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages

### 4.2 Who pays what

| Event | Meta charges customer WABA? | Samyoj SaaS can charge? |
|-------|----------------------------|-------------------------|
| User → business inbound | No | Software seat/plan yes |
| Marketing template delivered | Yes | SaaS yes; **do not** hide Meta fee inside plan as if free |
| Utility/auth template | Yes (rules above) | Same |
| Inbox text reply (today) | Meta $0 until Oct 2026 | SaaS yes |
| Inbox text reply (from Oct 2026) | Meta yes | SaaS yes + disclose Meta meter |
| Click-to-WhatsApp FEP 72h | Often free entry rules | Ads are separate Meta Ads bill |
| WhatsApp Business **app** coexistence send | App path free; Cloud API still billed | Careful product copy |
| Calling | Separate calling pricing | https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/ |

### 4.3 Paisa strategy (product, not marketing agency)

1. **Samyoj sells software** (inbox, bots, campaigns UX, calling AI, automations).  
2. **Meta sells delivery** on the customer’s WABA.  
3. Transparent UI: “Meta message fees bill separately on your Meta Business.”  
4. Do **not** promise “unlimited free WhatsApp” past Oct 2026.  
5. Competitors sometimes pass through Meta + markup — Samyoj TARGET docs prefer clean SaaS + honesty.

Auth-international: https://developers.facebook.com/docs/whatsapp/pricing/authentication-international-rates/  
Volume / India notes: https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/

---

## 5. Tech Provider, Embedded Signup, onboarding (customer first Connect)

### 5.1 Partner models

Overview: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview  
Also: https://developers.facebook.com/docs/whatsapp/solution-providers/  
Tech Provider get started: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers

**Tech Provider pattern (Samyoj-like):** customer owns WABA + payment method; your app gets access via Embedded Signup / OAuth.

### 5.2 Embedded Signup

- https://developers.facebook.com/docs/whatsapp/embedded-signup/  
- Versions / v4: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions  
- Blog v4 deadline: https://developers.facebook.com/blog/post/2026/05/14/embedded-signup-v4/  
- Coexistence (WA Business app + Cloud API): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users  
- FAQ: https://developers.facebook.com/docs/whatsapp/embedded-signup/faq/

**Sonu note:** Aaj Samyoj mostly **dialog/oauth** Connect. Future must plan **ES v4** before **15 Oct 2026**, especially if multi-channel (WA+IG+Messenger) ek flow mein.

### 5.3 Fastest legitimate first-time SMB path (India)

1. Facebook account (personal) with phone email  
2. Start Connect on Samyoj → Facebook Login  
3. Create / select Business Portfolio  
4. Create WABA + display name  
5. Add & verify phone (OTP SMS/voice)  
6. Accept WhatsApp terms  
7. **Add payment method** on WABA (required for real Cloud API billing as Tech Provider customer)  
8. Grant `whatsapp_business_*` to Samyoj app  
9. Pick number → Samyoj saves workspace  

**Samyoj automate kar sakta hai:** OAuth, asset discovery, webhook subscribe, token storage.  
**Customer hi karega:** Facebook login, OTP, business legal name, payment card, display name policy.

**Time expectation:** 15–45 min jab documents/OTP ready; hours/days jab Business Verification / display name rejects.

Help: Meta Business Help — “Add a credit card to your WhatsApp Business Platform account” (search from Pricing billing section).

---

## 6. Ban / policy / quality — sabse common dard

### 6.1 Policy sources

- https://www.whatsapp.com/legal/business-policy  
- https://www.whatsapp.com/legal/messaging-guidelines  
- https://www.whatsapp.com/legal/business-terms/  
- https://www.whatsapp.com/legal/business-solution-terms/  
- https://www.whatsapp.com/legal/business-terms-for-service-providers/  
- https://www.whatsapp.com/legal/?lang=en  
- https://www.facebook.com/policies/commerce  
- Brand: https://about.meta.com/brand/resources/whatsapp/whatsapp-brand/

### 6.2 Typical break points

| Risk | Symptom | Product defense |
|------|---------|-----------------|
| No opt-in marketing | Blocks, quality RED | Consent fields, opt-out, campaign fail-closed (Samyoj already strict on consent) |
| Spam templates | Template paused / quality drop | Template categories honest; frequency caps |
| Fake urgency / prohibited categories | Account restriction | Vertical policy education |
| Shared WABA misuse | Partner terms violation | Per-tenant WABA; never one WABA for unnamed future clients |
| Poor webhook reliability | Retries, delayed UX | Durable webhook + signature verify |
| CSW ignored | 131047 errors | UI: only templates when closed |
| Dev mode for customers | “App not active” | Live mode + App Review + Advanced Access |

Quality / limits:

- https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/  
- https://developers.facebook.com/docs/whatsapp/messaging-limits/  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/upcoming-messaging-limits-changes/

---

## 7. Test vs Live — Sonu ke liye practical

1. **Development Mode:** sirf App Roles (Admin/Developer/Tester) Connect kar sakte hain.  
2. Dusra Facebook account → add as **Tester** ya App **Live**.  
3. **App Review** + Advanced Access for production customers.  
4. **Business Verification** often needed for higher trust / some products.  
5. Valid OAuth Redirect URIs must include exact popup path:  
   `{origin}/settings/whatsapp/callback/popup`  
6. Test number ≠ customer’s production number economics / limits.  
7. Webhook: some events behave differently Dev vs Live — Meta docs warn Dev may miss some deliveries.

Release/App Review:

- https://developers.facebook.com/docs/development/release  
- https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review  
- https://developers.facebook.com/docs/app-review

---

## 8. Calling API (Samyoj already touches)

Samyoj: `meta-calling.service.ts` — calls, settings, call_permissions, permission request messages.

Read:

- https://developers.facebook.com/docs/whatsapp/cloud-api/calling  
- https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/  
- https://developers.facebook.com/docs/whatsapp/cloud-api/calling/user-call-permissions  

**Note:** Live agent WebRTC transfer still product-stub in Samyoj roadmap (SAMYOJ-12) — Calling AI ≠ human warm transfer production.

---

## 9. Future — Instagram Messaging (NOT built)

Mark **FUTURE SCOPE**.

Permissions typically: `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata` (+ often `pages_messaging` for page subscribe).

Docs:

- https://developers.facebook.com/docs/messenger-platform/instagram/get-started/  
- https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook/  
- https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks  

**Product implication:** Different object model (Page + IG professional), Page tokens, separate App Review, separate webhook object. ES v4 can unify onboarding of WA+IG+Messenger — plan architecture around multi-channel inbox later, don’t hack WA tables for IG mids.

---

## 10. Future — Messenger / Facebook Page automation (NOT built)

Docs:

- https://developers.facebook.com/docs/messenger-platform/overview/  
- https://developers.facebook.com/docs/messenger-platform/webhooks/  
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks  
- https://developers.facebook.com/docs/pages-api/webhooks-for-pages/  
- https://developers.facebook.com/docs/messenger-platform/send-messages  

Permissions sketch: `pages_show_list`, `pages_manage_metadata`, `pages_messaging`, `pages_read_engagement`, `business_management`.

24h messaging windows exist in Messenger ecosystem too — don’t assume WhatsApp CSW rules copy 1:1; read current Messenger policy when building.

---

## 11. Ads / Marketing API adjacency (miss mat karo, mix mat karo)

| Product | Role for Samyoj |
|---------|-----------------|
| Click-to-WhatsApp ads | Traffic into WA; FEP pricing rules | Integrate analytics later; ads bill ≠ SaaS |
| Marketing API | Campaign creation at Meta | Usually **out of scope** for inbox SaaS v1 |
| Conversions API (WhatsApp) | Measurement | Partner/ES v4 product checkbox later |
| Lead Ads | Forms on FB/IG | Different pipeline than Cloud API chat |

Pricing FEP discussed on WhatsApp Pricing page.  
Marketing API entry: https://developers.facebook.com/docs/marketing-apis/

**Rule:** Meta Ads spend never folded into Samyoj “Growth plan includes free messages.”

---

## 12. Commerce, Catalog, Flows, NFM

Useful Meta surfaces many BSPs add after inbox:

- Catalog / commerce policy: https://www.facebook.com/policies/commerce  
- WhatsApp Flows: https://developers.facebook.com/docs/whatsapp/flows  
- Cloud API interactive / flows send guides under business-messaging docs  

Samyoj has NFM/flows-related code paths in places — treat as partial; Phase C catalog items deferred unless asked.

Changelog hub: https://developers.facebook.com/docs/whatsapp/business-platform/changelog/

---

## 13. Services Meta offers that Samyoj might be “missing”

Checklist for roadmap conversations (not commitments):

1. Instagram DMs  
2. Messenger Page inbox  
3. Embedded Signup v4 multi-product  
4. Coexistence (WA Business app + API)  
5. Catalog / cart / commerce messages  
6. Flows / NFM forms  
7. Click-to-WhatsApp + CAPI measurement  
8. Marketing Messages API (MM API) where applicable  
9. Groups (platform evolving — read changelog)  
10. Official Meta Business Agent (Meta’s own AI — separate token pricing; not Samyoj)  
11. Phone number quality / messaging limit tooling UX  
12. Multi-WABA analytics that match **PMP** (not legacy conversation analytics)

---

## 14. Explaining to your team (script)

**Hinglish 60-second pitch:**

> “Customer apna WhatsApp Business Account Meta pe banata hai. Samyoj us account ko Connect karke inbox, bots, campaigns, calling tools deti hai. Message deliver hone ka bill Meta unke WABA pe karti hai — hum software ka bill alag. Template ke bina pehle user message chahiye (24h window). Marketing template bina consent ke mat bhejo, warna quality gir ke ban ho sakta hai. Abhi hum WhatsApp deep pe hain; Instagram/Messenger baad mein — alag tokens, alag App Review.”

---

## 15. 2-day study plan (no downtime guilt — deep work blocks)

### Day 1 — Platform + money + policy

| Block | Read |
|-------|------|
| 1 | This guide §§0–3 + Samyoj Connect once on localhost |
| 2 | Pricing official page + `docs/billing/17-…` |
| 3 | CSW + send messages docs; trigger 131047 mentally |
| 4 | Business policy + messaging guidelines |
| 5 | Tech Provider overview + Embedded Signup overview |
| 6 | Write 10 flashcards from Quiz below |

### Day 2 — Partner + future + customer path

| Block | Read |
|-------|------|
| 1 | Embedded Signup v4 blog + versions page |
| 2 | Test vs Live + App Review docs |
| 3 | Onboarding checklist — roleplay a first-time SMB |
| 4 | Instagram get-started + webhooks (future) |
| 5 | Messenger overview + webhooks (future) |
| 6 | Quiz self-test; list 5 product risks for Oct 2026 pricing |

---

## 16. Quiz (future quiz bank seed)

### A. Concepts

1. WABA aur phone_number_id mein farq?  
2. CSW kaun open karta hai?  
3. Window band ho to kya bhej sakte ho?  
4. Samyoj plan price mein Meta template fee fold karna kyun galat?  
5. `whatsapp_business_messaging` vs `_management`?  
6. Inbound ke liye localhost kaafi hai kya?  
7. Error 131047 ka matlab?  
8. Per-message pricing kab se?  
9. Service messages kab charge hone wale hain?  
10. Tech Provider model mein card kispe add hota hai?

### B. Samyoj-specific

11. Meta App ID UI mein dikhana allowed hai?  
12. Default Graph version env name?  
13. META_WEBHOOK_FIELDS mein se 3 naam batao.  
14. Calling kaunsi service file?  
15. Popup OAuth path kya hai?  
16. Consent omit pe optedIn true hona chahiye kya?  
17. Workers alag PM2 process?  
18. Customer production-ready claim aaj valid?

### C. Future / risk

19. ES v2 deprecate kab?  
20. IG ke 3 common permissions?  
21. Ads spend aur SaaS plan mix?  
22. Quality RED pe kya hota hai (high level)?  
23. Free entry point (FEP) kis se related?  
24. Coexistence app message Cloud CSW open karta hai kya?  
25. India WABA INR migration deadline?

**Answer keys (short):**  
1) WABA account; phone_number_id API address. 2) User inbound/call. 3) Templates only. 4) Two ledgers / honesty / Oct2026. 5) messaging=send/receive; management=templates/assets. 6) No. 7) CSW closed. 8) 1 Jul 2025. 9) 1 Oct 2026. 10) Customer WABA. 11) No. 12) META_API_VERSION. 13) any from list. 14) meta-calling.service.ts. 15) /settings/whatsapp/callback/popup. 16) No — false. 17) No — embedded. 18) No. 19) 15 Oct 2026. 20) instagram_basic, instagram_manage_messages, pages_manage_metadata. 21) Never. 22) Limits/blocks risk. 23) CTWA / Page CTA. 24) Docs: app messages do not open Cloud CSW. 25) 31 Dec 2026 migrate.

---

## 17. Sources (read here — 50+)

### Official Meta / WhatsApp

1. https://developers.facebook.com/docs/graph-api/overview  
2. https://developers.facebook.com/docs/graph-api/reference  
3. https://developers.facebook.com/docs/whatsapp/cloud-api/get-started  
4. https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform  
5. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/  
6. https://developers.facebook.com/docs/whatsapp/webhooks/  
7. https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/  
8. https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages  
9. https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/  
10. https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/  
11. https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/  
12. https://developers.facebook.com/docs/whatsapp/message-templates/guidelines  
13. https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing  
14. https://developers.facebook.com/docs/whatsapp/pricing/  
15. https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing  
16. https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages  
17. https://developers.facebook.com/docs/whatsapp/pricing/authentication-international-rates/  
18. https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/  
19. https://developers.facebook.com/docs/whatsapp/cloud-api/calling  
20. https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/  
21. https://developers.facebook.com/docs/whatsapp/cloud-api/calling/user-call-permissions  
22. https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview  
23. https://developers.facebook.com/docs/whatsapp/solution-providers/  
24. https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers  
25. https://developers.facebook.com/docs/whatsapp/embedded-signup/  
26. https://developers.facebook.com/docs/whatsapp/embedded-signup/faq/  
27. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/versions  
28. https://developers.facebook.com/blog/post/2026/05/14/embedded-signup-v4/  
29. https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users  
30. https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers/  
31. https://developers.facebook.com/docs/whatsapp/messaging-limits/  
32. https://developers.facebook.com/documentation/business-messaging/whatsapp/upcoming-messaging-limits-changes/  
33. https://developers.facebook.com/docs/whatsapp/business-platform/changelog/  
34. https://developers.facebook.com/docs/whatsapp/flows  
35. https://developers.facebook.com/docs/development/release  
36. https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review  
37. https://developers.facebook.com/docs/app-review  
38. https://developers.facebook.com/docs/permissions/reference  
39. https://developers.facebook.com/docs/messenger-platform/overview/  
40. https://developers.facebook.com/docs/messenger-platform/webhooks/  
41. https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks  
42. https://developers.facebook.com/docs/messenger-platform/send-messages  
43. https://developers.facebook.com/docs/messenger-platform/instagram/get-started/  
44. https://developers.facebook.com/docs/messenger-platform/instagram/features/webhook/  
45. https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks  
46. https://developers.facebook.com/docs/pages-api/webhooks-for-pages/  
47. https://developers.facebook.com/docs/marketing-apis/  
48. https://www.whatsapp.com/legal/?lang=en  
49. https://www.whatsapp.com/legal/business-policy  
50. https://www.whatsapp.com/legal/messaging-guidelines  
51. https://www.whatsapp.com/legal/business-terms/  
52. https://www.whatsapp.com/legal/business-solution-terms/  
53. https://www.whatsapp.com/legal/business-terms-for-service-providers/  
54. https://www.facebook.com/policies/commerce  
55. https://about.meta.com/brand/resources/whatsapp/whatsapp-brand/  
56. https://business.whatsapp.com/  
57. https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers/  
58. https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users/  

### Samyoj internal (repo)

59. `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`  
60. `docs/billing/15-SOURCES.md`  
61. `docs/billing/08-USAGE-AND-META-COSTS.md`  
62. `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md`  
63. `docs/DEV_SETUP_CHECKLIST.md`  
64. `docs/memory/STATUS_AND_FUTURE.md`  
65. `server/src/modules/whatsapp/meta.service.ts`  
66. `server/src/modules/calling/meta-calling.service.ts`  
67. `.unlazy/meta-learning/PLAN.md`  
68. `.cursor/agents/meta-whatsapp-researcher.md`  
69. `.cursor/agents/meta-omnichannel-researcher.md`  
70. `.cursor/agents/meta-samyoj-surface-mapper.md`  

### Secondary explainers (not rate cards)

71. https://support.zendesk.com/hc/en-us/articles/11113277351322-Announcing-upcoming-changes-to-WhatsApp-Business-messaging-pricing  

---

## 18. Note points — notebook checklist

- [ ] Two ledgers drawn on paper  
- [ ] CSW timeline sketched  
- [ ] Oct 2026 service pricing written in own words  
- [ ] Tech Provider vs Solution Partner one sentence each  
- [ ] ES v4 deadline in calendar  
- [ ] Dev vs Live customer story  
- [ ] Ban top-5 for Indian SMB vertical you sell to  
- [ ] Samyoj Meta endpoint map verbally explained to teammate  
- [ ] IG/Messenger “not yet” boundary clear  
- [ ] Quiz A+B+C self score ≥ 80%  

---

## 19. Honest boundary

Yeh document **Meta literacy + Samyoj surface mapping** complete karta hai.  
Yeh **customer production go-live certificate** nahi hai. Auth cookies, TARGET billing, live transfer, ES v4 engineering — alag Phase 2 kaam.

Study ke baad jab ready ho: cookies (SAMYOJ-3) / ES v4 / IG spike — alag explicit task do.

---

---

## Appendix A — Deep research leaves (all 15 landed)

Master guide = day-to-day spine. In-depth notes (URLs + quizzes) live here:

| # | Topic | Path |
|---|--------|------|
| 01 | Graph + Business objects | [`.unlazy/meta-learning/research-notes/01-graph-business.md`](../.unlazy/meta-learning/research-notes/01-graph-business.md) |
| 02 | WhatsApp Cloud API | [`.unlazy/meta-learning/research-notes/02-whatsapp-cloud.md`](../.unlazy/meta-learning/research-notes/02-whatsapp-cloud.md) |
| 03 | Templates + CSW | [`.unlazy/meta-learning/research-notes/03-templates-csw.md`](../.unlazy/meta-learning/research-notes/03-templates-csw.md) |
| 04 | Pricing (two ledgers) | [`.unlazy/meta-learning/research-notes/04-pricing.md`](../.unlazy/meta-learning/research-notes/04-pricing.md) |
| 05 | Tech Provider + ES v4 | [`.unlazy/meta-learning/research-notes/05-tech-provider.md`](../.unlazy/meta-learning/research-notes/05-tech-provider.md) |
| 06 | Policy / bans | [`.unlazy/meta-learning/research-notes/06-policy-bans.md`](../.unlazy/meta-learning/research-notes/06-policy-bans.md) |
| 07 | Test vs Live | [`.unlazy/meta-learning/research-notes/07-test-vs-live.md`](../.unlazy/meta-learning/research-notes/07-test-vs-live.md) |
| 08 | Onboarding fast path | [`.unlazy/meta-learning/research-notes/08-onboarding.md`](../.unlazy/meta-learning/research-notes/08-onboarding.md) |
| 09 | Calling API | [`.unlazy/meta-learning/research-notes/09-calling.md`](../.unlazy/meta-learning/research-notes/09-calling.md) |
| 10 | Instagram (future) | [`.unlazy/meta-learning/research-notes/10-instagram.md`](../.unlazy/meta-learning/research-notes/10-instagram.md) |
| 11 | Messenger (future) | [`.unlazy/meta-learning/research-notes/11-messenger.md`](../.unlazy/meta-learning/research-notes/11-messenger.md) |
| 12 | Ads adjacency | [`.unlazy/meta-learning/research-notes/12-ads-adjacency.md`](../.unlazy/meta-learning/research-notes/12-ads-adjacency.md) |
| 13 | Commerce / Flows | [`.unlazy/meta-learning/research-notes/13-commerce-flows.md`](../.unlazy/meta-learning/research-notes/13-commerce-flows.md) |
| 14 | Samyoj Meta code map | [`.unlazy/meta-learning/research-notes/14-samyoj-surface.md`](../.unlazy/meta-learning/research-notes/14-samyoj-surface.md) |
| 15 | 2-day curriculum + 52 Q quiz | [`.unlazy/meta-learning/research-notes/15-curriculum-quiz.md`](../.unlazy/meta-learning/research-notes/15-curriculum-quiz.md) |

**Suggested depth order after master §0–4:** `15` plan → `01` → `02` → `03` → `04` → `05` → `07` → `08` → `06` → `14` → (`09`) → future `10`/`11`/`12`/`13`.

---

*End of master guide.*
