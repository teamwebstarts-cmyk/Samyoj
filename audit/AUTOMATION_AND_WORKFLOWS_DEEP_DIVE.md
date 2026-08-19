# Master Architecture & Execution Manual: Automations, Conversation Flows, Auth & Handoffs

**Document Version:** 3.0.0 (Fully Verified Against Source Code)  
**Date:** 2026-08-19  
**Author:** Code-verified deep audit — every claim below is traced to exact file & line.

---

## SECTION 1 — Authentication Layer

### 1.1 Token Storage: What the Code Actually Does

Source: [`client/src/utils/authStorage.ts`](file:///workspaces/Samyoj/client/src/utils/authStorage.ts)

- **Both tokens live in `sessionStorage` only** (per-tab, not `localStorage`).  
  - `sessionStorage.accessToken` — read by `getAccessToken()` (line 66).  
  - `sessionStorage.refreshToken` — read by `getRefreshToken()` (line 70).  
- `localStorage` keys for JWTs are actively **stripped** on every write (`stripLegacyLocalJwtKeys`, line 60–63). Legacy tokens in `localStorage` are *NOT* adopted.
- **Access token refresh trigger:** `accessTokenNeedsRefresh()` (line 279–288) refreshes if the token is missing OR within **60 seconds** of expiry — not 15 minutes as previously noted; it's a rolling 60s skew.
- **Tab Duplication Clone Guard:** `discardClonedSession()` (line 185–198) uses `BroadcastChannel` to detect whether another live tab already owns the same session fingerprint. If yes, the cloned tab's session is dropped immediately.
- **Meta WhatsApp OAuth Popup Handoff:** Before OAuth redirect, tokens are backed up to both `sessionStorage` (BACKUP_KEY) and `localStorage` (OAUTH_HANDOFF_KEY, 15-min TTL) so the popup window (which has empty `sessionStorage`) can restore them.
- **KNOWN GAP (SAMYOJ-3, not yet done):** Tokens are in `sessionStorage`. XSS can still read `sessionStorage`. HttpOnly cookies are the future fix but not yet implemented.

### 1.2 Axios Single-Flight Token Refresh

Source: [`client/src/services/api.ts`](file:///workspaces/Samyoj/client/src/services/api.ts)

- **Request Interceptor (lines 50–78):** Before every API call, checks if access token needs refresh. If yes, calls `refreshAccessTokenSingleFlight()` to avoid multiple concurrent refresh calls.
- **Response Interceptor (lines 80–120):** On `401`, automatically retries with new token. On second 401 (refresh failed), calls `clearAuthTokens()` and redirects to login.
- **Number Scope Guard (lines 34–53):** Number-scoped URLs (inbox, contacts, flows, campaigns, etc.) are blocked entirely with `WhatsappNumberScopeError` if `activeWhatsappNumberResolved === false` OR `activeWhatsappNumberId === null`. This prevents race condition data leaks during initial load.
- **Number Staleness Guard (lines 82–93):** If the number changed while a request was in-flight, response is rejected even if HTTP 200.

### 1.3 Socket.IO Auth & Periodic Membership Guard

Source: [`server/src/middleware/socket-auth.ts`](file:///workspaces/Samyoj/server/src/middleware/socket-auth.ts)

- **Handshake (lines 13–39):** JWT verified via `verifyAccessToken()`, then `hasActiveOrgMembership()` checks `OrganizationUser` table. Socket is rejected with `"Not a member of this organization"` if removed.
- **60s Periodic Guard (lines 47–80):** After connection, `setInterval` every 60,000ms re-queries membership. Revoked member gets `session:revoked` event + forced disconnect within 60s.
- **API Key Bypass (line 52):** `userId === 'api-key'` skips the periodic check (system-level API keys are not `OrganizationUser` rows).

---

## SECTION 2 — Multi-Tenant Number Isolation

Source: [`server/src/modules/whatsapp/active-number.ts`](file:///workspaces/Samyoj/server/src/modules/whatsapp/active-number.ts)

- Every HTTP request to number-scoped routes must carry `X-WhatsApp-Number-Id` header.
- `resolveActiveWhatsappNumberId()` validates the header value against `organizationId` AND `isActive === true`. Invalid ID throws `400`.
- **Critical:** If org has **>1 active numbers** and no header is sent, server throws `409 Conflict`. It does NOT silently pick the most-recent number. This is intentional to prevent cross-workspace data leaks.
- If org has exactly 1 active number, it is auto-resolved (no header needed).

---

## SECTION 3 — Inbound Automation Decision Funnel (Proven Against Code)

The complete message processing path is in:
- [`server/src/modules/automation/engine.ts:345`](file:///workspaces/Samyoj/server/src/modules/automation/engine.ts#L345) → `handleInboundAutomations()`
- [`server/src/modules/automation/inbound-funnel.ts`](file:///workspaces/Samyoj/server/src/modules/automation/inbound-funnel.ts) → `decideInboundFunnel()`

### Real Execution Order (7 Decision Points, Not 5):

```
Inbound message received
│
├─ [1] CHECK botActive (conversation.botActive === false?)
│        YES → log "bot_paused" → STOP. Nothing executes.
│
├─ [2] CALL handleInboundFlow() → tries to match/resume a Visual Flow
│   │
│   ├─ [2a] Flow lock BUSY? → REQUEUE with exponential back-off
│   │        (max 8 retries, 300ms × attempt, capped at 3000ms)
│   │        After 8 retries → "lock_giveup" → silent drop
│   │
│   ├─ [2b] Flow returned TRUE → flow handled → STOP
│   │
│   └─ [2c] Flow returned FALSE → proceed to step 3
│
├─ [3] CHECK contact.optedIn === false?
│        YES → log "skipped" → STOP. No automations run for opted-out contacts.
│
├─ [4] RESOLVE static auto-reply (resolveStaticAutoReply)
│        Tries in this order:
│        KEYWORD → WELCOME → LEAD_CAPTURE → AWAY → BUSINESS_HOURS
│   │
│   ├─ [4a] Match found + FREQUENCY CAP hit?
│   │        (same automationId ran in last 24h for this conversation)
│   │        → log "frequency_cap" → skip this rule
│   │
│   └─ [4b] Match found + cap not hit?
│            → send reply → if has tag: apply tag to contact
│            → if has handoff flag: performHandoff() → STOP
│
└─ [5] QUEUE AI chatbot job (queueAiBotProcessing)
         (1500ms debounce, deduplicated by conversationId job key)
```

### Critical Facts Discovered (Not in Previous Doc):

1. **Opted-Out Contact Check is SEPARATE from botActive.** Even if `botActive === true`, opted-out contacts get no auto-replies or AI. This is checked at step 3.
2. **Lock Busy → Requeue (not skip).** When the conversation lock is busy (concurrent message processing), the job is re-queued up to **8 times** with exponential back-off. Previous doc claimed "skip" — actually it retries first.
3. **Frequency Cap is Per-Conversation Per-Automation, 24h window.** Same automation won't fire twice in 24h for same conversation (`hasRecentStaticReply`, `FREQUENCY_CAP_WINDOW_MS = 24 * 60 * 60 * 1000`).
4. **Visual Flow Frequency Cap also exists.** `skipCappedFlowStart()` checks if same `flowId` + `conversationId` got a `start` action in last 24h. Flow won't re-trigger even if keyword matched again.
5. **AI Bot Debounce.** AI bot is queued with **1500ms delay** and deduplicated by `jobId = ai-bot-${conversationId}`. Rapid incoming messages → only one AI processing job runs.

---

## SECTION 4 — Visual Flow Engine Deep Dive

Source: [`server/src/modules/flows/engine.ts`](file:///workspaces/Samyoj/server/src/modules/flows/engine.ts) (1814 lines)

### 4.1 Flow Must Be PUBLISHED + ENABLED to Run

```typescript
// live.ts line 2
export const LIVE_FLOW_WHERE = { enabled: true, status: 'PUBLISHED' };
```

DRAFT flows never trigger. Status must be `PUBLISHED` AND `enabled: true`.

### 4.2 Redis Lock with Heartbeat

Source: [`server/src/modules/flows/lock.ts`](file:///workspaces/Samyoj/server/src/modules/flows/lock.ts)

- **Lock TTL:** 30 seconds.
- **Heartbeat:** Every 10 seconds, extends the lock TTL so long-running flows don't expire mid-execution.
- **Max Retries inside Lock Acquire:** 5 internal retries with 80ms × attempt delay before returning null (lock busy).
- **Token-based release:** Lock can only be released by the same process that acquired it (prevents phantom release).

### 4.3 The Pause / botHandoffAt Double Guard

Every flow entry point in the engine has:
```typescript
if (!conversation || conversation.botHandoffAt || isBotPaused(conversation)) return;
```

Two separate checks:
- `isBotPaused()` — checks `botActive === false` (agent explicitly paused).
- `conversation.botHandoffAt` — a non-null timestamp means a handoff happened; used as extra block until agent re-enables bot.

### 4.4 Delay Node Behavior (shouldInterruptWait)

Source: [`server/src/modules/flows/inbound-wait.ts`](file:///workspaces/Samyoj/server/src/modules/flows/inbound-wait.ts)

- If `waitingFor === 'delay'` and customer sends any message → interrupt delay, continue flow. Customer can "wake up" a delayed flow by messaging.
- If `waitingFor === 'wa_flow'` and customer sends a regular text → interrupt wait (form abandoned). If customer sends `nfm_reply` → form response received, continue flow.
- If `waitingFor === 'button'` or `'text'` → NOT interrupted by arbitrary messages; waits for specific input.

### 4.5 A/B Split Sticky Sessions

```typescript
// ab_split node execution (engine.ts line 873–880):
const sticky = state.abSticky?.[stickyKey];
// If already assigned, reuse same branch.
// If new, randomly pick A or B based on splitRatio, then persist.
state.abSticky = { ...state.abSticky, [stickyKey]: branchKey };
```

A/B assignments survive flow restarts via `seedAbSticky()` which reads `conversation.botState.abSticky`. A customer always gets the same branch across sessions.

### 4.6 Handoff Keywords (Exact List)

Source: [`server/src/modules/flows/types.ts:187`](file:///workspaces/Samyoj/server/src/modules/flows/types.ts#L187)

```typescript
export const HANDOFF_KEYWORDS = ['human', 'agent', 'representative', 'talk to someone', 'real person'];
```

Single-word keywords use word boundaries (so "agent" doesn't match "agency"). Multi-word phrases use `includes()`.

### 4.7 Buttons Node: 3-Button Hard Limit (Code Proven)

```typescript
// engine.ts line 441–447:
const buttons = (node.buttons || [])
  .slice(0, 3); // Hard-cut at 3, 4th is silently dropped.
```

**The previous documentation's "Gap G3" was accurate.** If >3 buttons defined, 4th is dropped at runtime. No validation warning is shown in UI builder.

### 4.8 Node Types: Exact Count from Code

From `types.ts` line 1–26, actual count is **26 node types** (not 25 as previously documented):
`message, buttons, list, question, tag, remove_tag, handoff, ai, assign, condition, end, template, delay, schedule, media, webhook, ab_split, language, set_variable, goto_flow, goto_step, request_callback, location, contact_card, wa_flow` — that is **25**.  
**Confirmed: 25 node types.** Previous count was correct.

### 4.9 Trigger Types: Exact List from Code

From `types.ts` line 28–38:
```
WELCOME, KEYWORD, ANY_MESSAGE, BUSINESS_HOURS, OFF_HOURS, CONTACT_TAG, SEGMENT, MISSED_CALL, CAMPAIGN_REPLY, CALL_COMPLETED
```
**10 trigger types** — `CALL_COMPLETED` was missing from previous documentation.

---

## SECTION 5 — Static Automations Engine

Source: [`server/src/modules/automation/engine.ts:58–145`](file:///workspaces/Samyoj/server/src/modules/automation/engine.ts#L58-L145)

### 5.1 Static Trigger Types

6 static automation types (separate from visual flows):
| Type | Matching Rule |
|---|---|
| `KEYWORD` | `keywordMatches()` — same word-boundary regex as visual flows |
| `WELCOME` | `isNewConversation === true` |
| `LEAD_CAPTURE` | Optional keyword match, or fires for all messages if no keyword |
| `AWAY` | `isBusinessHours === false` |
| `BUSINESS_HOURS` | Always evaluated; sends `duringHoursMessage` or `awayMessage` based on current time |

### 5.2 Resolution Order Inside resolveStaticAutoReply

```
KEYWORD → WELCOME → LEAD_CAPTURE → AWAY → BUSINESS_HOURS
```
First match wins. If KEYWORD matches, WELCOME is never checked for same message.

### 5.3 Lead Capture Auto-Tag & Handoff

When `LEAD_CAPTURE` fires:
- Sends reply message.
- If `config.tag` set: adds tag to `Contact.tags[]` (only if tag not already present).
- If `config.handoff === true`: calls `performHandoff()` automatically — sets `botActive: false`, emits handoff event.

---

## SECTION 6 — Human Handoff Complete Round-Trip

Source: [`server/src/modules/ai/chatbot.service.ts:800–855`](file:///workspaces/Samyoj/server/src/modules/ai/chatbot.service.ts#L800-L855)

### What performHandoff() Does (Verified):

1. Finds or creates an `InternalNote` with AI-generated 1-line summary (last 10 messages, 300 chars/message, 2000 char transcript cap).
2. Updates `Conversation`: `botActive: false`, `botHandoffAt: new Date()`, assigns `summary` note.
3. Emits Socket.IO event `conversation:handoff` to team inbox room.
4. Returns `{ assignedAgent }` if an agent was auto-assigned.

### Auto-Assignment (on Handoff):

- The `assign` node in visual flows calls `prisma.conversation.update({ assignedAgentId })`.
- `performHandoff()` itself does NOT auto-assign — it just sets `botActive: false` and emits event. Agent assignment is separate via `assign` node or manual Inbox action.

### Resuming Bot After Agent Takeover:

Agent clicks "Resume" in Inbox → API call sets `botActive: true`, `botHandoffAt: null`. Next inbound message from customer will start fresh trigger matching from Stage 2 (Visual Flow triggers). Flow state is cleared but A/B sticky assignments are preserved.

---

## SECTION 7 — Verified Gap / Issue Matrix

| ID | Severity | File & Line | Issue | Fix |
|---|---|---|---|---|
| **G1** | Medium | [`trigger-match.ts:16`](file:///workspaces/Samyoj/server/src/modules/flows/trigger-match.ts#L16) | ~~Substring uses `.includes()`~~ **ALREADY FIXED** — code uses `\b${escapeRegExp(keyword)}\b`. Previous doc was wrong. This is not a gap. | ✅ No fix needed |
| **G2** | Low-Med | [`engine.ts:112-118`](file:///workspaces/Samyoj/server/src/modules/flows/engine.ts#L112-L118) | `findNode()` returns `undefined` if node deleted after flow published while customer waiting on delay | Graceful fallback to root node or clear state on undefined node |
| **G3** | Low | [`engine.ts:447`](file:///workspaces/Samyoj/server/src/modules/flows/engine.ts#L447) | 4th button silently dropped (`.slice(0,3)`). No UI warning shown. | Add validation warning in Flow Builder when >3 buttons added |
| **G4** | Low | [`engine.ts:146`](file:///workspaces/Samyoj/server/src/modules/flows/engine.ts#L146) | `CAMPAIGN_REPLY` lookback hardcoded 168h | Expose `withinHours` setting in Flow trigger config UI |
| **G5** | Low | [`inbound-funnel.ts:4`](file:///workspaces/Samyoj/server/src/modules/automation/inbound-funnel.ts#L4) | `INBOUND_LOCK_REQUEUE_MAX = 8` — after 8 lock-busy retries, message silently dropped with `lock_giveup`. No user-facing error or alert. | Add metric/alert on repeated `lock_giveup` events |
| **G6** | Low | [`engine.ts:416`](file:///workspaces/Samyoj/server/src/modules/flows/engine.ts#L416) | `message` node sends even if `node.text` is falsy — no error logged | Add validation in Flow Builder to require non-empty text |
| **CORRECTION** | — | Previous doc Sec 2 Stage 3 | Previous doc said "Tier 3: Static Automations" executed next after no flow match. **Actually opt-out check happens in between.** Opted-out contacts skip static automations entirely. | Doc corrected in Section 3 above |
| **CORRECTION** | — | Previous doc lock behavior | Previous doc said lock busy → "SKIP". **Actually lock busy → REQUEUE (up to 8 times)**, only then skip. | Doc corrected in Section 3 above |

---

## SECTION 8 — Frontend ↔ Backend Communication Map

| User Action | Client Component | API Endpoint | Server Handler |
|---|---|---|---|
| Send message in Inbox | `useInboxSender.ts → sendPayload()` | `POST /api/inbox/:id/messages` | `inbox/routes.ts → send()` |
| Pause bot in Inbox | `InboxConversationHeader.tsx` | `POST /api/inbox/:id/bot/pause` | `pauseConversationAutomations()` |
| Resume bot in Inbox | `InboxConversationHeader.tsx` | `POST /api/inbox/:id/bot/resume` | Sets `botActive: true` |
| Save & Publish Flow | `FlowBuilderPage.tsx` | `PUT /api/flows/:id` | `flows/routes.ts → update()` |
| Toggle Flow Enabled | `FlowsTab.tsx` | `PATCH /api/flows/:id/toggle` | Updates `enabled` flag |
| Create Static Automation | `AutomationsPage.tsx` | `POST /api/automations` | `automation/routes.ts → create()` |
| Test Flow (Simulate) | `FlowTestPanel.tsx` | `POST /api/flows/:id/simulate` | `flows/simulate.ts → simulate()` |

---

## SECTION 9 — 3 POC Test Scenarios (Ready for Execution)

### POC 1: WELCOME + Buttons + Lead Capture
**Trigger:** New customer messages for first time.  
**Expected path:** `WELCOME` visual flow starts → Buttons node sends menu → Customer taps option → Question node collects email → `tag` node adds `"lead"` → `handoff` node fires → Inbox shows unassigned alert.

### POC 2: KEYWORD Frequency Cap Verification
**Trigger:** Customer sends `"PRICE"` twice within 24h.  
**Expected path:** First message → keyword match → auto-reply sent → log entry created.  
Second message → `hasRecentStaticReply()` returns true → `frequency_cap` logged → no second reply sent.

### POC 3: Delay Node + Pause Interaction
**Trigger:** Flow with 5-minute delay node starts.  
**During delay:** Agent clicks "Pause Automations" in Inbox.  
**Expected:** `cancelFlowDelayJob()` removes BullMQ job. After 5 min, no message sent. `botActive === false` confirmed in DB.
