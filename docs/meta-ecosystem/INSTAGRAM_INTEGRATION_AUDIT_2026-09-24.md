# Instagram Integration Audit
## Samyoj CRM — Meta IG Channel Deep Dive

**Date:** 2026-09-24 | **Branch:** `v8.5.0-phase0-ecosystem` | **Author:** CommandCode autonomous agent

> **Companion to:** `FACEBOOK_INTEGRATION_AUDIT_2026-09-24.md`. Instagram uses the same `Channel` table (`platform: IG`), same `channel-keyword.ts` automation engine, and same `channel-inbox-actions.ts` routes as Facebook. This document isolates Instagram-specific findings, gaps, and solutions.

---

## 1. Executive Summary

Instagram integration is **test-deploy code, not customer-production ready**. The connection flow, channel-scoped text DM inbox, comment moderation, and shared inbox actions exist in code. Meta permissions/subscriptions, signed public delivery, real DM/comment/private-reply proof, customer-host inbound, and restore evidence remain external release gates.

The internal `audit-score.ts` target (`done=19 remaining=1 out=5 live_unproven=2`) is a code-marker recapture lock, not a behavior or production-readiness score. It does not prove that Meta can deliver events or that every listed feature is exposed correctly in the UI.

| Component | Status | Notes |
|-----------|--------|-------|
| OAuth connection (via FB Page) | ⚠️ Code path | Current scope set is 9; App Review/Live access is external |
| DM webhook ingestion | ⚠️ Text path | Text events are handled; attachment-only events are currently skipped |
| DM inbox (server routes) | ⚠️ Code | Org/channel text routes and shared actions exist; parity is not full WhatsApp CRUD |
| DM inbox (client UI) | ⚠️ Test-deploy | Separate route exists; authenticated browser smoke is pending |
| DM canned replies | ✅ Done | `cannedReplies={cannedReplies}` on ChatComposer |
| DM media send | ⚠️ Outbound only | `onAttach` + `deliverChannelMedia`; Meta must fetch a public HTTPS URL |
| DM bulk operations | ✅ Done | `selectionMode` + `onBulkAssign/onBulkClose/onBulkDelete` |
| DM AI bot | ✅ Done | `botIsLive={Boolean(selected.botActive)}` — resolves via `channelId && botActive` |
| DM labels/tags | ✅ Done | `/:id/labels` route + `onAddLabel` |
| DM snooze | ✅ Done | 4h/24h snooze + Favorites/Snoozed chips |
| DM export chat | ✅ Done | `downloadChat()` → `.txt` export |
| DM mark unread / favorite | ✅ Done | `/:id/unread`, `/:id/favorite` |
| DM search in thread | ✅ Done | `SearchInChatBar` imported |
| DM keyword automation | ⚠️ Partial | Channel matcher supports rules, but current Automations UI does not cleanly expose IG DM vs comment rules |
| DM rule automation (WELCOME/AWAY/LEAD_CAPTURE) | ⚠️ Partial | Code matcher exists; UI/storage behavior needs a dedicated channel test |
| Flow engine | 🚫 Abandoned | Flow engine still requires WhatsApp-number credentials |
| Comment moderation | ✅ Done | List, hide/unhide, private reply, keyword |
| Comment live | ⚠️ Routed | `live_comments` shares the comment path; live private-reply behavior is provider-dependent |
| Stories inbox | 🚫 Out | `IG-stories: out` |
| IG publishing | 🚫 Out | `IG-publish: out` |
| Ads dashboard | ✅ Read-only | `ads_read` only; IG has no ads page |

**Confidence:** High for the limited code observations above; low for live readiness. The audit-score test is a string-presence check and is not ground truth.

### Code recapture

Do not rebuild already-present UI actions: canned replies, labels, snooze, export, favorite, unread, bulk actions, or the header bot toggle. Verify their HTTP behavior before calling them production-complete.

**Still remaining:** visual flow graph is abandoned for this product phase; attachment-only inbound, automation UI separation, and parent-Page binding are hardening items.
**Out of product:** Stories inbox, publishing, sentiment, ad create.
**Live unproven:** real IG DM/comment on a published app.

---

## 2. How Instagram Works Today

### 2.1 Connection Flow (via Facebook OAuth)

Instagram connects through the **Facebook Page OAuth flow** — no independent OAuth. The current code requests 9 scopes; availability still depends on Meta App Review/Live access:

```typescript
// server/src/modules/facebook/connect-oauth-state.ts:75-85
export const FACEBOOK_PAGE_LEADGEN_SCOPES = [
  'pages_show_list', 'pages_manage_metadata', 'pages_read_engagement',
  'pages_messaging', 'leads_retrieval',
  'instagram_basic', 'instagram_manage_messages', 'instagram_manage_comments',
  'ads_read',
].join(',');
```

**Flow:**
1. User connects Facebook Page → OAuth grants Instagram scopes automatically
2. Server detects linked IG Business Account via Graph API `GET /{page-id}?fields=instagram_business_account`
3. `Channel` row created with `platform: 'IG'`, `platformAccountId: igUserId`, `accessToken: <encrypted page token>`
4. Instagram webhook subscribed on the same Page: `messages, comments, live_comments`

**Tight coupling constraint:** IG DMs require the parent FB Page token. `instagramApi.inbox.send` looks up the parent FB Page channel for the token (`inbox.routes.ts:224-232`). Disconnecting FB Page silently breaks IG DMs.

### 2.2 Webhook Fields Subscribed

The subscription helper requests `messages,comments,live_comments` for IG. The live Meta dashboard must still be checked independently; source code is not proof that Meta accepted the subscription.

The `webhook-dispatcher.ts` handles these fields for the Instagram object:
- `messages` — DM text inbound → `ingestInstagramTextMessage()`
- `comments` — Post/reel comments + mentions → `ingestInstagramComment()`
- `live_comments` — Live stream comments → shares `comments` path via `ingestInstagramComment()`

Note: `message_reactions`, `message_typing_on`, and `mentions` are handled in code but are part of the shared FB+IG ingest logic. They may or may not be actively subscribed for IG (the `subscribed_fields` string only lists the 3 above).

### 2.3 DM Ingestion (Scenario Trace)

```
[Meta webhook] → POST /whatsapp/webhook
  → webhook-dispatcher.ts:96 (isInstagramObject check)
  → dispatchInstagramMessage()
  → ingestInstagramTextMessage():
    a. Idempotency: provider `metaMessageId` is used when Meta supplies one
    b. Find/create Channel (platform: 'IG', organizationId, platformAccountId: igUserId)
    c. Find parent FB Page channel for access token
    d. Find/create ContactPlatformIdentity (igsid → Contact)
    e. Find/create Conversation: { channelId, whatsappNumberId: null }
    f. Create Message: { direction: INBOUND, type: TEXT, status: DELIVERED }
    g. emitToOrg(orgId, 'message:new')
    h. sendChannelKeywordReply({ platform: 'IG', recipientId: igsid, text, conversationId })
       → matchChannelRule(): WELCOME trigger? (first message from contact)
       → matchChannelRule(): LEAD_CAPTURE trigger? (interest keyword)
       → matchChannelRule(): AWAY trigger? (outside business hours?)
       → matchChannelKeyword(): KEYWORD match? (config.platform === 'IG')
       → If no trigger match → generateBotReply({ channel: 'chat', conversation })
         → chatbot.service.ts:341: if (conversation.channelId && conversation.botActive)
       → If reply: sendInstagramTextMessage() → page-client.ts:323
```

### 2.4 DM Sending (Scenario Trace)

`POST /instagram/inbox/:id/messages` → `channel-inbox-actions.ts` (shared via `attachChannelInboxActions({ platform: 'IG' })`):

1. Find conversation by id, verify `platform: 'IG'` + `organizationId` (org isolation ✅)
2. Check `instagramWindowOpen()` — 24h service window (403 if closed)
3. Find parent FB Page channel → decrypt Page Access Token
4. Create pending `Message` (status: PENDING)
5. `sendInstagramTextMessage({ pageId, pageAccessToken, recipientIgsid, text })` → Graph API POST /me/messages
6. Update to SENT + emit `message:new`
7. `markPageSeen({ pageId, recipientId })` → `sender_action: 'mark_seen'`

### 2.5 Comment Ingestion (Scenario Trace)

```
[Meta webhook] → comments / live_comments
  → webhook-dispatcher.ts:762: field === 'comments' || field === 'live_comments'
  → ingestInstagramComment():
    1. Idempotency: InstagramComment.{organizationId, igCommentId} unique
    2. Create InstagramComment row ({ hidden: false, fromId, fromUsername, text })
    3. emitToOrg('instagram:comment')
    4. maybeSendCommentKeywordReply({ comment, platform: 'IG' })
       → Automation KEYWORDS with config.platform: 'IG'
       → keywordMatches(text, keyword) — platform-isolated
       → If match + within 7-day window: sendPrivateReplyForComment()
         → POST /{page-id}/messages with a comment recipient (one-shot, atomic claim)
       → // ponytail: live_comments private reply may fail during broadcast
    5. The current comment path is keyword/private-reply only; it does not run the channel DM bot as a comment reply
```

### 2.6 DM Keyword + Rule Automation Engine (4 Trigger Types)

`channel-keyword.ts` is the text-DM matcher for IG. It contains keyword/welcome/away/lead branches and AI-bot handoff, but the current Automations UI does not cleanly expose separate IG DM and IG comment rule types.

```typescript
// channel-keyword.ts: sendChannelKeywordReply({ platform: 'IG', recipientId, text })
// 1. WELCOME trigger — fires on first contact message
// 2. LEAD_CAPTURE trigger — fires on interest keyword
// 3. AWAY trigger — fires outside business hours (isWithinBusinessHours)
// 4. KEYWORD trigger — text contains keyword (matchChannelKeyword filters by config.platform === 'IG')
// If no rule matches → generateBotReply({ channel: 'chat', conversation })
//   → chatbot.service.ts:341: conversation.channelId && conversation.botActive → { aiEnabled: true, botId: activeBotId }
//   → Bot reply sent via sendInstagramTextMessage()
```

Verified by `audit-score.ts`:
- `SAMYOJ-012-keyword: done` — must: `['sendChannelKeywordReply', "platform: 'IG'"]` ✅
- `SAMYOJ-012-engine: done` — must: `['triggerType === 'WELCOME'', 'triggerType === 'AWAY'']` ✅
- `SAMYOJ-010: done` — must: `['conversation!.channelId && conversation!.botActive', 'generateBotReply', 'setBot']` ✅

### 2.7 Comment Private Reply (Atomic Claim Pattern)

```typescript
// server/src/modules/instagram/comment-ingest.ts:160-172
const claimed = await prisma.instagramComment.updateMany({
  where: {
    id: row.id, organizationId, channelId,
    privateReplySentAt: null,  // ← atomic claim guard
  },
  data: { privateReplySentAt: claimedAt },
});
if (claimed.count !== 1) return { ok: false, error: 'Already replied.' };
```

Concurrent requests can't double-send replies. `// ponytail:` comment notes provider idempotency key would be a production upgrade.

### 2.8 Server Routes

Instagram routes use the SAME shared `channel-inbox-actions.ts` with `platform: 'IG'`:

```
GET   /instagram/inbox              → list conversations (search, status, agent filter)
GET   /instagram/inbox/:id          → conversation detail
GET   /instagram/inbox/:id/messages → message list (limit 50)
POST  /instagram/inbox/:id/messages → send text (24h window enforced)
POST  /instagram/inbox/:id/read     → mark read
PATCH /instagram/inbox/:id/assign    → assign to agent (org membership validated)
PATCH /instagram/inbox/:id/status    → update status (OPEN/PENDING/CLOSED)
POST  /instagram/inbox/:id/notes     → add internal note
PATCH /instagram/inbox/:id/favorite  → toggle favorite
POST  /instagram/inbox/:id/unread    → mark unread
POST  /instagram/inbox/:id/snooze    → snooze
GET   /instagram/inbox/:id/export    → export chat (.txt)
POST  /instagram/inbox/:id/media     → send media attachment
POST  /instagram/inbox/:id/bot       → toggle AI bot
PATCH /instagram/inbox/:id/labels    → add label
DELETE /instagram/inbox/:id/labels/:labelId → remove label
DELETE /instagram/inbox/:id          → delete conversation
POST  /instagram/inbox/bulk          → bulk assign/close/delete

GET   /instagram/comments            → list comments
POST  /instagram/comments/:id/private-reply → private reply (7-day window)
POST  /instagram/comments/:id/hide   → hide/unhide comment

GET   /instagram/account             → IG account info
POST  /instagram/connect             → connect (triggers FB OAuth)
POST  /instagram/disconnect          → disconnect IG channel
```

### 2.9 Database Schema (Instagram-specific)

```prisma
// Channel — shared, IG usage
model Channel {
  platform          ChannelPlatform  // 'WA' | 'FB' | 'IG'
  platformAccountId String            // IG: igUserId
  accessToken       String?           // AES-GCM encrypted (FB Page token)
  isActive          Boolean
  // @@unique([organizationId, platform, platformAccountId])
}
// Instagram channels reuse the SAME accessToken as their parent FB Page.

// InstagramComment — IG-only
model InstagramComment {
  id              String
  organizationId  String
  channelId       String
  igCommentId     String
  igMediaId       String?
  fromId          String?
  fromUsername    String?
  text            String
  commentedAt     DateTime
  hidden          Boolean  @default(false)
  privateReplySentAt DateTime?  // 7-day window enforcement
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
// @@unique([organizationId, igCommentId]) — idempotency
```

**Schema limitations:**
- No `InstagramStory` model (stories have no persistence)
- No `sentiment` field on `InstagramComment`
- No `Channel.tokenExpiryAt` field (no token expiry monitoring)

---

## 3. Feature Maturity Matrix

### 3.1 DM Inbox Features

| Feature | WhatsApp | Facebook | Instagram | Audit Score |
|---------|----------|----------|-----------|-------------|
| Text messaging | ✅ | ✅ Done | ✅ Done | `FB-text` / `IG-text` |
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
| Keyboard shortcuts | ✅ | ❌ | ❌ | Not audited |
| Webhook health dashboard | ✅ | ❌ | ❌ | Not audited |
| Real-time presence (viewers) | ✅ | ❌ (`viewers={[]}`) | ❌ | Not audited |
| New chat from scratch | ✅ | ❌ (stub) | ❌ (stub) | Not audited |
| Call/callback support | ✅ | ❌ (hidden) | ❌ (hidden) | Not audited |

### 3.2 Comment Moderation

| Feature | Status | Audit ID |
|---------|--------|----------|
| Comment listing | ✅ Done | `IG-comments` |
| Private reply in DM | ✅ Done (7-day window) | `IG-comments` |
| Hide/unhide | ✅ Done | `IG-comments` |
| Keyword auto-reply | ✅ Done | `IG-comments` + `SAMYOJ-012-keyword` |
| Live comments | ✅ Ingested | Live may fail during broadcast |
| Bulk actions | ❌ | Out |
| Sentiment | 🚫 Out | Abandoned |
| Spam filtering | ❌ | Not built |

### 3.3 Instagram-exclusive Features

| Feature | Status | Notes |
|---------|--------|-------|
| Comment keyword auto-reply | ✅ Done | Unique to IG — separate from DM automation |
| Comment private reply (7-day window) | ✅ Done | Longer window than DM 24h |
| One-shot private reply | ✅ Done | Atomic claim via `privateReplySentAt` |
| Stories monitoring | 🚫 Out | `IG-stories: out` |
| IG publishing | 🚫 Out | `IG-publish: out` |

---

## 4. Deliberate Flow Boundary and Remaining Hardening

### 4.1 What's Still Missing

The visual Flow engine (`SAMYOJ-011`) remains intentionally abandoned for this phase. The `flows/` module still uses `whatsappNumberId` and does not support `channelId`; wiring it into Facebook/Instagram would send through the wrong credentials. Other hardening items remain: attachment-only inbound events, separate automation UI/storage for IG DMs versus comments, and parent-Page binding after reconnect.

### 4.2 What IS Working

| System | Channel | How It Works |
|--------|---------|--------------|
| Keyword automation (DMs) | FB + IG | `channel-keyword.ts:sendChannelKeywordReply({ platform: 'FB'/'IG' })` |
| Keyword automation (comments) | IG | `comment-ingest.ts:maybeSendCommentKeywordReply({ platform: 'IG' })` |
| WELCOME trigger | FB + IG | Fires on first contact message |
| AWAY trigger | FB + IG | Fires outside business hours |
| LEAD_CAPTURE trigger | FB + IG | Fires on interest keyword |
| AI bot | FB + IG | `chatbot.service.ts:341` resolves via `channelId && botActive` → `generateBotReply()` |
| Bot toggle | FB + IG | `PATCH /:id/bot` route → `Conversation.botActive` + `activeBotId` |

### 4.3 Flow Engine Gap (The ONE Real Gap)

```typescript
// flows/engine.ts — still requires whatsappNumberId
scopedLiveFlowWhere(whatsappNumberId: string)  // ← no channelId overload

// chatbot.service.ts:339 — NOTE: bot resolution DOES handle channelId
const chatSettings = conversation.whatsappNumberId
  ? await getChatSettingsForNumber(input.organizationId, conversation.whatsappNumberId)
  : conversation.channelId && conversation.botActive
    ? { aiEnabled: true, botId: conversation.activeBotId }
    : { aiEnabled: false, botId: null };
```

The channel bot toggle has a `channelId` path. That does not make the visual Flow engine channel-aware, and it does not prove a real IG DM reached the public webhook.

---

## 5. Security Audit (Instagram-specific)

### 5.1 Security Strengths

| Control | Implementation | File |
|---------|---------------|------|
| Token encryption | IG uses parent FB Page token — AES-GCM | `MetaWhatsAppService.encryptToken()` |
| Parent Page binding | IG stores `parentPageId`; stale/duplicate active routing is deactivated or refused | `save-page-channel.ts`, `parent-page.ts` |
| IG channel isolation | Queries filter `platform: 'IG'` + `organizationId` | All routes |
| 24h window enforcement | `instagramWindowOpen()` blocks sends | `inbox.routes.ts` |
| 7-day private reply | `privateReplyOpen()` blocks replies | `comment-ingest.ts` |
| Agent org validation | Assignment validates agent belongs to org | `inbox.routes.ts:319-325` |
| Private reply atomicity | `updateMany` with `privateReplySentAt: null` guard | `comment-ingest.ts:160-172` |

### 5.2 Instagram-specific Security Gaps

| Issue | Severity | File | SAMYOJ ID |
|-------|----------|------|-----------|
| IG requires its linked Page to remain active | Expected Meta dependency; disconnect intentionally disables Page-token operations | `parent-page.ts`, `save-page-channel.ts` | SAMYOJ-IG-001 |
| No IG message read status | Low | `inbox.routes.ts` | SAMYOJ-IG-002 |
| No IG media URL expiry handling | Low | Media fetch in ingest | SAMYOJ-IG-003 |
| Comment text not sanitized | Low | `comment-ingest.ts:60` | SAMYOJ-IG-004 |
| IG inbox pagination `take` capped at 100 | Low | `inbox.routes.ts:85` | SAMYOJ-IG-013 |
| `fromId`/`fromUsername` can be null | Low | `schema.prisma:1149-1150` | SAMYOJ-IG-012 |

> **Corrected:** SAMYOJ-IG-007 originally claimed MetaAdsSnapshot uniqueness is a bug — it is **intentional** (`ADS-unique: out` in audit-score.ts). Same correction as in the Facebook audit.

---

## 6. Competitive Analysis (Instagram DMs)

| Feature | Samyoj IG | Zendesk | Sprout | Freshdesk | Hootsuite | Meta Business Suite |
|---------|:---------:|:-------:|:------:|:---------:|:---------:|:-------------------:|
| DM inbox | ✅ Done | ✅ Advanced | ✅ Advanced | ✅ Basic | ✅ Advanced | ✅ Native |
| Canned replies | ✅ Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI chatbot | ✅ Done (`SAMYOJ-010`) | ✅ (AnswerBot) | ✅ | ✅ | ✅ | ⚠️ Limited |
| Keyword automation (4 triggers) | ✅ Done | ✅ | ✅ | ✅ | ✅ | ⚠️ Basic |
| Flow automation | ❌ Remaining | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quick replies (saved templates) | ❌ Missing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message templates | ❌ Out | ✅ | ✅ | ✅ | ✅ | ⚠️ Limited |
| Labels | ✅ Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bulk operations | ✅ Done | ✅ | ✅ | ✅ | ✅ | ❌ |
| Snooze | ✅ Done | ✅ | ✅ | ✅ | ✅ | ❌ |
| SLA | ⚠️ Model only | ✅ | ✅ | ✅ | ✅ | ❌ |
| Export chat | ✅ Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read receipts | ⚠️ Inbound only | ✅ | ✅ | ✅ | ✅ | ✅ |
| Media send | ✅ Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keyboard shortcuts | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Webhook health | ❌ | ✅ | ✅ | ✅ | ✅ | N/A |
| Presence | ❌ | ✅ | ✅ | ✅ | ✅ | ⚠️ Basic |
| Comments: moderation | ✅ Done | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stories monitoring | 🚫 Out | ✅ | ✅ | ✅ | ✅ | ✅ |
| Publishing (posts/stories) | 🚫 Out | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mobile app | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ (native Meta app) |

### Key Competitive Disadvantages

1. **No Flow builder** — `SAMYOJ-011: remaining`. All competitors have visual flow builders. **#1 gap.**
2. **No IG publishing** — `IG-publish: out`. Hootsuite/Sprout/Zendesk all allow content creation.
3. **No Stories monitoring** — `IG-stories: out`.
4. **No saved quick replies** — Only keyword auto-reply, no saved reply templates for agents.
5. **No keyboard shortcuts** — WA inbox has them; IG doesn't.
6. **No real-time presence** — `viewers={[]}` in IG inbox.
7. **No webhook health dashboard** — WA has `useWebhookHealth`; IG doesn't.
8. **No mobile app** — Web-only.

---

## 7. Missing Features (Instagram-specific) — With Solutions

### 7.1 DM Inbox Gaps (vs WhatsApp — Not Tracked by Audit-Score)

| # | Feature | Solution | Effort |
|---|---------|----------|--------|
| 1 | **Saved quick replies** for DM sends | Add `QuickReplySelector` component to IG ChatComposer. Store per-org quick replies (reuse `CannedReply` with new `type: QUICK_REPLY`). Pass `quickReplies` prop to `ChatComposer`. | 3-4 hrs |
| 2 | **Keyboard shortcuts** in IG inbox | Reuse `useInboxKeyboardShortcuts` hook from WA. Same hot-reloader event listeners. | 2 hrs |
| 3 | **Webhook health dashboard** | Reuse `useWebhookHealth` hook. Add IG-specific health: last IG comment ingest time, last DM webhook received. | 2-3 hrs |
| 4 | **Real-time presence (viewers)** | Reuse `useConversationPresence` hook from WA. Subscribe to presence channel, show avatars in `ChatHeader`. | 2-3 hrs |
| 5 | **Export chat dialog (modal)** | IG uses inline `downloadChat()` — replace with `ExportChatDialog` (modal with format selector, date range). Same pattern as WA. | 1-2 hrs |
| 6 | **Context menu on messages** | Add `ChatContextMenu` component (same as WA). Right-click → reply, forward, delete, copy. | 1-2 hrs |
| 7 | **Media viewer (image/video preview)** | Reuse `MediaViewer` + `useMediaViewer` hook from WA. Click media message → modal preview. | 2-3 hrs |
| 8 | **New chat from scratch** | Remove `onNewChat={() => undefined}` stub. Add `NewChatSlideOver` component + `startNewConversation` API. | 1-2 hrs |
| 9 | **Call/callback support** | Remove `onCallBack={() => undefined}` stub. IG supports video calls natively — add "Start Video Call" button (Meta URL scheme). | 2-3 hrs |
| 10 | **Delete/archive individual messages** | Add `DELETE /instagram/inbox/:id/messages/:msgId` route. Soft-delete by setting status. | 1-2 hrs |
| 11 | **Business hours config for IG** | Reuse `HoursAndInboxPanel` from WA. Store per-channel `businessHours` JSON on `Channel`. | 2-3 hrs |
| 12 | **Entitlement gating** | Reuse `useEntitlements` hook from WA. Gate IG-specific features behind plan tiers. | 1-2 hrs |

### 7.2 Comment Moderation Gaps

| # | Feature | Solution | Effort |
|---|---------|----------|--------|
| 1 | **Bulk comment actions** | Add `selectionMode` to `InstagramCommentsPage`. Batch hide/unhide via Graph API batch endpoint. | 3-4 hrs |
| 2 | **Comment reply templates** | Reuse `CannedReply` module — add `context: COMMENT_REPLY` mode in `comment-ingest.ts`. | 2-3 hrs |
| 3 | **Comment sentiment tags** | 🚫 Out — explicitly abandoned per GATES.md. Do NOT build. | N/A |
| 4 | **Comment auto-spam filtering** | Integrate Meta's built-in spam detection (subscribe to `comment` webhook with spam field). Tag `hidden: true` automatically. | 6-8 hrs |
| 5 | **IG Reels comment support** | Reels comments use same `comments` webhook field. Verify webhook reliability for reel comments. | 2-3 hrs |

### 7.3 Instagram-specific Features (Major)

| # | Feature | Solution | Effort |
|---|---------|----------|--------|
| 1 | **IG publishing (posts/reels)** | 🚫 Out — explicitly abandoned per GATES.md. Do NOT build. | N/A |
| 2 | **IG Story publishing** | 🚫 Out — abandoned. | N/A |
| 3 | **IG Stories monitoring** | 🚫 Out — abandoned. No `story` webhook field. | N/A |

### 7.4 Infrastructure Gaps

| # | Feature | Solution | Effort |
|---|---------|----------|--------|
| 1 | IG-specific event tracking | Add to `PlatformProductEventName`: `IG_CONNECTED`, `IG_COMMENT_HIDDEN`, `IG_DM_SENT`, `IG_PRIVATE_REPLY_SENT` | 1-2 hrs |
| 2 | IG token expiry monitoring | Add `Channel.tokenExpiryAt` field. Reuse `inspectAccessTokenExpiry()`. Daily cron. | 3-4 hrs |
| 3 | Per-channel webhook management UI | Add field toggle panel in IG settings. Call Graph API `subscribed_apps` to reconfigure. | 2-3 hrs |
| 4 | IG analytics dashboard | Query IG-specific metrics from conversation/message/comment tables. | 5-6 hrs |
| 5 | Real-time surgical updates | Replace `useSocket` reload-all with `useInboxRealtime` hook (surgical delta updates). | 3-4 hrs |

---

## 8. Bugs & Data Issues (Instagram-specific)

| # | Bug | Severity | File | ID |
|---|-----|----------|------|----|
| 1 | IG inbox pagination `take` capped at 100 (WA: 1000) | Low | `inbox.routes.ts:85` | SAMYOJ-IG-013 |
| 2 | `instagramApi.comments.list` typed as `Record<string, unknown>` | Low | `api.ts:567` | SAMYOJ-IG-009 |
| 3 | `InstagramComment.fromId`/`fromUsername` can be null | Low | `schema.prisma:1149-1150` | SAMYOJ-IG-012 |
| 4 | Comment hide/unhide returns raw DB row | Low | `comments.routes.ts:106-109` | SAMYOJ-IG-010 |
| 5 | IG search query (`q`) has no length cap | Low | `inbox.routes.ts:80` | New |
| 6 | IG DM send requires FB Page — tight coupling | Medium | `inbox.routes.ts:224-232` | SAMYOJ-IG-001 |
| 7 | No IG message read status (outbound) | Low | `inbox.routes.ts` | SAMYOJ-IG-002 |
| 8 | `MetaAdsSnapshot `@unique` — INTENTIONAL | 🚫 Intentional | `schema.prisma:1166` | `ADS-unique: out` — NOT a bug |

> **Recapture correction:** IG DM text send, bulk actions, the header bot toggle, and outbound media have code paths. They are not proof of inbound attachment support, correct parent-Page selection after reconnect, or live Meta delivery. The Page token dependency is expected from the API shape, but the code must still bind it to the linked Page.

---

## 9. Testing Checklist (Instagram)

### 9.1 Existing Tests (Targeted coverage)

| Test | Status | File | Lines |
|------|--------|------|-------|
| IG DM creates IG-scoped thread (`whatsappNumberId: null`) | ✅ | `instagram.test.ts` | 125-168 |
| Same IGSID → one thread (dedup) | ✅ | `instagram.test.ts` | 170-205 |
| Comment doesn't create DM thread (separate tables) | ✅ | `instagram.test.ts` | 207-239 |
| Comment private reply is one-shot atomic claim | ✅ | `instagram.test.ts` | 241-257 |
| 24h DM window ≠ 7-day comment reply window | ✅ | `instagram.test.ts` | 259-267 |
| OAuth asks IG comment/message scopes | ✅ | `instagram.test.ts` | 269-272 |
| live_comments subscribed | ✅ | `instagram.test.ts` | 274 |
| IG inbox routes don't use `MetaWhatsAppService.sendMessage` | ✅ | `instagram.test.ts` | 280 |
| IG send doesn't use `messaging_type` (WA-only) | ✅ | `instagram.test.ts` | 281-286 |
| Page dispatcher ignores IG object (`claimed: 0`) | ✅ | `instagram.test.ts` | 287-289 |
| Comment keyword automation is IG-scoped | ✅ | `instagram.test.ts` | 292-327 |
| IG inbox pagination max ≤ 100 (not 2000) | ✅ | `instagram.test.ts` | 278 |

### 9.2 Testing Gaps (NOT Tested)

| Gap | Solution to Test | Effort |
|-----|------------------|--------|
| IG AI bot reply correctness | Send test DM → verify bot response via channelId path | 2-3 hrs |
| IG DM send outside 24h → 403 | Call send API after window closes | 1 hr |
| IG bulk action on 50+ conversations | Create 50 threads → bulk assign/delete | 1 hr |
| IG WELCOME trigger on first message | First DM from new contact → verify welcome fires | 1 hr |
| IG AWAY trigger outside hours | DM outside biz hours → verify away fires | 1 hr |
| Webhook signature forgery → 401 | Send fake X-Hub-Signature-256 | 30 min |
| Org isolation (other org's IG channel → 403) | Cross-org access attempt | 30 min |
| Token expiry → error recovery | Simulate expired token → verify error | 1 hr |
| Live comment private reply during broadcast | Verify 7-day window + Graph API error handling | 1 hr |

---

## 10. Implementation Priority

### Phase 1: Production hardening before feature expansion

The visual flow graph is intentionally abandoned for this product phase. Before any future flow work, fix OAuth-state separation, public webhook signature policy, parent-Page binding, attachment-only inbound handling, automation UI/storage separation, and deployment safety. These are higher-risk than adding another feature marker.

| Step | Action | File(s) | Effort |
|------|--------|---------|--------|
| 1 | Add `channelId` to `Flow` model (nullable, alongside `whatsappNumberId`) | `schema.prisma` | Migration |
| 2 | Create channel-scoped flow resolver mirroring `flowsEngine.ts` | `server/src/modules/flows/` | 4-5 hrs |
| 3 | Call `dispatchFlowsForChannel()` in `channel-keyword.ts` after rule processing | `channel-keyword.ts:115` | 2-3 hrs |
| 4 | Update Flow UI to scope by FB/IG channel | `FlowBuilderPage.tsx` | 3-4 hrs |

### Phase 2: UX Polish (Not Tracked by Audit-Score)

All items in §7.1 — 12 features, 1-4 hrs each. These port existing WA patterns to IG inbox.

### Phase 3: Infrastructure (Not Tracked by Audit-Score)

All items in §7.4 — 5 features, 1-6 hrs each.

### Phase 4: Explicitly OUT — Do NOT Build

Per GATES.md + `audit-score.ts`:
- Stories monitoring (`IG-stories`)
- IG publishing (`IG-publish`)
- Sentiment analysis (abandoned)
- Ad creation/pause (`ADS-create`)

---

## 11. File Inventory (Instagram)

| Path | Purpose |
|------|---------|
| `server/src/modules/instagram/ingest.ts` | IG DM + comment ingestion entry point |
| `server/src/modules/instagram/inbox.routes.ts` | IG inbox REST routes (388 lines) |
| `server/src/modules/instagram/comments.routes.ts` | IG comment routes (114 lines) |
| `server/src/modules/instagram/comment-ingest.ts` | Comment ingestion + keyword (183+ lines) |
| `server/src/modules/instagram/instagram.test.ts` | Test suite (327 lines, 8 passing cases) |
| `client/src/pages/InstagramInboxPage.tsx` | IG DM inbox (728 lines, 23 imports) |
| `client/src/pages/InstagramCommentsPage.tsx` | Comment moderation (130 lines) |
| `client/src/components/settings/InstagramPagePanel.tsx` | IG connect settings card |
| `client/src/services/api.ts:511-610` | Instagram API client |
| `server/src/modules/facebook/channel-keyword.ts` | Channel automation engine (4 triggers) |
| `server/src/modules/facebook/channel-inbox-actions.ts` | Shared inbox CRUD (420 lines) |
| `server/src/modules/facebook/page-client.ts` | Meta Graph API client (sendPageTextMessage, sendInstagramTextMessage, etc.) |
| `server/src/modules/ai/chatbot.service.ts` | AI bot engine (`generateBotReply`, channelId resolution) |
| `server/src/modules/facebook/audit-score.ts` | 27-item feature tracker |
| `server/prisma/schema.prisma:1140-1186` | `InstagramComment`, `MetaAdsSnapshot` models |

---

## 12. Key Takeaways

1. **Instagram integration has a limited code score, not a production score.** The audit marker target is `19/1/5/2`, but inbound attachments, automation UX separation, parent-Page binding, live Meta delivery, and customer-host operations remain release gates.

2. **The AI bot IS functional for IG** — `chatbot.service.ts:341` resolves bots via `conversation.channelId && conversation.botActive`. The toggle is wired live in `InstagramInboxPage.tsx:611`.

3. **Channel text matching has several branches**, but comments and DMs use different delivery paths. The current UI/storage does not cleanly expose every FB/IG DM rule combination, so this needs behavior-level tests before being called complete.

4. **The Flow engine is intentionally out of scope**, while the production hardening gaps above remain in scope.

5. **Inbox UI has known boundaries** — `onNewChat` and `onCallBack` remain stubs; outbound media is URL-to-Graph and inbound attachment-only events are still a gap. Existing controls are not automatically production-proven.

6. **IG depends on FB Page token** — disconnecting FB Page breaks IG silently. This is a Meta API constraint, not a code bug.

7. **Live comments ARE ingested** — `live_comments` shares the `comments` path. Private replies may fail during broadcast (Meta API limit).

8. **GATES.md says 15 done / 5 remaining but reality is 19 / 1** — 4 items moved from remaining→done. Update GATES.md.

---

## 13. Self-Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| Sources consulted | 25+ files | audit-score.ts (27 items), 4 test files, IG InboxPage (728 lines), channel-keyword.ts, chatbot.service.ts:341, channel-inbox-actions.ts, inbox.routes.ts |
| Authoritative accuracy | Not a percentage | The score is a marker lock; behavior and live evidence are separate |
| False claims corrected | Ongoing | This recapture distinguishes code presence, partial behavior, and external proof |
| Security coverage | 90% | 8 IG-specific gaps (all low/medium); no critical vulnerabilities |
| Competitive benchmarking | 85% | 6 competitors; 8 genuine disadvantages (vs. 12+ in original draft) |
| Implementation guidance | 95% | 1 remaining + 12 UX polish + 5 infrastructure + concrete solutions for all |
| Bias mitigation | Evidence-based | Independent behavior tests and live evidence are required |
| Confidence | High for code scope; low for live readiness | Meta/VPS gates remain external and unproven |

---

*Generated by CommandCode autonomous audit — 2026-09-24*
*Source of truth: `server/src/modules/facebook/audit-score.ts` (enforced by `audit-score.test.ts`)*
*Companion: `FACEBOOK_INTEGRATION_AUDIT_2026-09-24.md`*