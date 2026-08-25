# L1 Research Notes — Meta Graph API + Business Portfolio + Apps + System Users + Assets (2025–2026)

**Leaf:** `01-graph-business.md`  
**Audience:** Sonu (product + Meta literacy)  
**Scope:** Platform identity model — Graph, App, Business Portfolio, WABA, Page, Ad Account, System Users, tokens, permissions.  
**Out of scope here:** WhatsApp message send/receive deep dive (L2), template/CSW (L3), Meta **fees** / INR pricing tables (L4 — do not invent prices), Tech Provider onboarding (L5).  
**Researched:** 2026-08-25 against official `developers.facebook.com` docs.  
**Style:** English primary + Hinglish cues for retention.

---

## 0. One-line map (pehle yeh yaad rakho)

```
Meta App (developers.facebook.com)
        │  talks to Graph over HTTPS
        ▼
graph.facebook.com /vXX.0/...
        │  authorized by Access Token (+ optional appsecret_proof)
        ▼
Business Portfolio (aka Business Manager / BM)
   ├── WABA(s) → phone numbers, templates, WhatsApp analytics
   ├── Facebook Page(s) → Messenger / Page APIs
   ├── Instagram professional account(s) (usually via linked Page)
   ├── Ad Account(s) → Marketing API / ads spend
   └── Meta App(s) claimed/owned by the portfolio
```

Hinglish: **App = tumhara software identity. Portfolio = company ka box. Assets = us box ke andar ke tools (WABA, Page, ads).** Graph API un sab se baat karti hai — lekin token + permission ke bina gate band hai.

---

## 1. What the Graph API is

### 1.1 Definition

The **Graph API** is Meta’s primary HTTP API to read/write the Facebook “social graph.” Official overview:

> The Graph API is the primary way to get data into and out of the Facebook platform. It's an HTTP-based API that apps can use to programmatically query data, post new stories, manage ads, upload photos, and perform a wide variety of other tasks.

It is structured as:

| Concept | Meaning | Example |
|--------|---------|---------|
| **Node** | One object with a unique ID | User, Page, Photo, WhatsApp Business Account |
| **Edge** | Connection / collection under a node | `/{user-id}/photos`, `/{waba-id}/phone_numbers` |
| **Field** | Property of a node (or of each object in an edge) | `id`, `name`, `timezone_id` |

Docs also call nodes and edges **endpoints** (e.g. “GET the User endpoint”).

**Host:** all Graph requests go to `graph.facebook.com`.  
**Transport:** HTTPS required (HTTP/1.1). TLS 1.2+ expected for secure clients.

**Access tokens:** almost every call needs a token. Tokens identify the app, the acting principal (user / system user / page / app), and which data was granted.

Official: [Graph API Overview](https://developers.facebook.com/docs/graph-api/overview) · [Graph API home](https://developers.facebook.com/docs/graph-api)

### 1.2 Versioning (2025–2026 reality)

- Versions look like `/v26.0/{node-id}` in the path.
- Meta ships Graph versions on a **~quarterly** cadence.
- **Guarantee:** each version remains available for **at least 2 years** from release. More precisely: a version becomes unusable **two years after the subsequent version’s release date**.
- **Unversioned** calls (no `vX.Y` in path) use the version configured in App Dashboard → Settings → Advanced → Upgrade API Version. Prefer always specifying a version.
- Marketing API has a **separate** version schedule from Graph API.

**Latest Graph API version (as of research date 2026-08-25):** `v26.0` (released **July 29, 2026**).

Selected Graph API version table (from official Versions / Changelog page):

| Version | Release | Available until |
|---------|---------|-----------------|
| v26.0 | July 29, 2026 | TBD |
| v25.0 | February 18, 2026 | July 29, 2028 |
| v24.0 | October 8, 2025 | February 18, 2028 |
| v23.0 | May 29, 2025 | October 8, 2027 |
| v22.0 | January 21, 2025 | May 20, 2027 |
| v21.0 | October 2, 2024 | January 21, 2027 |
| v20.0 | May 21, 2024 | September 24, 2026 |

Note: `metadata=1` node introspection is **deprecated in Graph API v25.0**; parameter scheduled deprecated for all versions **May 19, 2026**. Prefer Graph API Explorer / reference docs.

Official: [Platform Versioning](https://developers.facebook.com/docs/graph-api/guides/versioning/) · [Versions changelog](https://developers.facebook.com/docs/graph-api/changelog/versions/) · [Changelog](https://developers.facebook.com/docs/graph-api/changelog/)

Hinglish cue: **Version pin karo** (`v24.0` / `v25.0` / `v26.0`) — warna dashboard default pe chala jaayega aur surprise break aa sakta hai.

---

## 2. Meta App vs Business Portfolio vs WABA vs Page vs Ad Account

Yeh section confusion ka asli root hai. Alag-alag IDs. Alag-alag UI. Alag-alag permissions.

### 2.1 Meta App

- Created in **Meta App Dashboard** (`developers.facebook.com/apps`).
- Has **App ID** + **App Secret** (Settings → Basic). Secret is server-only.
- App type (Business / Consumer / Gaming) + **products/use cases** you add (WhatsApp, Messenger, Instagram, Marketing API, etc.) unlock panels and permission lists.
- App can be **connected / claimed** by a Business Portfolio.
- Roles on the app (Admin, Developer, Tester, etc.) control who can develop vs who needs Advanced Access.
- **Standard vs Advanced Access** applies per permission/feature for Business/Consumer/Gaming apps:
  - **Standard:** only people with a **role on the app**.
  - **Advanced:** any app user (after App Review / Business Verification as required).

Official: [App Dashboard](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/) · [Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/) · [Create an app](https://developers.facebook.com/docs/development/create-an-app/)

Hinglish: **App = Samyoj / partner ka software passport.** Customer ka WhatsApp number App nahi hai.

### 2.2 Business Portfolio (formerly Business Manager)

Naming reality (2024–2026):

- Product UI often says **Meta Business Portfolio**.
- Docs / APIs / older articles still say **Business Manager** / **Business**.
- Same conceptual object: the **company-owned container** for Meta business assets.

WhatsApp platform docs state:

> A business portfolio allows organizations to bring all their Meta business assets together so they can be managed in one place. On the WhatsApp Business Platform, a business portfolio mainly serves as a container for WhatsApp Business Accounts (WABA). **You must have a business portfolio to use the platform.**

Also: portfolios can be **verified**; verification can unlock higher throughput / Official Business Account pathways (policy-dependent — see L6/L8).

UI entry points:

- [business.facebook.com](https://business.facebook.com) / Meta Business Suite settings
- Business Settings for people, partners, system users, assets

Official / related: [WhatsApp platform overview](https://developers.facebook.com/docs/whatsapp/overview/) · [About the platform (Business Messaging docs)](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform) · [Business Management API (WA)](https://developers.facebook.com/docs/whatsapp/business-management-api/)

Hinglish: **Portfolio = company ka locker.** Pehle “Business Manager” bolte the — ab Portfolio. Concept same.

### 2.3 WhatsApp Business Account (WABA)

- Lives **inside** a Business Portfolio.
- Holds **business phone numbers**, message templates, quality/messaging limit state, WhatsApp analytics, subscribed apps.
- One portfolio can hold **multiple** WABAs; each WABA belongs to one portfolio context for ownership/ops.
- Managed in **WhatsApp Manager** UI and via **WhatsApp Business Management API** Graph endpoints (e.g. `/{WABA-ID}`, `/{WABA-ID}/phone_numbers`, `/{WABA-ID}/message_templates`, `/{WABA-ID}/subscribed_apps`).

Hinglish: **WABA = WhatsApp ka account box.** Number WABA ke andar hota hai. Portfolio ≠ WABA ≠ phone number.

### 2.4 Facebook Page

- Public Facebook presence / messaging surface for Messenger Platform.
- Often the bridge asset for Instagram Messaging (IG professional account linked to a Page).
- Page operations typically need a **Page access token** + `pages_*` permissions.
- Page is an **asset** assigned to people / system users / partners inside the portfolio.

Official examples: [Page Conversations reference](https://developers.facebook.com/docs/graph-api/reference/page/conversations/) · [Pages API app setup](https://developers.facebook.com/docs/pages-api/create-an-app/)

Hinglish: **Page = Facebook pe business ka ghar.** Messenger Page pe chalta hai.

### 2.5 Ad Account

- Billing + campaign container for Meta ads (Marketing API).
- Owned/managed via Business Portfolio; spend and insights live here.
- Needs `ads_management` / `ads_read` style scopes when calling Marketing API — **not** the same as WhatsApp messaging permissions.
- Critical product rule for Samyoj learning: **Ad Account spend ≠ WhatsApp Cloud API conversation/message fees ≠ Samyoj SaaS plan.** Three ledgers. (Pricing details → L4; do not invent numbers here.)

Official adjacency: Marketing API docs under `developers.facebook.com/docs/marketing-api/` · System Users docs explicitly talk about ad objects.

Hinglish: **Ad Account = ads ka paisa + campaigns.** WhatsApp Cloud messaging alag bill hai (Meta WABA side).

### 2.6 Comparison cheat sheet

| Entity | What it is | Typical ID you’ll see | Primary UI |
|--------|------------|----------------------|------------|
| Meta App | Software identity calling Graph | App ID | App Dashboard |
| Business Portfolio | Company asset container | Business ID | business.facebook.com / Business Suite |
| WABA | WhatsApp account container | WABA ID | WhatsApp Manager |
| Phone number | Sender line under WABA | phone_number_id + display number | WhatsApp Manager / Graph |
| Page | FB Page asset | Page ID | Page / Business Suite |
| Ad Account | Ads billing/campaigns | act_XXXX | Ads Manager |
| System User | Non-human actor under portfolio | System user ID | Business Settings → System users |

---

## 3. System users, long-lived tokens, App Secret

### 3.1 System users

Official definition:

> System users represent servers or software making API calls to assets owned or managed by a Business Manager.

Two types (Business Management APIs):

| Type | Access pattern |
|------|----------------|
| **Admin system user** | Full access by default to assets owned by / shared with the business portfolio |
| **Employee (regular) system user** | Must be granted access per asset |

Create easiest path: Business Settings → System users (also creatable via API).

Important product nuance from Meta:

- System user tokens are for **programmatic / automated** work on business assets.
- If you need to attribute actions to a **real person** managing ads/Pages through your software, take them through **Facebook Login / OAuth** (user token), not only a system user token.

Official: [System Users](https://developers.facebook.com/docs/marketing-api/system-users/) · [Create / retrieve / update](https://developers.facebook.com/docs/marketing-api/system-users/create-retrieve-update/) · [Permissions for system users](https://developers.facebook.com/docs/marketing-api/system-users/permissions/)

Hinglish: **System User = robot employee** of the Business Portfolio. Server bolta hai “main business ki taraf se API maar raha hoon.”

### 3.2 Access token types (core set)

From Meta Access Token guide (updated Nov 25, 2025):

| Token | Purpose |
|-------|---------|
| **User access token** | Act for a person after Login dialog |
| **App access token** | Read/modify app settings; generated with App Secret server-side |
| **Page access token** | Read/write Page data; obtained via user token exchange |
| **System user access token** | Automated server actions on business assets without interactive re-login |
| **Client token** | Non-secret app identifier for some native/desktop app-level calls |

**Short-lived vs long-lived (user/page defaults):**

- Short-lived: typically **~1–2 hours** (web login).
- Long-lived: typically **~60 days**.
- Meta warns: **do not hard-depend** on these lifetimes; tokens can expire early / change.

Exchange short → long (server-side only — requires App Secret):

```http
GET https://graph.facebook.com/{version}/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-user-token}
```

Official: [Access Tokens](https://developers.facebook.com/docs/facebook-login/access-tokens) · [Get Long-Lived Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/) · [Access Tokens (docs alias)](https://developers.facebook.com/documentation/facebook-login/guides/access-tokens)

### 3.3 System user tokens: non-expiring vs 60-day expiring

From [Install Apps, Generate, Refresh, and Revoke Tokens](https://developers.facebook.com/docs/marketing-api/system-users/install-apps-and-generate-tokens/):

| Type | Lifetime | Refresh? | Meta stance |
|------|----------|----------|-------------|
| Non-expiring | Never expires (until revoked/invalidated) | No | Higher leak risk; still offered for some offline cases |
| Expiring | **60 days** | Yes — refresh within 60 days | **Recommended**; some businesses **must** use expiring tokens |

Flow:

1. Create system user under the Business Portfolio.
2. **Install** the Meta App on that system user (`POST /{system-user-id}/applications`).
3. **Assign assets** (WABA, Page, Ad Account, App) with appropriate tasks / full control as needed.
4. **Generate token** with scopes + `appsecret_proof`.
5. Prefer `set_token_expires_in_60_days=true`.

WhatsApp Cloud get-started docs commonly tell builders to generate a system user token with at least:

- `business_management`
- `whatsapp_business_management`
- `whatsapp_business_messaging`

Official WA token guide: [WhatsApp Access Tokens](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens) · [Cloud API get started / business management get started](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started/)

Hinglish: **Temporary dashboard token sirf demo hai.** Production = System User token (ideally 60-day rotating) + secret vault.

### 3.4 App Secret + `appsecret_proof`

- **App Secret** lives in App Dashboard → Settings → Basic.
- Possession of the secret lets software mint app tokens and prove server authenticity.
- **Never** put App Secret in client JS, mobile binaries, ngrok public logs, or chat paste to customers.
- `appsecret_proof` = HMAC-SHA256(access_token, app_secret). Attach as query/body param on server→Graph calls.
- Optional dashboard toggle: **Require App Secret** (Settings → Advanced → Security) — then client-direct Graph calls fail unless proxied through your backend.

Official: [Secure Requests](https://developers.facebook.com/docs/graph-api/guides/secure-requests/) · [Login Security](https://developers.facebook.com/docs/facebook-login/security)

Hinglish: **App Secret = master key.** Leak = attacker tumhari app ban ke API maar sakta hai. Proof = “mere paas secret hai” ka cryptographic stamp.

### 3.5 Facebook Login for Business (configurations)

For onboarding **other businesses’** assets (Tech Provider style), Meta provides **Facebook Login for Business** configurations where you choose:

- User token vs **System-user access token**
- Which **assets** to request (Pages, ad accounts, Instagram, WhatsApp, …)
- Which **permissions** to request

System-user token path is intended for continuous automated access to business assets.

Official: [Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/)

---

## 4. Permissions model (what Sonu must separate)

### 4.1 Standard vs Advanced Access (app-level gate)

Before a permission “works for real customers”:

1. Permission must be added / usable on the app.
2. **Standard Access** → only app-role users (dev/test).
3. **Advanced Access** → App Review (+ often Business Verification) so any customer can grant it.
4. Partner apps accessing **client** data typically need Advanced Access; missing it often surfaces as Graph error **code 200** style permission errors.

Official: [Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/) · [WhatsApp App Review (solution providers)](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review)

### 4.2 WhatsApp family (`whatsapp_business_*`)

From official WhatsApp Permissions doc:

| Permission | Needed for |
|------------|------------|
| **`whatsapp_business_management`** | WABA metadata, templates, phone numbers on WABA, analytics, webhooks about WABA changes |
| **`whatsapp_business_messaging`** | Send any WhatsApp message; receive inbound message + status webhooks |
| **`business_management`** | Programmatic access to the **business portfolio** itself (often optional if you only use Meta Business Suite UI for portfolio admin) |
| **`whatsapp_business_manage_events`** | Marketing Messages + Conversions API event tracking cases |
| **`ads_read`** | Marketing Messages + Insights API conversion metrics cases |

Official: [WhatsApp Permissions](https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions) · [Sample App Review submission](https://developers.facebook.com/docs/whatsapp/embedded-signup/app-review/sample-submission/)

Hinglish: **Management = account/templates/numbers.** **Messaging = send/receive chats.** Dono alag. Sirf ek se kaam nahi.

### 4.3 `business_management`

- Broad Business Manager / portfolio Graph access.
- Appears in Login for Business permission lists and system-user supported scopes.
- For pure WhatsApp messaging products, Meta says portfolio programmatic access is **rarely required** if Suite UI is enough — but many partner / Embedded Signup / asset-assignment flows still include it on system user tokens.

### 4.4 Pages family (`pages_*`) — Messenger / Page ops

Common messaging-related set (from Conversations / Messenger docs):

| Permission | Typical use |
|------------|-------------|
| `pages_show_list` | List Pages the user can access |
| `pages_manage_metadata` | Page settings / webhook subscriptions related |
| `pages_messaging` | Send/receive Messenger conversations |
| `pages_read_engagement` | Read engagement data |
| `pages_read_user_content` | Read user-generated content on Page |
| `pages_manage_posts` / `pages_manage_engagement` / `pages_manage_ads` / … | Publishing, moderation, Page ads tasks |

Messenger Page conversations docs require a Page access token from someone with Messaging/Moderate task + `pages_manage_metadata`, `pages_read_engagement`, `pages_messaging`.

Official: [Messenger Conversations](https://developers.facebook.com/docs/messenger-platform/conversations/) · [Page Conversations Graph ref](https://developers.facebook.com/docs/graph-api/reference/page/conversations/)

Hinglish: **`pages_*` = Facebook Page / Messenger.** WhatsApp permissions se replace nahi hote.

### 4.5 Instagram family (`instagram_*`)

Messaging-oriented common set:

| Permission | Typical use |
|------------|-------------|
| `instagram_basic` | Basic IG professional account access |
| `instagram_manage_messages` | IG Messaging API send/receive |
| `instagram_manage_comments` | Comment moderation |
| `instagram_manage_insights` | Insights |
| `instagram_content_publish` | Publishing content |
| (+ often) `pages_manage_metadata` / `pages_show_list` / `business_management` | Because IG messaging is tied through Page / business asset model |

Official: [Instagram Messaging overview](https://developers.facebook.com/docs/instagram-messaging/overview/) · [Messenger IG get started](https://developers.facebook.com/docs/messenger-platform/instagram/get-started/)

Hinglish: **IG DMs alag product surface.** Same Graph family, different permissions + usually Page link required.

### 4.6 System-user supported scopes (sample from Meta)

Official install/generate-tokens page lists many supported system-user scopes, including (non-exhaustive):  
`ads_management`, `ads_read`, `business_management`, `catalog_management`, `instagram_basic`, `instagram_manage_messages`, `pages_messaging`, `pages_manage_metadata`, `pages_show_list`, `whatsapp_business_management`, `whatsapp_business_messaging`, …

Full list: [Install apps & generate tokens](https://developers.facebook.com/docs/marketing-api/system-users/install-apps-and-generate-tokens/)

### 4.7 Permission mental model (Sonu)

```
App Review / Advanced Access  →  “customers can grant this”
Token scopes                  →  “this token was issued with these”
Asset assignment              →  “this system user may touch this WABA/Page/AdAccount”
```

Teen gates. Ek gate open hone se doosra auto-open nahi hota.

---

## 5. Official URLs (bookmark set)

### Graph / platform core

- https://developers.facebook.com/docs/graph-api
- https://developers.facebook.com/docs/graph-api/overview
- https://developers.facebook.com/docs/graph-api/guides/versioning/
- https://developers.facebook.com/docs/graph-api/changelog/
- https://developers.facebook.com/docs/graph-api/changelog/versions/
- https://developers.facebook.com/docs/graph-api/guides/secure-requests/
- https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
- https://developers.facebook.com/docs/graph-api/overview/access-levels/
- https://developers.facebook.com/tools/explorer/ (Graph API Explorer)

### Apps / access / login

- https://developers.facebook.com/docs/development/create-an-app/
- https://developers.facebook.com/docs/development/create-an-app/app-dashboard/
- https://developers.facebook.com/docs/facebook-login/access-tokens
- https://developers.facebook.com/documentation/facebook-login/guides/access-tokens
- https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/
- https://developers.facebook.com/docs/facebook-login/security
- https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
- https://developers.facebook.com/docs/permissions/reference/ (permissions reference index)

### Business / system users / assets

- https://developers.facebook.com/docs/marketing-api/system-users/
- https://developers.facebook.com/docs/marketing-api/system-users/create-retrieve-update/
- https://developers.facebook.com/docs/marketing-api/system-users/install-apps-and-generate-tokens/
- https://developers.facebook.com/docs/marketing-api/system-users/permissions/
- https://developers.facebook.com/docs/marketing-api/get-started/authentication/
- https://business.facebook.com/
- https://www.facebook.com/business/help (Business Help Center; system user how-tos)

### WhatsApp platform (identity + perms; messaging depth = L2)

- https://developers.facebook.com/docs/whatsapp/overview/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform
- https://developers.facebook.com/docs/whatsapp/business-management-api/
- https://developers.facebook.com/docs/whatsapp/business-management-api/get-started/
- https://developers.facebook.com/docs/whatsapp/business-management-api/reference/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions
- https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review
- https://developers.facebook.com/docs/whatsapp/embedded-signup/app-review/sample-submission/

### Pages / Instagram / Messenger (adjacent assets)

- https://developers.facebook.com/docs/pages-api/create-an-app/
- https://developers.facebook.com/docs/messenger-platform/conversations/
- https://developers.facebook.com/docs/graph-api/reference/page/conversations/
- https://developers.facebook.com/docs/instagram-messaging/overview/
- https://developers.facebook.com/docs/messenger-platform/instagram/get-started/

### Debug / hygiene

- https://developers.facebook.com/tools/debug/accesstoken/ (Access Token Debugger)
- https://developers.facebook.com/docs/graph-api/guides/debug/

---

## 6. Sonu ko kya samajhna hai (Hinglish short bullets)

- **Graph API** = Meta ka HTTP door (`graph.facebook.com`). Nodes/edges/fields. Version pin karo (`v26.0` latest as of Jul 2026).
- **App** = tumhari product identity (App ID + Secret). Secret kabhi client pe mat rakho.
- **Business Portfolio / Business Manager** = company ka asset locker. WhatsApp platform ke liye **zaroori**.
- **WABA** = WhatsApp ka account box andar portfolio ke. **Phone number** uske andar. Teen alag cheezein.
- **Page** = Facebook presence + Messenger. **Ad Account** = ads spend/campaigns. WhatsApp messaging se mix mat karo.
- **System User** = server wala “robot employee.” Production automation isi se.
- **Token** = permission + identity ka passport. Short (~hours) vs long (~60 days) vs system user (non-expiring **or** recommended 60-day expiring).
- **App Secret + appsecret_proof** = server authenticity. Leak = game over.
- **Permissions alag families:** `whatsapp_business_*` ≠ `pages_*` ≠ `instagram_*` ≠ `ads_*`.
- WhatsApp ke liye practically yaad: **`whatsapp_business_messaging`** (chats) + **`whatsapp_business_management`** (templates/numbers/WABA admin).
- **Standard Access** = sirf app team. **Advanced Access** = real customers (App Review).
- Teen gates: App Review → Token scopes → Asset assignment. Ek se teeno nahi khulte.
- UI naam badalte rehte hain (Business Manager → Portfolio); **concept same** — docs mein purana naam bhi milega.
- **Prices yahan mat yaad karo** — Meta fees / SaaS alag leaf (L4). Yahan sirf identity + access model.

---

## 7. Quiz (self-check)

### A. Quick recall (short answer)

1. Graph API host URL kya hai, aur request mein version kaise likhte ho?
2. Node vs edge vs field — ek-ek example do.
3. Latest Graph API version (research date Aug 2026) kaunsa hai, aur uski release date?
4. Unversioned Graph call kaunsi version use karti hai?
5. Business Portfolio aur WABA mein farq kya hai? Kaunsa kaunse ke andar hota hai?
6. Meta App ID / App Secret / System User token — teen mein se kaunsa customer ko UI mein dikhana galat hai aur kyun?
7. Short-lived vs long-lived user token ki typical lifetimes Meta kya kehti hai?
8. System user token generate karte waqt Meta ab kya recommend karti hai: non-expiring ya 60-day expiring?
9. `appsecret_proof` mathematically kya hai?
10. `whatsapp_business_messaging` vs `whatsapp_business_management` — kaunsa send/receive ke liye?

### B. Scenario / judgment

11. Sirf `pages_messaging` Advanced Access hai. Kya tum WhatsApp Cloud pe message bhej sakte ho? Kyun?
12. Tumhare paas valid WhatsApp scopes wala token hai, lekin system user ko WABA asset assign nahi kiya. Kya hoga?
13. Customer production ke liye App Dashboard ka temporary token use karna theek hai? Better pattern kya hai?
14. Marketing Ad Account insights ke liye `whatsapp_business_management` kaafi hai ya nahi?
15. Instagram Messaging ke liye aksar kaunse teen permissions + kaunsa token type docs mention karte hain?
16. Advanced Access ke liye Business Verification kab relevant hota hai?
17. Agar v20.0 expire ho gaya aur tum /v20.0 call maar rahe ho, Meta roughly kya karti hai?
18. Facebook Login for Business mein “System-user access token” kab choose karte ho?

### C. True / False

19. Business Portfolio optional hai agar tum sirf Cloud API test number use karo. (Think: platform rule vs sandbox UX — explain.)
20. App Secret ko React client env (`NEXT_PUBLIC_`) mein rakhna safe hai.
21. Graph versioning schedule Marketing API se identical hai.
22. Admin system user ko har naye Page pe manually access dena padta hai (by default).
23. `business_management` permission WhatsApp message send karne ke liye always mandatory hai.

### Answer key (compact)

1. `graph.facebook.com`; path prefix `/v26.0/...` (or other available version).  
2. Node = Page/User; edge = `/photos`; field = `name`.  
3. `v26.0`, released July 29, 2026.  
4. App Dashboard Advanced “Upgrade API Version” setting.  
5. Portfolio = company container; WABA = WhatsApp container inside it.  
6. App Secret (and usually raw long-lived tokens) — never in customer UI; enables impersonation of the app.  
7. ~1–2 hours vs ~60 days (may change / expire early).  
8. 60-day expiring (`set_token_expires_in_60_days=true`) recommended; some businesses required.  
9. HMAC-SHA256 of access token keyed with App Secret.  
10. Messaging = send/receive; Management = WABA/templates/numbers/analytics/account webhooks.  
11. No — WhatsApp needs `whatsapp_business_*`, not `pages_*`.  
12. Permission/asset errors; token alone insufficient without asset assignment.  
13. No; create system user, assign assets, generate (preferably expiring) token, store server-side.  
14. No — ads insights need ads permissions / Marketing API access.  
15. Commonly `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata` + Page access token (Messaging task).  
16. When requesting Advanced Access for permissions used by non-role users / broader production access (esp. post–Feb 2023 policy notes).  
17. Expired versions fall forward to next oldest usable version (per versioning guide).  
18. When you need continuous automated access to business assets (Pages, ad accounts, IG, etc.).  
19. False as platform rule: docs say you must have a business portfolio to use the WhatsApp Business Platform (test setups still sit under Meta’s business/app model).  
20. False.  
21. False — separate schedules.  
22. False — admin system users get full access to owned/shared assets by default; employee system users need per-asset grants.  
23. False — WA permissions doc says `business_management` only if you need programmatic portfolio access; messaging needs `whatsapp_business_messaging`.

---

## 8. Research caveats / handoff notes for master guide

- UI rename **Business Manager → Business Portfolio** is incomplete across Meta surfaces; teach both names.
- Do **not** paste pricing from blogs into the master guide; L4 must cite Meta pricing pages only.
- Samyoj-specific mapping (which env vars / OAuth path / Connect WhatsApp uses) belongs in **L14**, not here — this leaf stays platform-true.
- Deep webhook + Cloud API send path → **L2**. Tech Provider / Embedded Signup → **L5**. App Review / Dev vs Live → **L7**.

**Sources used:** official Meta developer documentation pages listed in §5 (fetched/verified 2026-08-25). No third-party price claims included.
