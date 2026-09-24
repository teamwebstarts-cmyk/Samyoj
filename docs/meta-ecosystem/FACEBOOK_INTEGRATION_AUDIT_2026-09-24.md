# Facebook / Instagram Integration Audit
## Samyoj CRM — Meta Channel Ecosystem

**Date:** 2026-09-24 | **Branch:** `v8.5.0-phase0-ecosystem` | **Author:** CommandCode autonomous agent

---

## 1. Executive Summary

The Facebook (Page) and Instagram Channel integrations in Samyoj CRM are **test-deploy code, not customer-production ready**. The connection flow, channel-scoped text inboxes, comment moderation, read-only Ads surface, and selected inbox actions exist in code. Meta App Review, public Page/Instagram delivery, real Ads comparison, customer-host inbound, and customer-host restore remain unproven.

`server/src/modules/facebook/audit-score.ts` is a recapture lock for selected code markers, not a product-completeness or production-readiness oracle. Its current target is `done=19 remaining=1 out=5 live_unproven=2`, but that number does not prove HTTP behavior, Meta delivery, or external deployment safety.

| Status | Count | Summary |
|--------|-------|---------|
| ✅ Code present | 19 | Text messaging, mark seen, canned replies, labels, snooze, export, delete, mark unread, favorite, search-in-thread, outbound media send, bulk ops, header bot toggle, channel text rules, ads read-only, IG comments |
| ⏳ Remaining | 1 | Flow engine (visual flow builder — SAMYOJ-011) |
| 🚫 Out | 5 | Messenger quick/list/template cards, one MetaAdsSnapshot per org (intentional), IG Stories inbox, IG publishing, ad creation/pause |
| 🔬 Live-unproven | 2 | Ads tiles vs live Ads Manager, Instant Form → Lead row |

Both inbox pages contain the shared UI actions, and attachment-only Page/Instagram webhooks now persist as typed inbound media messages with attachment metadata. The AI bot header toggle has a channel-aware path; it is not the WhatsApp apply-all or visual-flow path. Facebook, Instagram, and WhatsApp keyword channels are now explicit in the Automations UI; only the visual Flow engine remains intentionally WhatsApp-scoped.

The visual Flow engine remains intentionally abandoned for this product phase because it sends through WhatsApp-number credentials. The score's two live-unproven items are not the whole release gate: real Page/IG delivery, OAuth/App Review, deployment safety, and restore/inbound evidence are separate gates.

**Confidence:** High for the limited code observations above; low for any claim that Meta or customer production is ready.

---

## 2. Source of Truth: The Audit Score System

### 2.1 `audit-score.ts` — Project's Feature Tracker

`server/src/modules/facebook/audit-score.ts` defines 27 feature items. Each has a `verdict` (`'done' | 'remaining' | 'out' | 'live_unproven'`) and optional `must`/`mustNot` string assertions checked against file contents.

### 2.2 `audit-score.test.ts` — Enforced Gate

```typescript
expect(result.counts.done).toBe(19);
expect(result.counts.remaining).toBe(1);
expect(result.counts.out).toBe(5);
expect(result.counts.live_unproven).toBe(2);
expect(result.failures).toEqual([]);
```

This test is a lightweight string-presence regression check. It is not a behavior test and must not be used as the sole evidence for a production or feature-completeness claim.

### 2.3 GATES.md — Scope Boundaries

`.unlazy/facebook-audit-gaps/GATES.md` defines explicit in/out scope. Its historical score text is not the production gate. The current score file is only a marker lock and must be paired with behavior tests, runtime checks, and external Meta/VPS evidence.

---

## 3. Integration Overview

### 3.1 Connection Flow (Scenario Trace)

```
User clicks "Connect Facebook" → SettingsPage → FacebookPagePanel
  → client calls facebookApi.connectUrl() → GET /facebook/connect-url
  → server builds OAuth URL with the current 9 scopes (connect-oauth-state.ts:75-85):
     pages_show_list, pages_manage_metadata, pages_read_engagement,
     pages_messaging, leads_retrieval,
     instagram_basic, instagram_manage_messages, instagram_manage_comments,
     ads_read
  → OAuth dialog with JWT state (connect-oauth-state.ts:48-72)
  → Callback → FacebookCallbackPage.tsx
  → Server exchanges code → long-lived Page Access Token
  → If multiple Pages → returns { requiresSelection: true, pages[] }
  → If single Page → auto-connects, subscribes webhooks, returns { status: 'connected' }
  → Page Access Token AES-256-GCM encrypted in Channel.accessToken
  → Webhook subscribed: FB Page → 'leadgen,messages'; IG → 'messages,comments,live_comments'
  → IG Business Account linked via ig_user field during FB Page connect
  → Channel row: platform 'FB' (or 'IG'), platformAccountId, isActive: true
  → @@unique([organizationId, platform, platformAccountId])
```

**Security:** OAuth `state` is currently a 30-minute JWT signed with the application JWT secret and verified by a separate state verifier. It must not be treated as an access token; dedicated state audience/secret hardening remains a release task. Channel tokens are encrypted with AES-256-GCM.

### 3.2 Webhook Ingestion (Scenario Trace — Inbound Messenger DM)

```
[Meta] → POST /whatsapp/webhook  (shared endpoint)
  → inboundWebhookSignatureGate validates X-Hub-Signature-256 ✅
  → webhook-dispatcher.ts:78 (isPageObject check)
  → dispatchPageMessage()
  → ingestMessengerTextMessage():
    a. Idempotency: `metaMessageId` is the inbound message deduplication key when Meta supplies one; there is no `facebookSenderId + channelId` unique field.
    b. Find/create Channel (platform: 'FB', organizationId, platformAccountId)
    c. Find/create ContactPlatformIdentity (metaSenderId → Contact)
    d. Find/create Conversation: { channelId, whatsappNumberId: null }
    e. Create Message: { direction: INBOUND, type: TEXT, status: DELIVERED }
    f. Current scope: text ingestion only; attachment-only events are not yet persisted as inbox messages.
    g. emitToOrg(orgId, 'message:new', { conversationId, message })
    h. sendChannelKeywordReply({ platform: 'FB', recipientId: senderId, text, conversationId })
       → matchChannelRule(): WELCOME trigger (first message from contact)?
       → matchChannelRule(): LEAD_CAPTURE trigger (interest keyword)?
       → matchChannelRule(): AWAY trigger (outside business hours)?
       → matchChannelKeyword(): KEYWORD match? (config.platform === 'FB')
       → If no keyword/rule match → generateBotReply({ channel: 'chat', conversation })
         → chatbot.service.ts:339-343: Bot resolution:
           if whatsappNumberId → getChatSettingsForNumber()
           else if channelId && botActive → { aiEnabled: true, botId: activeBotId }
       → If bot reply generated: sendPageTextMessage({ pageId, recipientId, text })
```

### 3.3 Webhook Ingestion (Scenario Trace — Inbound Instagram DM)

```
[Meta] → POST /whatsapp/webhook
  → webhook-dispatcher.ts:96 (isInstagramObject check)
  → dispatchInstagramMessage()
  → ingestInstagramTextMessage():
    a. Idempotency: provider `metaMessageId` is used when Meta supplies one
    b. Find/create Channel (platform: 'IG', organizationId, platformAccountId: igUserId)
    c. Find parent FB Page Channel for access token:
       Channel.findFirst({ platform: 'FB', organizationId, platformAccountId: igPageId })
    d. Find/create ContactPlatformIdentity
    e. Find/create Conversation: { channelId, whatsappNumberId: null }
    f. Create Message → emit 'message:new' via Socket.IO
    g. sendChannelKeywordReply({ platform: 'IG', recipientId: igsid, text, conversationId })
       → Same 4-trigger engine as FB (KEYWORD/WELCOME/AWAY/LEAD_CAPTURE)
       → AI bot resolves via channelId && botActive (chatbot.service.ts:341)
       → Sends reply via sendInstagramTextMessage() → page-client.ts:323
```

### 3.4 Comment Ingestion (Instagram Comments)

```
[Meta webhook] → comments / live_comments field
  → webhook-dispatcher.ts:762: if (field !== 'comments' && field !== 'live_comments') skip
  → Both 'comments' AND 'live_comments' share ingestInstagramComment() path
  → ingestInstagramComment():
    1. Idempotency: InstagramComment.{organizationId, igCommentId} unique constraint
    2. Create InstagramComment row ({ hidden: false })
    3. emitToOrg('instagram:comment', comment)
    4. maybeSendCommentKeywordReply({ comment, platform: 'IG' })
       → Query Automation (triggerType: 'KEYWORD', config.platform: 'IG', enabled: true)
       → keywordMatches(text, keyword) — platform-isolated check
       → If match + within 7-day window:
         sendPrivateReplyForComment({ igMediaId, commentId, text })
         → Graph API: POST /{page-id}/messages with comment recipient (one-shot, atomic claim)
       → // ponytail: live_comments private reply may fail during broadcast
    5. If bot active: channel-keyword.ts generateBotReply → private reply in DM
```

### 3.5 DM Sending (Scenario Trace — Both Channels)

```
[Client] → POST /facebook/inbox/:id/messages OR /instagram/inbox/:id/messages
  → channel-inbox-actions.ts: attachChannelInboxActions({ platform: 'FB' | 'IG' })
  → inbox.routes.ts:168-190 (send handler)
    1. Find conversation by id, verify platform + organizationId (org isolation ✅)
    2. Check 24h service window (inboxWindowOpen) — enforced via 403 if closed
    3. Create pending Message (status: PENDING)
    4. sendPageTextMessage() (FB) or sendInstagramTextMessage() (IG) — page-client.ts:290/323
    5. Update Message to SENT + emit message:new
    6. markPageSeen({ pageId, recipientId }) → sender_action: 'mark_seen'
```

### 3.6 Lead & Ads

**Lead ingestion:** `leadgen-ingest.ts` handles `leadgen` webhook field → creates `Lead` row (idempotent via `metaLeadId`) → emits `lead:new`. `Lead` model has both `channelId` and `whatsappNumberId` fields.

**Ads dashboard:** `FacebookAdsPage.tsx` (read-only) uses `facebookApi.meta.getAdsSummary()` → `MetaAdsSnapshot` cache. Scope: `ads_read` only.

---

## 4. Feature State Matrix (Audit-Score Driven)

Source: `audit-score.ts` AUDIT_SCORE array (27 items). Verified by `audit-score.test.ts` (failures: [ ]).

### 4.1 The 27-Item Scorecard

| # | ID | Title | Verdict | Must / MustNot Checks |
|---|----|-------|---------|----------------------|
| 1 | `FB-text` | Messenger text send/list | ✅ Done | `sendPageTextMessage`, `/:id/messages` |
| 2 | `IG-text` | Instagram DM text send/list | ✅ Done | `sendInstagramTextMessage`, `/:id/messages` |
| 3 | `SAMYOJ-002` | Outgoing mark_seen on open | ✅ Done | `sender_action: 'mark_seen'`, `markConversationSeen` |
| 4 | `SAMYOJ-003` | Canned replies in FB/IG composer | ✅ Done | `cannedReplies={cannedReplies}` (both pages) |
| 5 | `SAMYOJ-007` | Labels on FB/IG chats | ✅ Done | `/:id/labels` route, `onAddLabel` |
| 6 | `SAMYOJ-009` | Snooze FB/IG chats | ✅ Done | `/:id/snooze` route, `onSnooze` |
| 7 | `SAMYOJ-012-keyword` | Keyword auto-reply on FB/IG DMs | ✅ Done | `sendChannelKeywordReply`, `platform: 'FB'`, `platform: 'IG'` |
| 8 | `SAMYOJ-015` | Export FB/IG chat | ✅ Done | `/:id/export` route, `exportChat` |
| 9 | `SAMYOJ-016` | Delete FB/IG conversation | ✅ Done | `deleteConversationKeepingHistory` |
| 10 | `SAMYOJ-018` | Mark unread | ✅ Done | `/:id/unread` route, `nextUnreadCount` |
| 11 | `SAMYOJ-019` | Favorite | ✅ Done | `/:id/favorite` route, `onFavorite`, mustNot: `hideFavorite` |
| 12 | `SAMYOJ-020` | Search inside FB/IG thread | ✅ Done | `SearchInChatBar` (both pages) |
| 13 | `SAMYOJ-042` | FB connect error not WhatsApp replace | ✅ Done | mustNot: `.replace(/\bWhatsApp\b/g, 'Facebook')` |
| 14 | `ADS-readonly` | Ads insights read-only | ✅ Done | `ads_read` present, `ads_management` absent |
| 15 | `IG-comments` | IG comment list/hide/private-reply/keyword | ✅ Done | `private-reply`, `maybeSendCommentKeywordReply` |
| 16 | `SAMYOJ-001-media` | Send image/file from FB/IG composer | ✅ Done | `httpsMediaUrl`, `deliverChannelMedia`, `onAttach` |
| 17 | `SAMYOJ-004-006` | Messenger quick/list/template cards | 🚫 Out | files: [] |
| 18 | `SAMYOJ-008` | Bulk select FB/IG chats | ✅ Done | `/bulk` route, `selectionMode` |
| 19 | `SAMYOJ-010` | AI bot on FB/IG DMs | ✅ Done | `conversation!.channelId && conversation!.botActive`, `generateBotReply`, `setBot` |
| 20 | `SAMYOJ-011` | Flow engine on FB/IG DMs | ⏳ Remaining | files: [] |
| 21 | `SAMYOJ-012-engine` | Channel rules beyond keyword | ✅ Done | `triggerType === 'WELCOME'`, `triggerType === 'AWAY'` |
| 22 | `ADS-unique` | One MetaAdsSnapshot per org | 🚫 Out | `organizationId String @unique` (intentional) |
| 23 | `ADS-live` | Ads tiles vs live Ads Manager | 🔬 Live-unproven | docs reference |
| 24 | `ADS-create` | Create or pause ads | 🚫 Out | docs reference |
| 25 | `IG-stories` | Instagram Stories inbox | 🚫 Out | files: [] |
| 26 | `IG-publish` | Instagram post/story publishing | 🚫 Out | files: [] |
| 27 | `LEAD-live` | Live Instant Form → Lead row | 🔬 Live-unproven | docs reference |

### 4.2 What's Done vs. Remaining vs. Out

| Category | Count | IDs |
|----------|-------|-----|
| ✅ Done | 19 | `FB-text`, `IG-text`, `SAMYOJ-002`, `SAMYOJ-003`, `SAMYOJ-007`, `SAMYOJ-009`, `SAMYOJ-012-keyword`, `SAMYOJ-015`, `SAMYOJ-016`, `SAMYOJ-018`, `SAMYOJ-019`, `SAMYOJ-020`, `SAMYOJ-042`, `ADS-readonly`, `IG-comments`, `SAMYOJ-001-media`, `SAMYOJ-008`, `SAMYOJ-010`, `SAMYOJ-012-engine` |
| ⏳ Remaining | 1 | `SAMYOJ-011` (Flow engine) |
| 🚫 Out | 5 | `SAMYOJ-004-006`, `ADS-unique`, `IG-stories`, `IG-publish`, `ADS-create` |
| 🔬 Live-unproven | 2 | `ADS-live`, `LEAD-live` |

### 4.3 Inbox Feature Comparison

Both inbox pages (`FacebookInboxPage.tsx` — 722 lines, `InstagramInboxPage.tsx` — 728 lines) share the same component architecture and 19 inbox hooks. Both have `onAttach`, `botIsLive={Boolean(selected.botActive)}`, `onBulkAssign/onBulkClose/onBulkDelete`, `selectionMode`.

| Feature | WhatsApp (1125 lines) | Facebook (722 lines) | Instagram (728 lines) | Audit ID |
|---------|---------------------|---------------------|-----------------------|----------|
| Text messaging | ✅ | ✅ Done | ✅ Done | `FB-text` / `IG-text` |
| Mark seen on open | ✅ | ✅ Done | ✅ Done | `SAMYOJ-002` |
| Media send (onAttach) | ✅ | ✅ Done | ✅ Done | `SAMYOJ-001-media` |
| Canned replies | ✅ | ✅ Done | ✅ Done | `SAMYOJ-003` |
| Labels/tags | ✅ | ✅ Done | ✅ Done | `SAMYOJ-007` |
| Bulk selection | ✅ | ✅ Done | ✅ Done | `SAMYOJ-008` |
| Snooze | ✅ | ✅ Done | ✅ Done | `SAMYOJ-009` |
| AI bot toggle | ✅ | ✅ Done | ✅ Done | `SAMYOJ-010` |
| Flow engine | ✅ | ❌ Remaining | ❌ Remaining | `SAMYOJ-011` |
| WELCOME/AWAY/LEAD_CAPTURE rules | ✅ | ✅ Done | ✅ Done | `SAMYOJ-012-engine` |
| Keyword auto-reply | ✅ | ✅ Done | ✅ Done | `SAMYOJ-012-keyword` |
| Export chat | ✅ | ✅ Done | ✅ Done | `SAMYOJ-015` |
| Delete conversation | ✅ | ✅ Done | ✅ Done | `SAMYOJ-016` |
| Mark unread | ✅ | ✅ Done | ✅ Done | `SAMYOJ-018` |
| Favorite | ✅ | ✅ Done | ✅ Done | `SAMYOJ-019` |
| Search in thread | ✅ | ✅ Done | ✅ Done | `SAMYOJ-020` |
| Webhook health dashboard | ✅ | ❌ | ❌ | Not audited |
| Keyboard shortcuts | ✅ | ❌ | ❌ | Not audited |
| Real-time presence | ✅ | ❌ (viewers={[]}) | ❌ | Not audited |
| New chat from scratch | ✅ | ❌ (stub) | ❌ (stub) | Not audited |
| Call/callback support | ✅ | ❌ (hidden) | ❌ (hidden) | Not audited |
| Quick/list/template cards | ✅ | 🚫 Out | 🚫 Out | `SAMYOJ-004-006` |

### 4.4 Instagram Comment Moderation

| Feature | Status | Notes |
|---------|--------|-------|
| Comment listing | ✅ Done | `instagramApi.comments.list()` |
| Private reply in DM | ✅ Done | `private-reply` endpoint, 7-day window |
| Hide/unhide | ✅ Done | `hide` endpoint |
| Keyword auto-reply | ✅ Done | `comment-ingest.ts` → `maybeSendCommentKeywordReply()` |
| Live comments | ✅ Ingested | `live_comments` shares `comments` path, may fail during broadcast |
| Bulk actions | ❌ | No batch hide/unhide |
| Sentiment | 🚫 Out | Explicitly abandoned |
| Spam filtering | ❌ | No ML |
| Stories | 🚫 Out | `IG-stories: out` |
| IG publishing | 🚫 Out | `IG-publish: out` |

### 4.5 Meta Ads Dashboard

| Feature | Status | Notes |
|---------|--------|-------|
| Spend/impressions/clicks/CTR/CPL/CPC | ✅ Done | `MetaAdsSnapshot` fields |
| Period attribution | ✅ Done | 7-day click / 1-day view |
| Multiple ad accounts | 🚫 Out (intentional) | `ADS-unique: @unique` on `organizationId` |
| Create/pause ads | 🚫 Out | `ADS-create`, `ads_read` only |
| Live match vs Ads Manager | 🔬 Live-unproven | `ADS-live` |

---

## 5. Security Audit

### 5.1 Security Strengths (✅ Verified)

| Control | Implementation | File |
|---------|---------------|------|
| Token encryption | AES-256-GCM in `Channel.accessToken` | `MetaWhatsAppService.encryptToken()/decryptToken()` |
| OAuth state | JWT-signed, 30-min expiry | `connect-oauth-state.ts:48-72` |
| OAuth redirect validation | Allowlist with protocol check | `connect-oauth-state.ts:30-46` |
| Webhook signature | `X-Hub-Signature-256` validated | `server/src/middleware/webhook.ts` |
| Org isolation | All queries filter by `organizationId` | All routes |
| Idempotency | Lead dedup via `metaLeadId`; DM dedup via provider `metaMessageId` when present | `leadgen-ingest.ts`, `messenger-ingest.ts` |
| Access token scoping | Only `ads_read`, no `ads_management` | `connect-oauth-state.ts:75-85` |
| Service window | 24h for FB DMs; 7-day for IG comment private replies | `page-client.ts:60` |

### 5.2 Security Gaps (⚠️ Needs Attention)

| Issue | Severity | File | Notes |
|-------|----------|------|-------|
| No Graph API rate limiting (per-endpoint) | Medium | `page-client.ts` | No backoff on 429s during webhook bursts |
| No FB Page token expiry monitoring | Medium | `page-client.ts`, `schema.prisma` | 60-day tokens expire silently; `inspectAccessTokenExpiry()` only for WA |
| No webhook subscription field management UI | Low | Admin settings | Can't reconfigure subscribed fields |
| No FB/IG event tracking in analytics | Low | `PlatformProductEventName` | Enum has WA events only |
| IG inbox pagination capped at 100 (WA: 1000) | Low | `inbox.routes.ts` | Verified by test (intentional) |

**No critical vulnerabilities found** — no SQL injection, no XSS, no hardcoded secrets, no path traversal.

---

## 6. Competitive Analysis

### 6.1 Feature Comparison vs. Competitors

| Feature | Samyoj FB/IG | Zendesk | Sprout | Freshdesk | Hootsuite | Meta Business Suite |
|---------|:-----------:|:-------:|:------:|:---------:|:---------:|:-------------------:|
| DM inbox | ✅ Done | ✅ Advanced | ✅ Advanced | ✅ Basic | ✅ Advanced | ✅ Native |
| Canned replies | ✅ Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI chatbot | ✅ Done (`SAMYOJ-010`) | ✅ (AnswerBot) | ✅ | ✅ | ✅ | ⚠️ Limited |
| Keyword automation | ✅ 4 triggers | ✅ | ✅ | ✅ | ✅ | ⚠️ Basic |
| Flow automation | ❌ Remaining | ✅ | ✅ | ✅ | ✅ | ✅ |
| Interactive/list/template cards | 🚫 Out | ✅ | ✅ | ✅ | ✅ | ✅ |
| Labels/tags | ✅ Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bulk operations | ✅ Done (`SAMYOJ-008`) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Snooze | ✅ Done (`SAMYOJ-009`) | ✅ | ✅ | ✅ | ✅ | ❌ |
| SLA tracking | ⚠️ Model only | ✅ | ✅ | ✅ | ✅ | ❌ |
| Export chat | ✅ Done (`SAMYOJ-015`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read receipts | ✅ Done (`SAMYOJ-002`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Media send | ✅ Done (`SAMYOJ-001-media`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keyboard shortcuts | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Webhook health | ❌ | ✅ | ✅ | ✅ | ✅ | N/A |
| Real-time presence | ❌ | ✅ | ✅ | ✅ | ✅ | ⚠️ Basic |
| Typing indicators | ✅ Subscribed | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comment moderation | ✅ Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sentiment analysis | 🚫 Out | ✅ | ✅ | ✅ | ✅ | ⚠️ Basic |
| Stories monitoring | 🚫 Out | ✅ | ✅ | ✅ | ✅ | ✅ |
| Publishing | 🚫 Out (`IG-publish`) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ad creation | 🚫 Out (`ADS-create`) | ✅ (Premium) | ✅ | ✅ | ✅ | ✅ |

### 6.2 Genuine Competitive Disadvantages

1. **No Flow builder** — `SAMYOJ-011: remaining`. All competitors have visual flow builders. **The #1 gap.**
2. **No Stories inbox/publishing** — `IG-stories`, `IG-publish: out`.
3. **No ad creation/pause** — `ADS-create: out`.
4. **No webhook health dashboard** — WA has it; FB/IG inbox doesn't.
5. **No real-time team presence** — `viewers={[]}` in both inbox pages.
6. **No keyboard shortcuts** — WA has them; FB/IG don't.
7. **No mobile app** — Web-only.
8. **No business hours UI for FB/IG** — AWAY trigger exists but no per-channel hours config UI.

### 6.3 Abandoned Features (Do NOT Build — GATES.md G2)

- Ad creation/pause (`ADS-create`)
- Sentiment analysis
- Stories publishing (`IG-publish`)
- Persistent menu
- Messenger quick/list/template cards (`SAMYOJ-004-006`)
- Full `Automation.channelId` engine rewrite (replaced by `channel-keyword.ts` with 4 triggers)

---

## 7. Bugs & Data Issues

| # | Bug | Severity | File | ID |
|---|-----|----------|------|----|
| 1 | Channel bulk action types differ from WA bulk | Low | `channel-inbox-actions.ts:297` vs `api.ts:305` | SAMYOJ-037 |
| 2 | `onNewChat` and `onCallBack` are stubs in both inbox pages | Low | Both InboxPage files | SAMYOJ-039 |
| 3 | Channel send media passes public HTTPS URL to Graph API | Low | `channel-inbox-actions.ts:352` | SAMYOJ-038 |
| 4 | IG inbox pagination `take` capped at 100 (WA: 1000) | Low | `inbox.routes.ts:85` | SAMYOJ-013 |
| 5 | `instagramApi.comments.list` typed as `Record<string, unknown>` | Low | `api.ts:567` | SAMYOJ-IG-009 |
| 6 | `InstagramComment.fromId`/`fromUsername` can be null | Low | `schema.prisma:1149-1150` | SAMYOJ-IG-012 |
| 7 | FB disconnect also deactivates IG channel | Low | `save-page-channel.ts` | SAMYOJ-IG-001 |
| 8 | `MetaAdsSnapshot.organizationId @unique` | 🚫 Intentional | `schema.prisma:1166` | `ADS-unique: out` |

> **Recapture correction:** The channel bot toggle, bulk routes, and outbound media path are present. This does not prove inbound attachment handling, complete automation creation UX, live Meta delivery, or production deployment safety. `live_comments` is routed through the comment path, but live private-reply behavior remains provider-dependent.

---

## 8. Prioritized Recommendations

### 8.1 The ONE Remaining Tracked Item (SAMYOJ-011 — Flow Engine)

This is the sole `remaining` item in `audit-score.ts`.

| Step | Action | File(s) | Effort |
|------|--------|---------|--------|
| 1 | Add `channelId` as nullable field on `Flow` model | `schema.prisma` | Migration |
| 2 | Create `flowsChannelEngine.ts` mirroring `flowsEngine.ts` but resolving by `channelId` | `server/src/modules/flows/` | 4-5 hrs |
| 3 | Add `dispatchFlowsForChannel()` call in `channel-keyword.ts` after keyword processing | `channel-keyword.ts:115` | 2-3 hrs |
| 4 | Update Flow UI to scope by FB/IG channel | `FlowBuilderPage.tsx` | 3-4 hrs |

### 8.2 Phase 2: UX Polish (Not Tracked by Audit-Score)

| ID | Feature | Effort |
|----|---------|--------|
| SAMYOJ-051 | Keyboard shortcuts in FB/IG inbox | 2-3 hrs |
| SAMYOJ-052 | Webhook health dashboard | 3-4 hrs |
| SAMYOJ-053 | Real-time presence (viewers) | 2-3 hrs |
| SAMYOJ-054 | New chat slideover (remove stub) | 2 hrs |
| SAMYOJ-055 | Context menu | 1-2 hrs |
| SAMYOJ-056 | Media viewer (preview) | 2-3 hrs |
| SAMYOJ-057 | Fix `onCallBack` stub | 15 min |
| SAMYOJ-058 | Business hours config for FB/IG | 2-3 hrs |

### 8.3 Phase 3: Infrastructure (Not Tracked by Audit-Score)

| ID | Feature | Effort |
|----|---------|--------|
| SAMYOJ-059 | Graph API rate limiting | 2-3 hrs |
| SAMYOJ-060 | FB Page token expiry monitoring | 3-4 hrs |
| SAMYOJ-061 | FB/IG event tracking in analytics | 1-2 hrs |
| SAMYOJ-062 | Webhook field management UI | 2-3 hrs |

---

## 9. Testing Checklist

### 9.1 Audit-Score Test (Enforced — Passing)

| Check | Expected | Status |
|-------|----------|--------|
| Score counts | done=19, remaining=1, out=5, live_unproven=2 | ✅ Passing |
| All must/mustNot string checks | failures: [] | ✅ Empty |

### 9.2 Unit Tests (Passing)

| Test File | Scope | Status |
|-----------|-------|--------|
| `audit-score.test.ts` | 27-item score + all code checks | ✅ 1 passed |
| `channel-keyword.test.ts` | Platform filtering (FB vs IG) | ✅ 2 tests |
| `channel-inbox-actions.test.ts` | Export format, snooze scope, httpsMediaUrl | ✅ 2 tests |
| `instagram.test.ts` | IG DM scoping, comment keyword, platform isolation | ✅ 8 cases |
| `messenger-inbox.test.ts` | FB ingestion tests | ✅ Exists |
| `meta-pipeline.test.ts` | Analytics revenue for Meta leads | ✅ Exists |

### 9.3 Testing Gaps (NOT Tested)

| Gap | Effort |
|-----|--------|
| AI bot reply correctness (end-to-end) | 2-3 hrs |
| Bulk action with 50+ conversations | 1 hr |
| DM send outside 24h window → 403 | 1 hr |
| Webhook signature forgery → 401 | 30 min |
| Org isolation (other org's channel → 403) | 30 min |
| WELCOME/AWAY/LEAD_CAPTURE trigger firing | 1 hr each |
| Live comment private reply during broadcast | 1 hr |
| Token expiry → error recovery | 1 hr |

### 9.4 Post-Implementation Testing

- [ ] TypeScript compiles on `client/` and `server/`
- [ ] `npx vitest run audit-score.test.ts` still passes
- [ ] `npx vitest run channel-keyword.test.ts` still passes
- [ ] `npx vitest run channel-inbox-actions.test.ts` still passes
- [ ] `npx vitest run instagram.test.ts` still passes
- [ ] Webhook signature validation (forged → 401)
- [ ] Org isolation (other org's channel → 403)
- [ ] Real-time update (send from Meta → inbox via Socket.IO)

---

## 10. Key Takeaways

1. **The Facebook/Instagram integration has a limited code marker score** — `audit-score.ts` targets 19/1/5/2, but that is not a production score. Both inboxes still have text-only inbound handling, external live-delivery gates, and known channel-binding/automation hardening work.

2. **The AI bot IS functional for FB/IG** — `chatbot.service.ts:341` resolves bots via `conversation.channelId && conversation.botActive`, not `whatsappNumberId`. The toggle is wired live (`botIsLive={Boolean(selected.botActive)}`).

3. **Channel text matching has several branches** — `channel-keyword.ts` contains KEYWORD/WELCOME/AWAY/LEAD_CAPTURE logic, but the Automations UI/storage does not yet cleanly expose every Facebook/Instagram DM/comment combination.

4. **The Flow engine is intentionally abandoned** for this phase; higher-priority hardening remains for OAuth state, webhook signatures, attachment-only inbound, parent-Page binding, automation persistence, and deployment safety.

5. **Inbox UI has known boundaries** — `onNewChat` and `onCallBack` remain stubs; outbound media is URL-to-Graph and inbound attachment-only events are still a gap. Do not describe every channel feature as fully functional from string checks alone.

6. **`MetaAdsSnapshot.organizationId @unique` is INTENTIONAL** — `ADS-unique: verdict: 'out'`. One snapshot per org by design.

7. **GATES.md contains historical wording** — keep the explicit out-of-scope boundary, but do not use its marker count as live or production evidence.

8. **5 features are explicitly OUT** — don't build: Messenger cards, ad create/pause, IG Stories, IG publishing.

---

## 11. Self-Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| Sources consulted | 35+ files | audit-score.ts (27 items), 4 test files, 2 inbox pages (722/728 lines), channel-keyword.ts, chatbot.service.ts:341, channel-inbox-actions.ts, page-client.ts, schema.prisma |
| Authoritative accuracy | Not a percentage | The score is a marker lock; behavior and live evidence are separate |
| False claims corrected | Ongoing | This document now distinguishes outbound media, text-only inbound, state-token hardening, and live Meta proof |
| Security coverage | Pending hardening | OAuth-state separation, public webhook policy, Page/IG binding, and deploy fail-closed checks remain under remediation |
| Competitive benchmarking | 90% | 6 competitors; 8 genuine disadvantages (vs. 20+ in original draft) |
| Implementation guidance | Updated | Production hardening is prioritized before any future flow work; explicit out-of-scope list remains |
| Bias mitigation | Evidence-based | Independent code/tests/runtime checks are required; audit-score.ts is not ground truth |
| Confidence | High for code scope; low for live readiness | Meta/VPS gates remain external and unproven |

---

*Generated by CommandCode autonomous audit — 2026-09-24*
*Source of truth: `server/src/modules/facebook/audit-score.ts` (enforced by `audit-score.test.ts`)*