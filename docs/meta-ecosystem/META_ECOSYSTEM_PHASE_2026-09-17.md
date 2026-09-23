# Samyoj Meta Ecosystem — Phase Research & Integration Plan

**Status:** Research Complete — 2026-09-17  
**Scope:** Meta Ads, Instagram, Facebook Pages — as extensions of the existing WhatsApp CRM platform  
**Samyoj codebase state:** WhatsApp-only today; 25+ Meta endpoints; OAuth state machine; durable webhooks; no Instagram/Facebook/Ads code exists yet

---

## 1. Existing Meta Integration Surface (What's Already Built)

### 1.1 Authentication & Token Management


| Component               | File                                                         | What it does                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Platform credentials    | `server/.env` (`META_APP_ID`, `META_APP_SECRET`)             | Source of truth for all Meta API calls                                                                                                                                                           |
| Org credential resolver | `server/src/modules/whatsapp/org-meta.service.ts`            | Falls back to per-org secrets only if platform env unset; strips leftover org secrets                                                                                                            |
| OAuth state machine     | `server/src/modules/whatsapp/connect-oauth-state.ts`         | JWT-signed state (30-min TTL), redirect URI whitelist, `/settings/whatsapp/callback` paths                                                                                                       |
| Token exchange          | `server/src/modules/whatsapp/meta.service.ts`                | POSTs `client_secret` in body (not URL); code → short-lived → long-lived; expiry only monitored via `debug_token.expires_at → WhatsappNumber.tokenExpiresAt` (no auto-refresh, no 60-day assert) |
| Token storage           | `WhatsappNumber.accessToken` (AES-256-GCM encrypted at rest) | One token per connected number; pending OAuth token in Redis (`whatsapp:connect:pending:*`, 15m TTL); `encryptToken('')` wipe on disconnect                                                      |
| Webhook verification    | `org-meta.service.ts` `verifyWebhookSignatureForPayload()`   | HMAC-SHA256; tries platform + org owning `metadata.phone_number_id` only (WABA-only payloads = platform-only); non-prod allows unsigned bypass                                                   |




### 1.2 Current Meta API Calls (25+ endpoints)


| Area      | Endpoints                                                                                                                                                                           | Purpose                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| OAuth     | `POST /oauth/access_token` (code → short-lived), `POST /oauth/access_token` (`fb_exchange_token` → long-lived), `GET /debug_token`                                                  | Token exchange + expiry inspect               |
| Messages  | `POST /{phone-id}/messages` (send/text/template/media/interactive, typing, mark-read, call-permission-request)                                                                      | Send/receive WhatsApp messages                |
| Templates | `GET/POST/DELETE /{waba-id}/message_templates`, `GET /message_template_library`                                                                                                     | Template CRUD, library clone, sync            |
| Webhooks  | `GET/POST /{app-id}/subscriptions`, `POST /{waba-id}/subscribed_apps` (incl. `override_callback_uri`)                                                                               | Subscribe/unsubscribe webhook events          |
| Media     | `GET /{media-id}` + CDN download, `POST /{phone-id}/media`, `POST /{app-id}/uploads` + `POST /{upload-session-id}`                                                                  | Download/upload media, template header upload |
| Discovery | `GET /me/businesses`, `GET /{business-id}/owned_whatsapp_business_accounts`, `GET /{business-id}/client_whatsapp_business_accounts`, `GET /{waba-id}/phone_numbers`                 | WABA + phone discovery on connect             |
| Business  | `GET /{waba-id}?fields=primary_funding_id`, `GET /{phone-id}?fields=quality_rating,official_business_account,whatsapp_business_manager_messaging_limit,is_on_biz_app,platform_type` | Health, quality, limits                       |
| Analytics | `GET /{waba-id}?fields=conversation_analytics…` (legacy shape — live bill is PMP/invoice, not this poll)                                                                            | Conversation analytics                        |
| Flows     | `GET /{waba-id}/flows`, `GET /{flow-id}`, `POST /{waba-id}/flows`, `POST /{flow-id}`, `POST /{flow-id}/publish`, `POST /{waba-id}/flows/public_key`                                 | WhatsApp Flows management                     |
| Catalog   | `GET /{waba-id}/product_catalogs`, `GET /{catalog-id}/products`                                                                                                                     | WA catalog sync (not Shops orders)            |
| Calling   | `POST /{phone-id}/calls`, `GET/POST /{phone-id}/settings`, `GET /{phone-id}/call_permissions`                                                                                       | Voice call signaling                          |




### 1.3 Webhook Infrastructure

- **Durable envelope pattern:** `ProviderWebhookEvent` table stores raw ciphertext + dedup key. Two layers: (a) envelope `field='envelope'`, `eventKey=envelope_{sha256}` + ciphertext (`webhook-accept.ts`); (b) per-field `eventKey={waba}:{field}:{sha256}` without ciphertext (`webhook-dispatcher.ts`). Unique is `(organizationId, eventKey)`.
- **BullMQ queues:** `webhookQueue.add('process-webhook', …)` → `webhook.processor.ts` handles `field==='messages'` only (fan-out to automation, inbox, campaigns); non-message fields via `dispatchNonMessageWebhookFields`; `calls` inline via `call.processor` (not queued).
- **Idempotency:** Envelope hash + BullMQ `jobId` + `P2002` unique + `Message.metaMessageId` + `UnmatchedProviderStatus` + 60s stale-claim reclaim — not just `eventKey + metaMessageId`.
- **Signature verification:** Multi-secret (platform + org owning `metadata.phone_number_id`); non-prod allows unsigned bypass.



### 1.4 What's Missing (Blockers)


| Gap                                                          | Impact                                              | Severity             |
| ------------------------------------------------------------ | --------------------------------------------------- | -------------------- |
| **No Instagram/Facebook code**                               | Cannot connect IG or Pages                          | Blocker              |
| **No Meta Ads code**                                         | Cannot manage ads                                   | Blocker              |
| **Conversation model tightly coupled to** `whatsappNumberId` | Cannot store IG DMs or FB messages without refactor | Architecture blocker |
| **Contact model scoped to** `(org, whatsappNumberId, phone)` | Cannot unify cross-platform contacts                | Architecture blocker |
| **No platform-agnostic** `Channel` **concept**               | Inbox assumes single channel                        | Architecture blocker |


---



## 2. Meta Ads (Marketing API) — Research Summary



### 2.1 Current State: Marketing API v26.0 (released Jul 29, 2026 — Graph + Marketing both v26)



### 2.2 Authentication


| Permission              | Purpose                                  | Access Level                                     |
| ----------------------- | ---------------------------------------- | ------------------------------------------------ |
| `ads_read`              | Read ad performance, insights, audiences | Standard (own accounts) / Advanced (third-party) |
| `ads_management`        | Create, update, pause, delete ads        | Standard (own) / Advanced (third-party)          |
| `business_management`   | Manage Business Manager assets           | Advanced (App Review required)                   |
| `pages_read_engagement` | Access Page data (Lead Ads webhooks)     | Standard                                         |
| `pages_manage_metadata` | Subscribe Page to webhooks               | Standard                                         |
| `leads_retrieval`       | Read Lead Ads data                       | Advanced (App Review required)                   |


**SaaS model:** On-Behalf-Of (OBO) flow — partner BM admin system user + client BM admin → client BM system user token. System user tokens don't expire. Client retains ownership.

### 2.3 What CAN Be Built


| Capability                                      | Feasibility | Value for Samyoj                                   |
| ----------------------------------------------- | ----------- | -------------------------------------------------- |
| Lead Ads → auto-create contacts                 | ★★★★★       | Highest — canonical CRM integration                |
| Audience sync (CRM contacts → Custom Audiences) | ★★★★        | Upload hashed phones/emails, create lookalikes     |
| Ad performance dashboard                        | ★★★         | Poll Insights API, aggregate in unified view       |
| CAPI Conversion Leads                           | ★★★★        | Send CRM deal stages back to Meta for optimization |
| Automated ad creation from CRM                  | ★★★         | Lead gen campaigns from audience segments          |
| Lookalike from high-value customers             | ★★★         | Seed from best WhatsApp contacts                   |
| Automated Rules (pause/scale)                   | ★★          | Auto-optimize underperforming campaigns            |
| Ad Preview API                                  | ★★          | Show previews before campaign creation             |




### 2.4 What CANNOT Be Build (Hard Limits)

- Cannot create new Business Managers via API (Meta UI only). Ad-account create API exists but capped (~5 per business) — keep account creation in Meta UI for v1
- Cannot run ads — billing setup required outside API
- Cannot create saved audiences (only custom/lookalike)
- Special Ad Categories (HOUSING, EMPLOYMENT, FINANCIAL) impose hard targeting limits (+ v26: new/copied constrained ad sets must explicitly set `advantage_audience` 1/0)
- Political ads require identity verification + authorization disclaimer
- v26 removals (do not plan on these): Instagram Explore Feed placement removed; Messenger Stories `story` silently stripped from `messenger_positions`; poll-ad creation rejected; delivery-estimate fields (`daily_outcomes_curve`, `budget_guardrail`, `estimate_dau`) removed; legacy protocol (`pretty`/`debug`/`date_format`/`?ids=`/ETag) removed



### 2.5 Rate Limits


| Tier                  | Points | Decay | Block Time |
| --------------------- | ------ | ----- | ---------- |
| Development (Limited) | 60     | 300s  | 300s       |
| Full Access           | 9000   | 300s  | 60s        |


- Read = 1 point, Write = 3 points
- Hard cap: 100 QPS (mutations only, per app+account)
- Budget change limit: 4 per ad set per hour
- Maintain Full Access: 500+ calls/15 days, <15% error rate



### 2.6 Lead Ads Webhook Architecture

```
Meta → HTTPS endpoint → Validate → Fetch leadgen_id → Map fields → Create Samyoj contact
  ↓
Daily bulk reconciliation (fallback)
```

**Real-time webhook flow:**

1. Subscribe Page to `leadgen` webhook: `POST /{page-id}/subscribed_apps?subscribed_fields=leadgen`
2. Receive ping with `leadgen_id`, `page_id`, `form_id`, `adgroup_id`
3. Fetch lead: `GET /{GRAPH_API_VERSION}/{leadgen_id}?fields=created_time,ad_id,form_id,field_data`
4. Map form fields → Samyoj contact

**Conversions API (CAPI) for CRM:**

```http
POST https://graph.facebook.com/{GRAPH_API_VERSION}/{PIXEL_ID}/events
{
  "event_name": "Sales Opportunity",
  "event_time": 1617693833,
  "user_data": {"lead_id": 1234567890123456},
  "action_source": "system_generated",
  "custom_data": {"lead_event_source": "Samyoj"}
}
```

- Send funnel stages: Lead → MQL → SQL → Opportunity → Converted → Closed Won/Lost
- Deduplication via `event_id` across Pixel + CAPI



### 2.7 Data Retention Limits


| Data Type               | Retention |
| ----------------------- | --------- |
| Total values            | 37 months |
| Unique-count breakdowns | 13 months |
| Hourly breakdowns       | 13 months |
| Frequency breakdowns    | 6 months  |


---



## 3. Instagram Graph API — Research Summary



### 3.1 Two API Paths (Critical Decision)


| Path                                   | Login Type                   | Permissions                                                                                                                                  | Capabilities                                                       | Best For                    |
| -------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------- |
| **Instagram API with Instagram Login** | Business Login for Instagram | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_messages`, `instagram_business_manage_comments` | Full DMs, comments, publishing, insights, hashtag search, shopping | Samyoj (SaaS, multi-tenant) |
| Instagram API with Facebook Login      | Facebook Login for Business  | `instagram_basic`, `instagram_content_publish`, `instagram_manage_messages`, `instagram_manage_comments`                                     | Same but requires linked Facebook Page                             | Legacy, single-business     |


**Execution status:** Do not treat either login path as final in this older research note. The current execution pack uses Page-linked Facebook Login first; revisit Instagram Login only after App Review and dashboard capabilities are confirmed.

### 3.2 What CAN Be Built


| Capability                | Endpoint                                                                     | Feasibility                                                    |
| ------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Send/receive DMs**      | `POST /{GRAPH_API_VERSION}/{ig-id}/messages`                                 | ✅ Text, image, video, audio, files, stickers, likes            |
| **Comments management**   | `GET /{ig-id}/comments`, `POST /{comment-id}/replies`                        | ✅ Read, reply, hide, delete                                    |
| **Private replies**       | Page-linked path: `POST /{page-id}/messages` (recipient = commenter)         | ✅ Reply to post comment; confirm the path for the chosen login/API surface |
| **Content publishing**    | `POST /{ig-id}/media`, `POST /{ig-id}/media_publish`                         | ✅ Feed posts, carousels, Reels                                 |
| **Stories**               | Supported via Content Publishing (`media_type=STORIES`, no caption/stickers) | ✅ CAN                                                          |
| **Hashtag search**        | `GET /ig_hashtag_search`                                                     | ⚠️ Mostly Facebook-Login path — DOUBT for Instagram-Login-only |
| **Hashtag recent media**  | `GET /{hashtag-id}/recent_media`                                             | ⚠️ Same path caveat — DOUBT for Instagram-Login-only           |
| **Insights**              | `GET /{ig-id}/insights`                                                      | ✅ Impressions, reach, engagement, follower demographics        |
| **Shopping/Product tags** | Not supported via Content Publishing API                                     | ❌ Hard limit                                                   |
| **Auto-reply / chatbot**  | Same DM endpoint                                                             | ✅ Within 24-hour window                                        |
| **Human agent handoff**   | Conversation Routing APIs                                                    | ✅ Required by policy                                           |




### 3.3 Instagram Messaging — Deep Dive

**DM Capabilities:**

- Text, image, video, audio, files, stickers (`like_heart`), post shares (`MEDIA_SHARE`)
- Reactions: `react` / `unreact` with any emoji
- Quick replies, persistent menu, ice breakers
- Generic templates, button templates, product templates
- Story mention auto-reply

**24-Hour Messaging Window:**

- Customer messages open a 24-hour window for business replies
- After 24 hours: do not assume WhatsApp templates or generic automation tags apply
- Human escalation and any permitted post-window path require the current Instagram policy, feature, and review gates
- Group messaging not supported

**Inbox folders:** Primary, General, Requests — API can read but folder info not included in webhooks

**Webhooks:** Real-time via `instagram` topic → `comments`, `mentions`, `messages`, `messaging_postbacks`, `messaging_seen`, `story_insights`, `live_comments`, `message_reactions`

### 3.4 Content Publishing — Deep Dive


| Media Type   | Supported                                     | Notes                            |
| ------------ | --------------------------------------------- | -------------------------------- |
| Single image | ✅                                             | JPEG only, public URL required   |
| Single video | ✅                                             | Resumable upload for large files |
| Carousel     | ✅                                             | Up to 10 images/videos           |
| Reels        | ✅                                             | `media_type=REELS`               |
| Stories      | ✅ (`media_type=STORIES`, no caption/stickers) | CAN                              |
| `IGT`        | ❌                                             | Deprecated                       |


**Permissions:** `instagram_content_publish`, `instagram_basic` (or `instagram_business_content_publish`, `instagram_business_basic` for Instagram Login path)

**Rate limit:** 50 posts per 24 hours per account (across all media types)

**Publishing flow:**

```
POST /{ig-id}/media → media container ID
POST /{ig-id}/media_publish → published media ID
GET /{ig-container-id}?fields=status_code → check status
```



### 3.5 What CANNOT Be Built (Hard Limits)

- **No personal accounts** — only Professional (Business/Creator)
- **No proactive messaging outside 24h window** (only `HUMAN_AGENT` tag for humans — automation tags `CONFIRMED_EVENT_UPDATE` / `POST_PURCHASE_UPDATE` / `ACCOUNT_UPDATE` return error 100 since 27 Apr 2026; never code invented `AGENT_PAUSED`)
- **No likes, follows, or comments automation on other users' content**
- **No shopping tags** via Content Publishing API
- **Group messaging not supported**
- **No reel/stories insights breakdown by individual user**
- **Creator accounts need to send one API request before receiving webhooks**



### 3.6 Rate Limits

- **Business Use Case (BUC):** `4800 × engaged users` per 24-hour window
- **Error code:** `80002` when rate limit exceeded
- **Per-user limit:** 200 calls/hour for some endpoints
- **Monitor headers:** `X-Business-Use-Case-Usage`, `X-Ad-Account-Usage`

---



## 4. Facebook Pages / Graph API — Research Summary



### 4.1 Current State: Graph API v26.0



### 4.2 Authentication


| Permission                | Purpose                                   | Access Level |
| ------------------------- | ----------------------------------------- | ------------ |
| `pages_manage_posts`      | Create, edit, delete Page posts           | Standard     |
| `pages_read_engagement`   | Access Page posts, comments, reactions    | Standard     |
| `pages_manage_metadata`   | Manage Page settings, webhooks            | Standard     |
| `pages_messaging`         | Send/receive Page messages (Messenger)    | Standard     |
| `pages_show_list`         | List Pages user manages                   | Standard     |
| `pages_read_user_content` | Read user-generated content on Page       | Standard     |
| `publish_pages`           | Publish as Page (deprecated for new apps) | Standard     |


**Token type:** Page Access Token — can be non-infinite (never expires) when obtained with a long-lived user token.

### 4.3 What CAN Be Built


| Capability                     | Endpoint                                                 | Feasibility                                       |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------- |
| **Page posts CRUD**            | `POST /{page-id}/feed`                                   | ✅ Text, links, photos, videos, scheduled posts    |
| **Post insights**              | `GET /{post-id}/insights`                                | ✅ Impressions, reach, engagement, reactions       |
| **Comments management**        | `GET /{post-id}/comments`, `POST /{comment-id}/comments` | ✅ Read, reply, hide, delete                       |
| **Page messaging (Messenger)** | `POST /{page-id}/messages`                               | ✅ Same as Instagram DM but via Messenger Platform |
| **Page insights**              | `GET /{page-id}/insights`                                | ✅ Follower growth, demographics, post performance |
| **Lead Ads forms**             | `GET /{page-id}/leadgen_forms`                           | ✅ List and read lead forms                        |
| **Events management**          | `GET /{page-id}/events`                                  | ✅ Create, read, update events                     |
| **Photos/videos/albums**       | `POST /{page-id}/photos`, `POST /{page-id}/videos`       | ✅ Upload and manage media                         |
| **Page tabs & custom tabs**    | `GET /{page-id}/tabs`                                    | ✅ Manage tab configuration                        |
| **Facebook Live**              | `POST /{page-id}/live_videos`                            | ✅ Create and manage live streams                  |
| **Reviews/ratings**            | `GET /{page-id}/ratings`                                 | ✅ Read page reviews                               |
| **Shops / Commerce**           | Commerce API endpoints                                   | ✅ Product catalog, orders, inventory              |
| **WhatsApp-Page linking**      | UI only                                                  | ❌ Cannot link via API                             |




### 4.4 Messenger Platform — Deep Dive

**24-Hour Messaging Window:** Same as Instagram — 24h window for replies, then only templates/tags.

**Message Tags (most automation tags dead April 2026):**

- `HUMAN_AGENT` (7-day window, humans only) — requires App Review + Business Verification — survives
- `CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`, `ACCOUNT_UPDATE` → **error 100 since 27 Apr 2026** — do not code
- Never invent `AGENT_PAUSED` — no such tag

**Conversation Routing:** Replaced Handover Protocol for multi-app inbox

- Primary receiver app → secondary receiver app
- Samyoj would be primary receiver (automated experience) → hand off to human agent

**Human Agent Requirement:** All automated messaging apps MUST provide escalation path to human agent.

### 4.5 Facebook Shops / Commerce API — ⚠️ ORDER API DEAD (v26)

Commerce Order Management (47 endpoints) blocked on v26 since Jul 29, 2026, removed on ALL versions Oct 27, 2026, no replacement. **Shops order management = hard CANNOT. Keep only WA Catalog sync** (`GET /{waba-id}/product_catalogs`, `GET /{catalog-id}/products` → Samyoj `CatalogProduct`).


| Capability         | Endpoint                        | Feasibility                                  |
| ------------------ | ------------------------------- | -------------------------------------------- |
| Catalog management | Commerce Manager API            | ✅ Product feed, batch API, real-time updates |
| Inventory sync     | Catalog Batch API               | ✅ Near real-time via `/catalog_id/batch`     |
| Order management   | Order API                       | ✅ Read orders, update status                 |
| Product sets       | Product Set Collection API      | ✅ Create collections, publish to shops       |
| Checkout           | Platform checkout or custom URL | ✅                                            |
| Instagram Shopping | Commerce API                    | ✅ Product tags on posts                      |


**Key integration:** Samyoj already has `CatalogProduct` model and `catalog/` module — extends naturally to Facebook/Instagram Shops.

### 4.6 What CANNOT Be Built (Hard Limits)

- **Cannot link WhatsApp to Facebook Page via API** — UI only
- **Cannot manage personal profiles** — Pages only
- **Cannot automate likes, shares, or follows**
- **Cannot publish to personal profiles**
- **Group messaging not supported**
- **Cannot create saved audiences** (only custom/lookalike via Marketing API)
- **Page messaging deprecated for new apps** — must use Messenger Platform



### 4.7 Insights — June 2026 Metric Changes


| Old Metric    | New Metric     | Notes                                        |
| ------------- | -------------- | -------------------------------------------- |
| `Impressions` | `Views`        | Now counts any view, not just ad impressions |
| `Reach`       | `Unique Views` | Clarified naming                             |




### 4.8 Rate Limits

- **BUC formula:** `4800 × engaged users` per 24-hour window
- **Per-app rate limit:** 200 calls/hour per user (some endpoints)
- **Page token calls:** Different rate limit bucket than user token calls

---



## 5. Cross-Platform Analytics Dashboard



### 5.1 Current Samyoj Analytics

- `server/src/modules/analytics/` — conversation mix, daily series, reports
- `ConversationCharge` model tracks per-conversation Meta billing
- `PlatformAdmin` has org health snapshots with counts (contacts, messages, calls, AI tokens)



### 5.2 Unified Dashboard Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Unified Analytics Dashboard              │
├─────────────┬─────────────┬─────────────┬───────────────┤
│   WhatsApp  │   Instagram │   Facebook  │   Meta Ads    │
│   Metrics   │   Metrics   │   Metrics   │   Metrics     │
├─────────────┼─────────────┼─────────────┼───────────────┤
│ • Messages  │ • DMs       │ • Messages  │ • Impressions │
│ • Sent/Recv │ • Comments  │ • Comments  │ • Clicks      │
│ • Response  │ • Posts     │ • Posts     │ • Spend       │
│   time      │ • Reach     │ • Reach     │ • Leads       │
│ • CSAT      │ • Followers │ • Followers │ • ROAS        │
│ • Calls     │ • Story     │ • Shops     │ • CPL         │
│ • AI usage  │   insights  │   orders    │ • Funnel      │
│ • Conversa- │ • Hashtag   │ • Events    │   stages      │
│   tion mix  │   mentions  │             │               │
├─────────────┴─────────────┴─────────────┴───────────────┤
│  Filters: Date range | Channel | Campaign | Ad Account   │
│  Aggregations: Daily/Weekly/Monthly | YoY comparison     │
│  Export: CSV | PDF | Scheduled email reports            │
└─────────────────────────────────────────────────────────┘
```



### 5.3 Data Sources for Each Channel


| Channel        | Data Source                      | API Endpoint               | Sync Frequency              |
| -------------- | -------------------------------- | -------------------------- | --------------------------- |
| WhatsApp       | Conversation + Message tables    | Webhook (real-time)        | Real-time                   |
| Instagram      | Instagram Insights API           | `GET /{ig-id}/insights`    | Daily (or hourly via cron)  |
| Instagram      | Instagram Comments/Mentions API  | Webhooks (real-time) + API | Real-time                   |
| Instagram      | Instagram Content Publishing API | `GET /{ig-id}/insights`    | Per-post                    |
| Facebook Pages | Page Insights API                | `GET /{page-id}/insights`  | Daily                       |
| Facebook Shops | Commerce API                     | Commerce endpoints         | Hourly                      |
| Meta Ads       | Insights API                     | `GET /act_{id}/insights`   | Hourly (or async for large) |
| Meta Ads       | Ad Account API                   | `GET /me/adaccounts`       | On connect                  |




### 5.4 Key Metrics to Track


| Metric            | WhatsApp                 | Instagram                 | Facebook                      | Meta Ads              |
| ----------------- | ------------------------ | ------------------------- | ----------------------------- | --------------------- |
| **Reach**         | Unique contacts reached  | Unique Views              | Unique Views                  | Reach                 |
| **Engagement**    | Messages sent/received   | Likes + comments + shares | Reactions + comments + shares | CTR, CPC              |
| **Conversations** | Active conversations     | Active DMs                | Active conversations          | N/A                   |
| **Leads**         | N/A                      | DM inquiries              | Leadgen form submissions      | Lead Ads leads        |
| **Revenue**       | Commerce orders          | Commerce orders           | Commerce orders               | Ad-attributed revenue |
| **Response time** | First response time      | First response time       | First response time           | N/A                   |
| **Resolution**    | Closed conversations     | Resolved DMs              | Closed conversations          | Conversions           |
| **CSAT**          | Post-conversation rating | N/A                       | N/A                           | N/A                   |




### 5.5 Implementation Approach

1. **New** `AnalyticsEvent` **model** — platform-agnostic event log (channel, eventType, value, timestamp, metadata)
2. **ETL layer** — periodic jobs that pull from Meta APIs and normalize to `AnalyticsEvent`
3. **Unified dashboard UI** — single page with channel filter, date picker, drill-down
4. **Caching** — Redis cache for dashboard tiles (TTL: 5 min for real-time, 1 hour for historical)

---



## 6. Architecture Refactor — Multi-Channel Support



### 6.1 The Core Problem

Today, Samyoj's `Conversation` model is tightly coupled to `whatsappNumberId`:

```typescript
// Current (whatsapp-only)
Conversation {
  organizationId
  whatsappNumberId
  contactId
  assignedAgentId
  // ...
}
```

To support Instagram DMs and Facebook messages, this needs a platform-agnostic `Channel` concept.

### 6.2 Proposed Refactor

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Channel Architecture                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Channel (new)                                              │
│  ├── id                                                     │
│  ├── organizationId                                         │
│  ├── platform: WHATSAPP | INSTAGRAM | FACEBOOK | ADS        │
│  ├── platformAccountId (whatsappNumberId / igId / pageId)   │
│  ├── accessToken (encrypted)                                │
│  ├── isActive                                               │
│  ├── settings (JSON — platform-specific config)             │
│  └── createdAt, updatedAt                                   │
│                                                             │
│  Conversation                                               │
│  ├── id                                                     │
│  ├── organizationId                                         │
│  ├── channelId (FK → Channel)                               │
│  ├── contactId (FK → Contact)                               │
│  ├── platformConversationId (IGSID / Messenger ID / WAMID)  │
│  ├── assignedAgentId                                        │
│  ├── status (OPEN / PENDING / CLOSED)                       │
│  └── ...                                                    │
│                                                             │
│  Contact                                                    │
│  ├── id                                                     │
│  ├── organizationId                                         │
│  ├── unifiedContactId (deduplicated across channels)        │
│  ├── platformContacts[] (ContactPlatformIdentity[])         │
│  ├── name, email, phone                                     │
│  └── ...                                                    │
│                                                             │
│  ContactPlatformIdentity (new)                              │
│  ├── id                                                     │
│  ├── contactId                                              │
│  ├── platform: WHATSAPP | INSTAGRAM | FACEBOOK              │
│  ├── platformContactId (IGSID / PSID / phone)               │
│  ├── platformSpecificMeta (JSON — username, profile pic)    │
│  └── ...                                                    │
│                                                             │
│  Message                                                    │
│  ├── id                                                     │
│  ├── conversationId                                         │
│  ├── platformMessageId (unique per platform)                │
│  ├── direction (IN / OUT)                                   │
│  ├── type (TEXT / IMAGE / VIDEO / AUDIO / TEMPLATE)         │
│  ├── status                                                 │
│  └── ...                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```



### 6.3 Migration Strategy

1. **Phase 0 — Add** `Channel` **table** (nullable FK from Conversation, backfill with WhatsApp)
2. **Phase 1 — Add** `ContactPlatformIdentity` **table** (deduplicate contacts across channels)
3. **Phase 2 — Make** `Conversation.channelId` **non-null** (after backfill)
4. **Phase 3 — Deprecate** `Conversation.whatsappNumberId` (soft remove after 1 release)
5. **Phase 4 — Platform-agnostic inbox UI** (channel filter, unified search)

---



## 7. Integration Architecture — Meta Ecosystem



### 7.1 OAuth Flow — Multi-Platform

```
┌─────────────┐     ┌─────────────────────────────────────────────┐
│   Samyoj    │     │              Meta OAuth Flow                 │
│   Client    │     │                                             │
└──────┬──────┘     │  ┌─────────┐  ┌──────────┐  ┌───────────┐ │
       │            │  │WhatsApp  │  │Instagram │  │Facebook    │ │
       │            │  │Cloud API │  │Graph API │  │Pages API  │ │
       │            │  └────┬─────┘  └────┬─────┘  └─────┬─────┘ │
       │            │       │              │              │       │
       ├────────────┼───────┼──────────────┼──────────────┼───────┤
       │ 1. Connect │       │              │              │       │
       │    request │       │              │              │       │
       ├────────────┼───────┼──────────────┼──────────────┼───────┤
       │ 2. Redirect│       │              │              │       │
       │    to Meta │       │              │              │       │
       ├────────────┼───────┼──────────────┼──────────────┼───────┤
       │ 3. Meta    │       │              │              │       │
       │    consent │       │              │              │       │
       │    screen  │       │              │              │       │
       ├────────────┼───────┼──────────────┼──────────────┼───────┤
       │ 4. Auth    │       │              │              │       │
       │    code    │       │              │              │       │
       ├────────────┼───────┼──────────────┼──────────────┼───────┤
       │ 5. Token   │       │              │              │       │
       │    exchange│       │              │              │       │
       ├────────────┼───────┼──────────────┼──────────────┼───────┤
       │ 6. Store   │       │              │              │       │
       │    tokens  │       │              │              │       │
       └────────────┘       └──────────────┴──────────────┴───────┘
```



### 7.2 Token Storage


| Platform           | Token Type                          | Storage                                  | Refresh                                |
| ------------------ | ----------------------------------- | ---------------------------------------- | -------------------------------------- |
| WhatsApp Cloud API | Short-lived (1h) → Long-lived (60d) | `WhatsappNumber.accessToken` (encrypted) | Auto-refresh via `/oauth/access_token` |
| Instagram          | Long-lived (60d)                    | `Channel.accessToken` (encrypted)        | Auto-refresh 7 days before expiry      |
| Facebook Pages     | Page Access Token (can be infinite) | `Channel.accessToken` (encrypted)        | N/A (non-expiring)                     |
| Meta Ads           | System User Token (never expires)   | `Channel.accessToken` (encrypted)        | N/A                                    |




### 7.3 Webhook Handler — Multi-Platform

```
┌──────────────────────────────────────────────────────────────┐
│                  Unified Webhook Receiver                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /api/webhook/meta                                      │
│  ├── Verify signature (HMAC-SHA256 with platform secret)     │
│  ├── Determine platform (WhatsApp / Instagram / Facebook)    │
│  ├── Dedup check (ProviderWebhookEvent table)                │
│  ├── Enqueue to BullMQ (platform-specific queue)             │
│  └── Process asynchronously                                  │
│                                                              │
│  Queues:                                                     │
│  ├── whatsapp-webhook (existing)                             │
│  ├── instagram-webhook (new)                                 │
│  └── facebook-webhook (new)                                  │
│                                                              │
│  Handlers:                                                   │
│  ├── WhatsApp → existing webhook.processor.ts                │
│  ├── Instagram → new ig-webhook.processor.ts                 │
│  │   ├── messages → create/update Conversation + Message     │
│  │   ├── comments → create Comment record + notify           │
│  │   ├── mentions → create Mention record                    │
│  │   └── story_insights → update IG media insights           │
│  └── Facebook → new fb-webhook.processor.ts                  │
│      ├── messages → create/update Conversation + Message     │
│      ├── feed → create/update Post record                    │
│      ├── leadgen → create Contact from lead                  │
│      └── messaging_postbacks → handle postback events        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```



### 7.4 Separate platform inboxes

```
┌──────────────────────────────────────────────────────────────┐
│              Separate platform inboxes                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │ Platform    │  │ Thread                               │  │
│  │ Navigation  │  │                                      │  │
│  │             │  │  [WhatsApp] John: "Hi, I'm..."       │  │
│  │ WhatsApp    │  │  [IG] @jane_doe: "Love this!"        │  │
│  │ Instagram   │  │  [FB] Page: "New lead from..."       │  │
│  │ Facebook    │  │                                      │  │
│  │             │  │                                      │  │
│  └─────────────┘  └──────────────────────────────────────┘  │
│                                                              │
│  Conversation detail:                                        │
│  ├── Platform badge (WhatsApp / Instagram / Facebook)        │
│  ├── Shared contact info (platform identities remain scoped) │
│  ├── Channel-specific actions (reply, tag, assign)           │
│  └── Automation rules (platform-aware triggers)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---



## 8. App Review & Permissions — Consolidated



### 8.1 Permission Map


| Platform      | Permission                           | Required For               | App Review                       |
| ------------- | ------------------------------------ | -------------------------- | -------------------------------- |
| **Meta Ads**  | `ads_read`                           | Read ad performance        | Required for third-party         |
| **Meta Ads**  | `ads_management`                     | Create/manage ads          | Required for third-party         |
| **Meta Ads**  | `business_management`                | Multi-client SaaS (OBO)    | Required + Business Verification |
| **Meta Ads**  | `leads_retrieval`                    | Read Lead Ads data         | Required                         |
| **Meta Ads**  | `pages_manage_metadata`              | Subscribe Page to webhooks | Standard                         |
| **Meta Ads**  | `pages_read_engagement`              | Access Page data           | Standard                         |
| **Instagram** | `instagram_business_basic`           | Basic IG account info      | Required                         |
| **Instagram** | `instagram_business_content_publish` | Publish posts/Reels        | Required                         |
| **Instagram** | `instagram_business_manage_messages` | Send/receive DMs           | Required                         |
| **Instagram** | `instagram_business_manage_comments` | Manage comments            | Required                         |
| **Facebook**  | `pages_manage_posts`                 | Create/edit Page posts     | Standard                         |
| **Facebook**  | `pages_read_engagement`              | Read Page engagement       | Standard                         |
| **Facebook**  | `pages_manage_metadata`              | Manage Page webhooks       | Standard                         |
| **Facebook**  | `pages_messaging`                    | Send/receive Page messages | Standard                         |




### 8.2 App Review Process

1. **Prerequisites:** 500+ API calls in past 15 days, <15% error rate, working app, public privacy policy, data deletion URL
2. **Submit:** App Review dashboard → Permissions → Request Advanced Access
3. **Screencast:** 1080p video showing each permission's exact action (not a tour)
4. **Timeline:** ~18-20 days for permission review, +5-10 days for Business Verification
5. **Maintain:** 500+ calls/15 days, <15% error rate (or lose Full Access tier)



### 8.3 Recommended Phased Rollout


| Phase       | Features                 | Permissions Needed                                               | App Review |
| ----------- | ------------------------ | ---------------------------------------------------------------- | ---------- |
| **Phase 1** | Lead Ads → Contacts      | `leads_retrieval`, `pages_manage_metadata`                       | Required   |
| **Phase 2** | Instagram DM inbox       | `instagram_business_basic`, `instagram_business_manage_messages` | Required   |
| **Phase 3** | Instagram comments       | `instagram_business_manage_comments`                             | Required   |
| **Phase 4** | Facebook Page inbox      | `pages_messaging`, `pages_read_engagement`                       | Standard   |
| **Phase 5** | Audience sync            | `ads_management`, `business_management`                          | Required   |
| **Phase 6** | Ad performance dashboard | `ads_read`                                                       | Required   |
| **Phase 7** | CAPI Conversion Leads    | `ads_management`                                                 | Required   |
| **Phase 8** | Automated ad creation    | `ads_management`, `business_management`                          | Required   |


---



## 9. Priority Integration Roadmap



### Tier 1 — Quick Wins (High Value, Low Complexity)


| Feature                       | Channel   | Value | Complexity | Notes                                    |
| ----------------------------- | --------- | ----- | ---------- | ---------------------------------------- |
| **Lead Ads → Contacts**       | Meta Ads  | ★★★★★ | Low        | Canonical CRM integration; webhook-based |
| **Instagram DM inbox**        | Instagram | ★★★★★ | Medium     | Unify with WhatsApp inbox; 24h window    |
| **Comment automation**        | Instagram | ★★★★  | Low        | Auto-reply, hide spam; webhook-based     |
| **Instagram private replies** | Instagram | ★★★★  | Low        | DM reply to post commenters              |




### Tier 2 — Medium Effort (High Value)


| Feature                       | Channel   | Value | Complexity | Notes                                   |
| ----------------------------- | --------- | ----- | ---------- | --------------------------------------- |
| **Audience sync**             | Meta Ads  | ★★★★  | Medium     | Upload CRM contacts as Custom Audiences |
| **Ad performance dashboard**  | Meta Ads  | ★★★   | Medium     | Poll Insights API, aggregate            |
| **Instagram post publishing** | Instagram | ★★★   | Medium     | Content Publishing API; 50/day limit    |
| **Facebook Page inbox**       | Facebook  | ★★★★  | Medium     | Messenger Platform; 24h window          |
| **Instagram insights**        | Instagram | ★★★   | Low        | Daily pull of account insights          |




### Tier 3 — Advanced (Medium-High Effort)


| Feature                        | Channel   | Value | Complexity | Notes                                           |
| ------------------------------ | --------- | ----- | ---------- | ----------------------------------------------- |
| **CAPI Conversion Leads**      | Meta Ads  | ★★★★  | Medium     | Send deal stages back to Meta                   |
| **Facebook Page posts**        | Facebook  | ★★★   | Low        | Schedule and publish Page posts                 |
| **Instagram Reels publishing** | Instagram | ★★★   | Medium     | Content Publishing API                          |
| **Meta Ads automated rules**   | Meta Ads  | ★★    | Low        | Pause/scale underperformers                     |
| **Lookalike from high-value**  | Meta Ads  | ★★★   | Low        | Seed from best WhatsApp contacts                |
| **Facebook Shops integration** | Facebook  | ★★★   | High       | Catalog sync; Samyoj already has CatalogProduct |


---



## 10. Key Architectural Decisions



### 10.1 Decision 1: Instagram API Path

**Option A: Instagram API with Instagram Login** (recommended)

- Newer, designed for SaaS
- Doesn't require linked Facebook Page
- Permissions: `instagram_business_*`
- Host: `graph.instagram.com`

**Option B: Instagram API with Facebook Login** (legacy)

- Requires linked Facebook Page
- Permissions: `instagram_basic`, `instagram_content_publish`, etc.
- Host: `graph.facebook.com`

→ **Current pack decision:** Page-linked Facebook Login first. Instagram Login remains unresolved until App Review and dashboard capabilities are confirmed.

### 10.2 Decision 2: Token Strategy

- **WhatsApp:** Keep existing `WhatsappNumber.accessToken` (encrypted)
- **New platforms:** Add `Channel` table with `accessToken` (encrypted, platform-agnostic)
- **Meta Ads:** Use System User tokens (never expire) via OBO flow
- **Refresh:** Background worker checks token age daily, refreshes 7 days before expiry



### 10.3 Decision 3: Webhook vs. Polling


| Platform                 | Real-time Events   | Approach                                          |
| ------------------------ | ------------------ | ------------------------------------------------- |
| WhatsApp                 | Webhook (existing) | Keep as-is                                        |
| Instagram DMs + comments | Webhook            | Subscribe to `instagram` topic                    |
| Facebook messages + feed | Webhook            | Subscribe to `page` topic                         |
| Meta Ads (insights)      | Polling            | Cron job (hourly) — no real-time insights webhook |
| Instagram insights       | Polling            | Daily cron job                                    |




### 10.4 Decision 4: Contact Unification

- **New** `ContactPlatformIdentity` **table** — one `Contact` (unified person) can have multiple platform identities
- **Deduplication rules:**
  - Same phone number across WhatsApp + Instagram → same person
  - Same email across platforms → same person
  - Manual merge by agent
- **Display:** Single contact profile showing all connected platforms

---



## 11. Meta App Configuration — Immediate Actions



### 11.1 Add Products to Samyoj Meta App


| Product                     | Purpose                                         | Status                                       |
| --------------------------- | ----------------------------------------------- | -------------------------------------------- |
| WhatsApp                    | Already configured                              | ✅                                            |
| Instagram                   | DMs, comments, publishing, insights             | ❌ Need to add                                |
| Facebook Login for Business | Page access                                     | ❌ Need to add                                |
| Marketing API               | Ads management                                  | ❌ Need to add                                |
| Webhooks                    | Real-time events (already partially configured) | ⚠️ Need to add `instagram` and `page` topics |




### 11.2 Webhook Subscriptions to Add


| Topic        | Fields                                                                                        | Purpose                 |
| ------------ | --------------------------------------------------------------------------------------------- | ----------------------- |
| `instagram`  | `comments`, `mentions`, `messages`, `messaging_postbacks`, `messaging_seen`, `story_insights` | Real-time IG events     |
| `page`       | `feed`, `messages`, `leadgen`, `messaging_postbacks`                                          | Real-time Page events   |
| `ad_account` | `ad_recommendations`, `in_process_ad_objects`                                                 | Ad change notifications |


---



## 12. Meta API Versions (as of 2026-09-17)


| API                | Current Version | Notes                                                                                                                |
| ------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Graph API          | v26.0           | Since Jul 29, 2026. Samyoj code still defaults `v21.0` — removal Jan 21, 2027. Pin `META_API_VERSION` intentionally. |
| Marketing API      | v26.0           | Since Jul 29, 2026                                                                                                   |
| Instagram Platform | v26.0 surface   | Content Publishing supports `media_type=STORIES` (no caption/stickers)                                               |


Meta releases new versions ~every 4 months. 90-day deprecation grace period. v26 breaking changes hit ALL versions Oct 27, 2026 (Explore Feed, Messenger Stories `story`, poll ads, delivery-estimate fields, legacy protocol, Commerce Order Management).

### 12.1 Time-critical: Embedded Signup v2 death

Docs say ES v2 deprecated **Oct 8, 2026**; Meta blog says **Oct 15, 2026**. Plan migrate to ES v4 **before Oct 8** (earlier date wins).

---



## 13. Cost & Commercial Considerations



### 13.1 Meta Platform Costs


| Cost                        | Details                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| **Meta Ads**                | Samyoj does NOT pay — advertiser pays Meta directly via their ad account |
| **WhatsApp Cloud API**      | Per-message pricing (already in place)                                   |
| **Instagram Graph API**     | Free (rate-limited, no per-call cost)                                    |
| **Facebook Pages API**      | Free (rate-limited, no per-call cost)                                    |
| **Marketing API**           | Free (rate-limited, no per-call cost)                                    |
| **Conversions API**         | Free (rate-limited, no per-call cost)                                    |
| **Conversions API Gateway** | Cloud hosting costs only (~$40-300/month for AWS/GCP)                    |




### 13.2 Samyoj Billing Impact

- **No new Meta API costs** — all Meta APIs are free at the API level
- **Conversions API Gateway** optional — only needed if advertisers want server-side event tracking
- **Samyoj can charge** for the multi-channel SaaS tier as a premium feature

---



## 14. Risks & Mitigations


| Risk                                    | Likelihood                | Impact                     | Mitigation                                                 |
| --------------------------------------- | ------------------------- | -------------------------- | ---------------------------------------------------------- |
| App Review rejection                    | Medium                    | Delays launch by 3-4 weeks | Follow screencast guidelines exactly; test each permission |
| Rate limit exhaustion                   | Medium                    | Throttled API calls        | Cache aggressively; use batch endpoints; monitor headers   |
| Token expiry disruption                 | Low                       | Interrupted automation     | Background refresh worker; alert when refresh fails        |
| Meta policy change                      | Low-Medium                | Feature breaks             | Subscribe to changelog RSS; pin API versions; auto-upgrade |
| WhatsApp-Instagram contact dedup errors | Medium                    | Duplicate contacts         | Manual merge UI; confidence scoring; review queue          |
| Special Ad Categories limits            | Low (for most businesses) | Reduced targeting          | Detect category; show UI warning; suggest alternatives     |
| BUC rate limit for small orgs           | Medium                    | Fewer API calls available  | Use Page tokens (separate bucket); cache insights daily    |


---



## 15. Existing Samyoj Meta Code — Reference



### 15.1 Key Files


| File                                                    | Purpose                                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `server/src/modules/whatsapp/meta.service.ts`           | Core Meta API client (token exchange, send, webhook verify, Flows, catalog)                           |
| `server/src/modules/whatsapp/org-meta.service.ts`       | Org credential resolver + leftover secret stripping                                                   |
| `server/src/modules/whatsapp/connect-oauth-state.ts`    | OAuth state machine (JWT, redirect URI whitelist)                                                     |
| `server/src/modules/whatsapp/legacy-oauth-url.ts`       | OAuth dialog URL builder (default `connectFlow=oauth`)                                                |
| `server/src/modules/whatsapp/connect-pending.ts`        | Redis pending-connect store (15m TTL)                                                                 |
| `server/src/modules/whatsapp/oauth-errors.ts`           | OAuth error mapper                                                                                    |
| `server/src/modules/whatsapp/save-connection.ts`        | Connection persistence (DB layer; orchestration in `routes.ts:saveWhatsappConnection`)                |
| `server/src/modules/whatsapp/webhook-accept.ts`         | Envelope claim + ciphertext + `process-webhook` enqueue                                               |
| `server/src/modules/whatsapp/webhook-dispatcher.ts`     | Non-message field routing (messages handled by worker)                                                |
| `server/src/modules/whatsapp/webhook-signature-gate.ts` | Signature gate (prod rejects missing rawBody; non-prod allows unsigned)                               |
| `server/src/modules/whatsapp/webhook-url.ts`            | Webhook URL resolver                                                                                  |
| `server/src/modules/whatsapp/provider-status.ts`        | Outbound status → campaign/inbox sync                                                                 |
| `server/src/modules/whatsapp/active-number.ts`          | `resolveActiveWhatsappNumber` middleware (`X-WhatsApp-Number-Id`)                                     |
| `server/src/modules/whatsapp/context.ts`                | Org/number credential context (decrypt + sync)                                                        |
| `server/src/workers/webhook.processor.ts`               | Async `messages`-only processing                                                                      |
| `server/src/modules/calling/meta-calling.service.ts`    | Calling Graph client (calls/settings/permissions)                                                     |
| `server/src/modules/auth/oauth.routes.ts`               | Google OAuth only — NOT Meta                                                                          |
| `server/src/config/validate.ts`                         | Validates env (does NOT require `META_APP_ID`; warns App Secret, errors default verify token in prod) |
| `server/src/config/cors.ts`                             | CORS (no Meta domains — only client/webhook origins)                                                  |
| `server/src/config/index.ts`                            | Version default `v21.0` (removal Jan 21, 2027); ES v4 only if `META_CONNECT_FLOW=es_v4                |
| `server/src/utils/crypto.ts`                            | AES-256-GCM encrypt/decrypt (tokens + envelopes)                                                      |
| `server/src/middleware/tenant-csrf.ts`                  | CSRF (webhook already exempt; `/webhook-replay` NOT exempt)                                           |




### 15.2 Database Models (Meta-relevant)


| Model                  | Meta Fields                                                                                                                                                                                                                                                                        | Notes                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `WhatsappNumber`       | `phoneNumberId`, `wabaId`, `businessId`, `accessToken` (encrypted), `normalizedPhoneNumber`, `qualityRating`, `officialBusinessAccount`, `messagingLimitTier`, `tokenExpiresAt`, `isOnBizApp`, `coexistenceStatus`, `isActive` (partial unique on `phoneNumberId WHERE is_active`) | Core Meta connection                                                    |
| `Organization`         | `settings.meta` (legacy, being stripped)                                                                                                                                                                                                                                           | Platform credentials in .env                                            |
| `OAuthAccount`         | `provider` (String, extensible) — today only `google` rows, user-scoped (no `organizationId`)                                                                                                                                                                                      | IG/FB would need org-scoped token store — use `Channel`, not this table |
| `Conversation`         | `whatsappNumberId` (nullable `String?`, effectively required via middleware)                                                                                                                                                                                                       | Needs platform-agnostic refactor                                        |
| `Contact`              | `normalizedPhone`, nullable `whatsappNumberId` (unique breaks on NULL)                                                                                                                                                                                                             | Needs cross-platform identity                                           |
| `CatalogProduct`       | `metaCatalogId`, `metaProductId` (from inbound order payloads — no Catalog Graph write path for Shops)                                                                                                                                                                             | WA sync only; Shops Order API dead                                      |
| `ProviderWebhookEvent` | `organizationId`, `eventKey`, `field`, `status`, `claimedAt/processedAt`, `payloadCiphertext?`, `requestId?`, `phoneNumberId?` (unique `(organizationId,eventKey)`)                                                                                                                | Envelope already provider-agnostic; producers/consumers WA-only today   |


---



## 16. Summary — What Samyoj Can Build



### Tier 1 — Must Have (Competitive Necessity)

1. **Lead Ads → Auto-create contacts** — Webhook-based; canonical CRM integration
2. **Instagram DM inbox** — Unify with WhatsApp; 24h messaging window (outside = `HUMAN_AGENT` humans only, never WA templates)
3. **Comment automation** — Auto-reply, hide spam, private replies (1 DM per comment per 7d)
4. **Ad performance dashboard** — Pull Insights API; unified with WhatsApp metrics



### Tier 2 — Should Have (Differentiators)

1. **Audience sync** — CRM contacts → Custom Audiences; lookalikes from high-value
2. **Instagram post publishing** — Content Publishing API; schedule and publish
3. **Facebook Page inbox** — Messenger Platform; separate platform inbox
4. **Instagram insights** — Account-level and per-post metrics



### Tier 3 — Nice to Have (Future)

1. **CAPI Conversion Leads** — Closed-loop ROI tracking
2. **Facebook Page posts** — Schedule and publish
3. **Automated Rules** — Pause/scale ads based on performance
4. **Facebook Shops integration** — Catalog sync with existing CatalogProduct model

---

*Document compiled from: Meta Graph + Marketing API v26.0 (Jul 29, 2026) + v26.0 changelog, Instagram Platform Content Publishing docs (STORIES supported), Embedded Signup v4 docs/blog, Conversions API, Samyoj codebase re-verified 2026-09-17 (meta.service.ts, webhook-accept/dispatcher/signature-gate, schema.prisma, inbox + analytics routes), original research leaves L10/L11/L12/L14 + policy/competitor notes, and 4 parallel deep-research agent reports.*

### Recheck log (2026-09-17, second pass)


| #   | Found                                                                                                                                | Fix                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 1   | §1.1 claimed 60-day token + auto-refresh                                                                                             | Code only monitors expiry via `debug_token` — no refresh. Fixed.                |
| 2   | §1.2 table: dup OAuth row, 6 missing endpoint groups, 4 wrong rows (`subscribed_apps` on phone, `/upload`, `/contacts`, `/insights`) | Rewrote with Discovery/Business/Catalog rows.                                   |
| 3   | §1.3 conflated envelope vs field claims, wrong queue/handler shape                                                                   | Split two layers, `process-webhook` job name, calls inline.                     |
| 4   | §15.1: Google OAuth listed as Meta, CORS "Meta domains", validate "requires APP_ID", CSRF "needs bypass", missing 10 files           | Fixed + added full file list.                                                   |
| 5   | §15.2: `OAuthAccount` "extendable" ignores user-vs-org mismatch; Catalog "Meta-compatible" ignores dead Order API                    | Fixed with hard CANNOT.                                                         |
| 6   | Marketing API v25.0 stale                                                                                                            | Both APIs v26 since Jul 29, 2026.                                               |
| 7   | Stories marked ❌ in 3 places                                                                                                         | Content Publishing supports `media_type=STORIES` — CAN.                         |
| 8   | Shops presented as buildable                                                                                                         | Order Management 47 endpoints dead on v26 — hard CANNOT.                        |
| 9   | Deleted IG tags listed as available                                                                                                  | Error 100 since Apr 27, 2026 — CANNOT.                                          |
| 10  | ES dates missing                                                                                                                     | v2 death Oct 8 (docs) / Oct 15 (blog) — plan before Oct 8.                      |
| 11  | IG-vs-FB login conflict between docs                                                                                                 | Locked: Page-linked Facebook Login first, Instagram Login after review confirm. |
| 12  | v26 Ads removals unlisted                                                                                                            | Explore/poll/delivery-estimate/legacy-protocol added as never-plan.             |


