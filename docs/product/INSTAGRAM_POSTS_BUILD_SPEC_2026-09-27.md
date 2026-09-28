# Instagram → Posts — build specification (research & implementation plan)

**Status:** Research complete · **Not shipped** · build after this doc is approved  
**Audience:** Product, engineering, App Review, QA  
**Route (target):** `/instagram/posts`  
**Nav (target):** **Channels → Instagram → Posts** (below Inbox & Comments)  
**Canonical Meta docs:** [Content Publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/) (Facebook Login path: `graph.facebook.com`, Page access token)

---

## 1. Product summary

Samyoj customers already use **Instagram → Inbox** (DMs) and **Comments** (private reply). **Posts** adds the third Instagram pillar: **create, schedule, and manage feed content** on the **professional account linked to their Facebook Page** — without leaving Samyoj.

**In scope (target product):**

| Capability | User story |
|------------|------------|
| **Compose** | Single image or video post with caption, hashtags, optional first comment (if API allows — see §6) |
| **Schedule** | Pick date/time; Meta holds publish until window (official: ~10 minutes to ~75 days ahead — verify at build) |
| **Publish now** | Immediate post after container processing |
| **List & manage** | Draft, scheduled, publishing, published, failed; cancel schedule where Meta allows |
| **Calendar** | Month/week view of scheduled and published posts (org timezone) |
| **Reuse creative** | Pull assets from **Content Studio library** / brand kit; do **not** confuse with WhatsApp template submit |

**Explicitly out of v1 (defer or never):**

- Facebook Page organic posts (separate API surface; different nav **Facebook → Posts** later)
- Ads creation / boosting (stay **Facebook → Ads** read-only)
- Shopping tags, product tags, collab posts, branded content tools
- Full Stories editor (stickers, mentions, music) — Stories API is limited; treat as Phase C
- Replacing Meta Business Suite for analytics depth
- Personal Instagram accounts

**Positioning vs competitors:** Meta ecosystem plan notes **IG/FB publishing is not table stakes** for Indian WA inbox vendors ([`META_ECOSYSTEM_V2_PLAN_2026-09-18.md`](../meta-ecosystem/META_ECOSYSTEM_V2_PLAN_2026-09-18.md)). Samyoj differentiates as **acquisition → conversation → CRM**; Posts supports **organic presence** and ties future analytics to the same org Channel.

---

## 2. Where it lives in Samyoj (UI & mental model)

```text
Channels
  Instagram ▾
    Inbox          (DMs, 24h window)     — shipped (test-deploy)
    Comments       (private reply)       — shipped (test-deploy)
    Posts          (create / schedule)   — THIS SPEC
```

**Do not** put Instagram Posts under:

- **WhatsApp → Campaigns** (broadcast templates; different Meta product)
- **AI Studio → Content Studio** alone (Studio is cross-channel *drafting*; Instagram Posts is *channel execution*)

**Do** link from Content Studio: “Send to Instagram Posts” on approved image/video assets (Phase B).

**Page chrome:** Pink Instagram accent (same as Comments/Inbox), `pageMeta` title **Instagram Posts**, subtitle mentioning **professional account** + **Page link required**.

---

## 3. What exists today (reuse map)

| Layer | Today | Reuse for Posts |
|-------|--------|-----------------|
| **Connect** | FB OAuth → `Channel` `platform: IG` + parent Page token | Same token path; **add scopes** (§5) |
| **Graph client** | `server/src/modules/facebook/page-client.ts` (IG account, media fetch for comments) | Extend with publish helpers |
| **Media cache** | `instagram/media-cache.ts` for comment thumbnails | Pattern for IG media IDs; not for upload |
| **Inbound media** | DM attach uses **public HTTPS URL** Meta fetches | **Same constraint** for `image_url` / `video_url` |
| **Storage** | Org media via signed routes / S3 without public bucket | **Gap:** need stable **Meta-fetchable HTTPS** URLs (§8) |
| **Content Studio** | Drafts, library, calendar of *drafts/jobs* — WhatsApp template submit only | Library + brand kit + composer for **caption/media pick** |
| **Workers** | BullMQ in API (`startWorkers`) | New `instagram-publish` job + status poller |
| **Prisma** | `InstagramComment`, `Channel`, `MediaAsset`, `ContentDraft` | New `InstagramPost` (or `ChannelScheduledPost`) tables (§9) |
| **Phase doc** | `phases/04-instagram.md` says **no Posts in phase 4** | Superseded **only after** this feature is explicitly approved |

**Audit markers:** `IG-publish: out` in [`INSTAGRAM_INTEGRATION_AUDIT_2026-09-24.md`](../meta-ecosystem/INSTAGRAM_INTEGRATION_AUDIT_2026-09-24.md) — update when MVP ships.

---

## 4. Meta API — login path decision

Samyoj already uses **Instagram API with Facebook Login** (Page access token, `graph.facebook.com`).

| Path | Samyoj today | Posts |
|------|--------------|-------|
| Facebook Login + Page token | ✅ IG DMs, comments, ads read | ✅ **Recommended** — extend `FACEBOOK_PAGE_LEADGEN_SCOPES` |
| Instagram Login (`graph.instagram.com`) | ❌ Not used | ❌ **Do not add** a second connect flow in v1 |

**IG user id:** `Channel.platformAccountId` for `platform: IG` (instagram business account id).

**Token:** Encrypted Page access token from parent `Channel` `platform: FB` (same as `instagramApi.inbox.send`).

---

## 5. Permissions & App Review

### 5.1 Current OAuth scopes (`connect-oauth-state.ts`)

Present: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement` (verify exact list in code), `pages_messaging`, `leads_retrieval`, `ads_read`.

**Missing for publishing:**

| Permission (Facebook Login path) | Purpose |
|----------------------------------|---------|
| `instagram_content_publish` | Create containers + publish / schedule |
| `pages_read_engagement` | Often required to resolve IG account — **confirm still granted** |

Meta is migrating naming for **Instagram Login** apps (`instagram_business_content_publish` since Jan 2025). Samyoj stays on **Facebook Login** scope names until we add a second login product.

### 5.2 App Review deliverables

- Screencast: connect Page → open **Instagram → Posts** → upload image → schedule → show in list → (optional) publish now on test account
- Privacy policy / data use: store captions, media URLs, Meta media/container IDs, publish status
- **Advanced Access** for multi-tenant SaaS (customers’ IG accounts)

### 5.3 Re-consent

Existing orgs must **re-connect Facebook Page** after scope change (same pattern as adding `ads_read`). UI: banner on Posts page if `instagram_content_publish` missing.

---

## 6. Meta publishing mechanics (implementation truth)

Official flow (container model):

```text
1. POST /{ig-user-id}/media
     image_url | video_url | children (carousel)
     caption, optional media_type (REELS, CAROUSEL, STORIES)
     scheduling: published=false + scheduled_publish_time (Unix UTC) — verify param names in current Graph version

2. Poll GET /{container-id}?fields=status_code,status
     until FINISHED (or ERROR) — required for video/Reels

3. POST /{ig-user-id}/media_publish
     creation_id={container-id}
```

**Scheduling:** Container created with future `scheduled_publish_time`; publish step may still be required at creation time — **implement against Graph v21+ in code and document exact payload in `instagram-publish.ts`**.

**Rate limits (verify at build via `GET /{ig-user-id}/content_publishing_limit`):**

- Meta docs cite **~50–100 API-published posts per rolling 24h** per IG account (carousels = 1). Enforce in Samyoj before calling `media_publish`.

**Hard limits (product copy):**

| Limit | Value |
|-------|--------|
| Caption | 2,200 characters |
| Hashtags | 30 (product validator) |
| Carousel items | 10 |
| Image | Public URL, JPEG recommended; min width 320px |
| Reels | 9:16, duration & codec rules per Meta |
| Stories | Limited API (no full sticker parity) — **v1: off or “beta”** |

**No reliable webhook for “published”** — poll container + optionally `GET /{ig-media-id}` after publish.

**Cannot via API:** edit caption after publish (user must use Instagram app); delete post may be available via separate endpoint — **verify** for v1 “delete from Instagram” action.

---

## 7. Feature specification (MVP → v2)

### 7.1 MVP (build first)

| ID | Feature | Notes |
|----|---------|--------|
| P1 | Single **image** post, publish now | Happy path for App Review |
| P2 | **Caption** + character/hashtag validation | |
| P3 | **Schedule** image post | Timezone = org or user setting (IST default for India) |
| P4 | **Post list** with status filters: Draft, Scheduled, Publishing, Published, Failed | |
| P5 | **Cancel** scheduled post if Meta supports `DELETE` container / unpublished schedule — **spike in week 1** |
| P6 | Connect gate + empty states | Same as Comments: Page-linked IG |
| P7 | **Media upload** from device → Samyoj storage → **public Meta URL** | Block publish if URL not Meta-reachable |
| P8 | Audit log row per publish attempt | `organizationId`, `channelId`, actor |

### 7.2 Phase B

| ID | Feature |
|----|---------|
| B1 | **Carousel** (2–10 items) |
| B2 | **Reels** (video + polling UX) |
| B3 | **Calendar** month view (reuse Content Studio calendar UX patterns) |
| B4 | **Content Studio → Posts** handoff (asset id → composer) |
| B5 | **First comment** if supported on container |
| B6 | Read-only **insights** link or embed basic metrics (`instagram_manage_insights` — new scope) |

### 7.3 Phase C (optional)

- Stories (`media_type=STORIES`)
- Approval workflow (reuse Content Studio `IN_REVIEW`)
- Multi-account (multiple IG channels per org) — already modeled by `Channel` if multiple Pages

---

## 8. Media pipeline (critical engineering)

Meta **fetches** `image_url` / `video_url` from the internet. Samyoj today:

- Inbound/outbound IG **DM media** uses org media proxy / upload patterns.
- S3 adapter tests state media is **not** on a public bucket by default.

**Required for Posts:**

1. **Upload endpoint** `POST /api/instagram/posts/media` → stores file → returns `metaFetchUrl` (HTTPS, no auth cookie).
2. Options (pick one in spike):
   - **A.** Short-lived signed URL on API host (`/api/media/meta-fetch/:token`) — Meta GET without cookies; token bound to org + expiry.
   - **B.** Dedicated public CDN prefix per org (higher ops cost).
3. **Never** use localhost/ngrok URLs in production publish.
4. **Video:** large files → Meta **resumable upload** (`rupload.facebook.com`) per official docs — separate code path from image.

---

## 9. Data model (Prisma proposal)

```prisma
enum InstagramPostStatus {
  DRAFT
  SCHEDULED
  QUEUED      // worker picked up
  PROCESSING  // container polling
  PUBLISHED
  FAILED
  CANCELLED
}

enum InstagramPostMediaType {
  IMAGE
  CAROUSEL
  REELS
  VIDEO       // feed video if distinct from REELS in API
}

model InstagramPost {
  id                String   @id @default(cuid())
  organizationId    String
  channelId         String   // IG Channel
  createdByUserId   String?

  status            InstagramPostStatus @default(DRAFT)
  mediaType         InstagramPostMediaType @default(IMAGE)

  caption           String   @db.Text
  scheduledAt       DateTime?  // null = publish ASAP when user confirms
  publishedAt       DateTime?

  // Meta ids
  containerId       String?
  igMediaId         String?    // after publish

  // JSON: [{ mediaAssetId, metaFetchUrl, sortOrder }] for carousel
  mediaPayload      Json

  lastError         String?  @db.Text
  publishAttempts   Int      @default(0)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization Organization @relation(...)
  channel      Channel      @relation(...)

  @@index([organizationId, channelId, status])
  @@index([organizationId, scheduledAt])
}
```

**Draft vs DB DRAFT:** User can save caption without scheduling; scheduling sets `SCHEDULED` and enqueues job at `scheduledAt - leadTime` (e.g. T-2 min to create container).

---

## 10. Backend architecture

### 10.1 Modules

```text
server/src/modules/instagram/
  posts.routes.ts       # CRUD, schedule, cancel, publish-now
  posts.service.ts      # business rules, limits
  posts.publish.ts      # Graph calls
  posts.worker.ts       # process queue
  posts.limits.ts       # caption, hashtag, rate limit cache
```

Register routes: `/api/instagram/posts/*` (mirror `comments.routes.ts` auth: `authenticate`, `requireOrg`).

### 10.2 Worker jobs

| Job | Trigger | Action |
|-----|---------|--------|
| `instagram-post-publish` | `scheduledAt` due or publish-now | Create container → poll → media_publish |
| `instagram-post-poll` | Retry backoff on `IN_PROGRESS` | status_code check |

Embed in existing `startWorkers()` — **no** separate PM2 worker process.

### 10.3 Idempotency

- Unique constraint on `containerId` when set
- Before publish, re-fetch post row; if already `PUBLISHED`, exit
- Store Meta error payload in `lastError` (user-safe message + code)

### 10.4 Permissions (Samyoj RBAC)

| Action | OWNER/ADMIN | SUPERVISOR | AGENT |
|--------|-------------|------------|-------|
| View posts | ✅ | ✅ | ✅ (optional: hide compose) |
| Create / schedule | ✅ | ✅ | ❌ (product default) |
| Cancel / delete draft | ✅ | ✅ | ❌ |

Align with `manageTemplates`-style gates or new `manageInstagramPosts`.

---

## 11. Frontend architecture

### 11.1 Pages & components

| Piece | Path |
|-------|------|
| Page | `client/src/pages/InstagramPostsPage.tsx` |
| Styles | `client/src/pages/instagram-posts.css` |
| List + filters | Reuse patterns from `InstagramCommentsPage` (skeleton, empty, MetaMockNotice) |
| Composer | Slide-over or split pane: media dropzone, caption, schedule datetime, preview card (IG aspect ratio) |
| Calendar | Phase B — optional `InstagramPostsCalendar.tsx` or shared calendar primitive |

### 11.2 API client

Extend `instagramApi` in `client/src/services/api.ts`:

- `posts.list`, `posts.get`, `posts.create`, `posts.update`, `posts.schedule`, `posts.publishNow`, `posts.cancel`, `posts.uploadMedia`

### 11.3 Navigation

Add to `CHANNEL_PLATFORMS` Instagram items in `navigation.ts`:

```ts
{ to: '/instagram/posts', icon: ImageIcon or LayoutGrid, label: 'Posts' },
```

Register route in `App.tsx`, `pageMeta.ts`, `navigation.test.ts`.

---

## 12. Scheduling & timezones

- Store `scheduledAt` in **UTC** in DB.
- Display in org timezone (`organization.settings.timezone` or existing campaign timezone helper in `server/src/modules/campaigns/timezone.ts`).
- Worker cron: scan `status=SCHEDULED AND scheduledAt <= now() + 2m` (lead time for container processing).
- **User copy:** “Instagram may take a few minutes to process video before it goes live.”

---

## 13. Entitlements & billing

**TARGET (not current Razorpay one-shot plans):** gate by plan tier in `docs/billing/` — e.g. Growth+ gets N scheduled posts/month.

**MVP (testing deploy):** optional feature flag `instagramPosts` in org settings or env `ENABLE_IG_POSTS=1`.

**AI usage:** Caption assist may call existing AI ledger (`content_studio` or new `instagram_post_caption` action) — spec only; wire in Phase B.

**Meta fees:** No per-post Meta invoice to Samyoj; organic publish is free (ads are separate).

---

## 14. Risks & open questions (DOUBT)

| # | Question | Action |
|---|----------|--------|
| D1 | Exact `scheduled_publish_time` semantics in current Graph version | Spike with Graph Explorer on test IG |
| D2 | Cancel scheduled post API | Read Meta “content publishing” delete docs |
| D3 | 50 vs 100 posts / 24h | Call `content_publishing_limit` in spike |
| D4 | Creator vs Business account publish | Meta: some features Creator-limited — show error from API |
| D5 | Public URL strategy in Codespaces dev | Block publish in dev or use tunnel URL with warning |
| D6 | App Review timeline | Parallel track; do not block internal MVP on test account |
| D7 | New scope deprecation (`instagram_business_*`) | Monitor Meta changelog; Facebook Login path still documented |

---

## 15. Test plan

### 15.1 Automated

- Unit: caption validator, hashtag count, schedule window (10 min – 75 days)
- Unit: `posts.publish` mocked Graph sequence (container → poll → publish)
- Integration: create DRAFT → schedule → worker marks PUBLISHED (mock fetch)

### 15.2 Manual (required before customer production)

- [ ] Re-connect Page with new scope on test app
- [ ] Publish image now → appears on IG profile
- [ ] Schedule +2h → appears at ~time (account timezone)
- [ ] Fail path: bad image URL → FAILED with readable error
- [ ] Rate limit: attempt 26th post in 24h → Samyoj blocks with message
- [ ] Agent role cannot schedule (if enforced)
- [ ] Multi-tenant: org A token cannot publish to org B channel

---

## 16. Suggested build sequence (epics)

```text
Epic 1 — Spike (2–3 days)
  Graph publish image on dev IG, content_publishing_limit, public URL strategy

Epic 2 — Backend core (1 week)
  Schema, routes, publish service, worker, media upload URL

Epic 3 — Frontend MVP (1 week)
  Posts page, composer, list, connect gate

Epic 4 — Schedule + polish (3–5 days)
  Scheduler, cancel, error states, pageMeta, nav

Epic 5 — App Review + production hardening
  Scope rollout, re-consent banner, docs update, SAMYOJ ticket

Epic 6 — Phase B (carousel, Reels, calendar, Studio handoff)
```

---

## 17. Documentation & Jira

- **This file** = source of truth until code lands.
- Update when shipped: `docs/meta-ecosystem/phases/` (new phase or extend IG), `STATUS_AND_FUTURE.md`, `WEBSITE_FEATURE_CATALOG` (only after customer-ready).
- **Jira:** One epic under SAMYOJ-8, child tasks per Epic 1–4; comment on SAMYOJ-8 with link — **do not file** until user asks (backlog rule).

---

## 18. References

| Doc | Relevance |
|-----|-----------|
| [`INSTAGRAM_COMMENTS_PAGE_CONTENT_SPEC.md`](./INSTAGRAM_COMMENTS_PAGE_CONTENT_SPEC.md) | UI tone, connect states, role gates |
| [`META_ECOSYSTEM_UI_BY_PHASE_2026-09-22.md`](../meta-ecosystem/META_ECOSYSTEM_UI_BY_PHASE_2026-09-22.md) | Posts under Instagram |
| [`INSTAGRAM_INTEGRATION_AUDIT_2026-09-24.md`](../meta-ecosystem/INSTAGRAM_INTEGRATION_AUDIT_2026-09-24.md) | Current IG capabilities |
| [`META_ECOSYSTEM_PHASE_2026-09-17.md`](../meta-ecosystem/META_ECOSYSTEM_PHASE_2026-09-17.md) | Publishing API summary |
| [`META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md`](../meta-ecosystem/META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md) | Live test gates |
| Meta Content Publishing | https://developers.facebook.com/docs/instagram-platform/content-publishing |

---

*End of spec — v1.0 · 2026-09-27*
