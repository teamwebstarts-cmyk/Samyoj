# Inbox readiness review — 2026-08-05

**Mode:** Feature deep-dive (frontend + backend + QA lens)  
**Scope:** `/inbox` only (list · thread · composer · details · overlays · realtime · number scoping)  
**Not in scope:** Dashboard redesign, Calls POC, Campaigns builder, Connect OAuth security backlog (except where Inbox depends on it)  
**Method:** Re-read current client/server code (not chat memory alone); cross-check `FEATURE_MATRIX.md` and older inbox audit docs for drift; runtime health spot-check.

---

## 1. Verdict (blunt)

**Inbox is demo- and team-usable with strong UI and a solid messaging core — it is not yet “100% production-complete / next-feature-safe” until number-scoped `:id` routes, disconnect→reconnect history policy, and automated Inbox tests land.**

UI polish is ahead of the Aug 3 plan. Several “missing” items in old docs are **already fixed** (drafts, load-earlier, Meta markAsRead, disconnect empty list). Remaining gaps are mostly **product honesty stubs**, **tenancy consistency**, **observability**, and **zero Inbox automated tests**.

**Overall confidence to “close Inbox and move on”: 7.2 / 10**  
**Confidence for paying multi-agent production without a hardening sprint: 6.0 / 10**

---

## 2. Scorecard

| Area | Score | Why |
|------|------:|-----|
| UI / IA / polish | **8.5** | 3-pane IA, empty states, selection, placeholders look intentional; user sign-off on look. Residual a11y/motion debt. |
| Feature completeness (agent daily work) | **8.0** | Text/media/template/interactive/reactions/retry/assign/status/snooze/notes/labels/bot/export/ticket/payment/bulk wired. Stubs: mark-as-unread, calling. |
| WhatsApp rules (24h / templates / Meta read) | **8.5** | Service window tri-state, template auto path, `markAsRead` fire-and-forget on open. |
| Number scoping & disconnect honesty | **7.5** | List/unread empty when disconnected (client + `conversationFilter`). `:id` routes still org-only / weak number checks; disconnect nulls `whatsappNumberId` → history orphan on reconnect. |
| Realtime & presence | **8.0** | Socket surgical updates + reconnect catch-up; optimistic send dedupe. Silent `.catch` on some fetches. |
| Error handling (agent-facing) | **7.5** | Toasts + chat notices + list retry + failed bubble retry. Some silent swallows (`realtime` get, markRead). |
| Server logging / bug observability | **5.5** | Inbox routes barely log beyond Meta markAsRead failures. Hard to triage send/webhook issues from Inbox logs alone. |
| Security / tenancy (Inbox-specific) | **7.0** | Org auth on routes; bulk validates ownership; signed media URLs exist. Incomplete active-number enforcement on many `/:id/*` endpoints. |
| Automated tests | **2.0** | **No** `inbox` / conversation Vitest files under `server/src`. Flows/AI/campaigns have tests; Inbox does not. |
| Docs honesty vs code | **6.5** | `FEATURE_MATRIX` mostly DONE (fair). `INBOX_UI_COMPREHENSIVE_PLAN` (Aug 3) is **stale** on drafts / load-earlier / markAsRead / SLA chip. |

---

## 3. Feature inventory (what we actually ship)

### 3.1 Conversation list
| Capability | Status | Evidence |
|------------|--------|----------|
| Paginated list (`page` + `limit`) | Done | `useConversationList.ts`, `GET /api/inbox/` |
| Search name/phone | Done | list query `search` |
| Status chips Open/Pending/Closed | Done | `InboxListHeader` |
| Unread / Favourites chips | Done | `ListChip` |
| Agent filter (+ Assigned to me) | Done | Filters popover |
| Bulk select → assign / close / snooze | Done | `BulkSelectionBar`, `POST /bulk` |
| Context menu | Done | `ChatContextMenu` |
| Empty / filtered empty / disconnected empty | Done | `InboxListEmpty` + disconnect gate |
| Inbound health banner + RETRY | Done | `useWebhookHealth` + header |
| Virtualized infinite list | **Not done** | Classic pagination only (`ConversationList.tsx`) |

### 3.2 Thread & messaging
| Capability | Status | Evidence |
|------------|--------|----------|
| Open thread + messages | Done | `useConversationThread` |
| Load earlier (cursor) | Done | `hasEarlier` / `onLoadEarlier` in `ChatThread` |
| Optimistic send + socket ack dedupe | Done | `useInboxSender`, `useInboxRealtime` |
| Status ticks (sent/delivered/read/failed) | Done | bubbles + `message:status` |
| Failed message retry | Done | `POST /messages/:id/retry` |
| Media attach + limits | Done | `mediaLimits.ts`, notices |
| Templates / interactive / reactions | Done | composers + `REACTION` send |
| Search in chat | Done | `SearchInChatBar` |
| Media gallery | Done | `MediaViewer` |
| Per-chat drafts (`sessionStorage`) | Done | `useDraft.ts` |
| Meta mark-as-read (customer blue ticks) | Done | `POST /:id/read` → `MetaWhatsAppService.markAsRead` |
| Mark as unread | **Stub UI** | `ChatHeader` “Soon” |
| Calling from chat | **Stub UI** | “Calling coming soon” |

### 3.3 Details / CRM around a chat
| Capability | Status | Evidence |
|------------|--------|----------|
| Assign / status / snooze / favourite | Done | actions + APIs |
| Bot on/off + bot picker | Done | toast feedback |
| Labels / tags / internal notes | Done | details panel |
| Stats (chats / tickets / avg first response) | Done | `StatsRow` + `GET /:id/stats` |
| Export transcript | Done | `ExportChatDialog` |
| Create ticket / payment link | Done | modals |
| Presence (who’s viewing) | Done | `useConversationPresence` |

### 3.4 Realtime events (client handles)
`message:new`, `message:status`, `message:reaction`, `conversation:read|status|snooze|updated|assigned|bot|handoff` (+ reload on reconnect).

### 3.5 Server API surface (`server/src/modules/inbox/routes.ts`)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/messages/:id/media` | Signed (pre-auth) + authed blob |
| GET | `/unread-total` | Number-scoped via `conversationFilter` |
| GET | `/` | List — number-scoped |
| POST | `/start` | New chat on active number |
| GET | `/messages/:id/media-url` | Signed URL helper |
| POST | `/messages/:id/retry` | Failed outbound retry |
| GET | `/:id` | Org-scoped; **partial** number check |
| GET | `/:id/stats` | Org-scoped only |
| GET | `/:id/export` | Org-scoped |
| GET/POST | `/:id/messages` | Org-scoped; send requires linked WA number |
| POST | `/:id/read` | Local unread + Meta markAsRead |
| PATCH | `/:id/assign`, `/bot`, `/snooze`, `/favorite`, `/status` | Org-scoped |
| POST/DELETE | snooze, notes | Org-scoped |
| POST | `/bulk` | Validates ids against org **+** number filter |

---

## 4. What improved since older audits (doc drift)

| Old claim (Aug 3 plan / pixel diff) | Current reality (2026-08-05) |
|-------------------------------------|------------------------------|
| Drafts missing (P0) | **Shipped** — `useDraft` |
| Load-earlier never called | **Shipped** — wired in `InboxPage` → `ChatThread` |
| Meta `markAsRead` never called | **Shipped** — fire-and-forget in `POST /:id/read` |
| Dead unconditional SLA chip | **Gone** from current `InboxListHeader` (chips = All/Open/Pending/Closed + unread/favourites) |
| Disconnect still shows all chats | **Fixed** — empty `conversationFilter` + client gate (this week) |
| Selected row heavy green glass | **Simplified** (recent UI pass) |

Treat `docs/audit/INBOX_UI_COMPREHENSIVE_PLAN.md` as historical north star, not live status.

---

## 5. Critical / High findings

### H1 — Disconnect unlinks history forever (product + data)
- **Why:** `DELETE /whatsapp/numbers/:id` sets `conversation.whatsappNumberId = null` then deletes the number. Reconnect creates a **new** number id → old chats never reappear under the new connection.
- **Evidence:** `server/src/modules/whatsapp/routes.ts` disconnect transaction; list filter `{ whatsappNumberId: numberId }`.
- **Impact:** Agents think data “vanished”; support tickets; contradicts “connected number’s data” unless intentional archive.
- **Fix options (pick product):**
  1. Soft-deactivate number (`isActive: false`) instead of delete + keep FK; or
  2. On reconnect matching `phoneNumberId`, re-attach conversations; or
  3. Explicit “Archive inbox on disconnect” copy + admin export.
- **Verify:** Connect → chat → disconnect → reconnect same Meta number → chats still visible (or explicit empty with archived banner).

### H2 — Many `/:id/*` routes are org-scoped, not active-number-scoped
- **Why:** List uses `conversationFilter`; get/send/assign/status/read mostly `findFirst({ id, organizationId })`. Get `/:id` only 404s if **both** active id and conversation number id are set and differ — **orphans (`whatsappNumberId: null`) still open via deep link**.
- **Evidence:** `routes.ts` `GET /:id` ~471–501; contrast `GET /` + `POST /bulk`.
- **Impact:** Cross-number leakage inside same org if multiple numbers; deep-link to orphans; inconsistent with “only connected number’s data”.
- **Fix:** Shared helper `assertConversationOnActiveNumber(orgId, id, numberId)` on every `/:id` route; when `!numberId` → 404/403.
- **Verify:** Active number A cannot open/send on conversation owned by number B; disconnected → all `/:id` 404.

### H3 — Zero automated Inbox tests
- **Why:** Confidence cannot be “100%” without regression nets on filter empty, bulk tenancy, 24h window, retry, markAsRead failure paths.
- **Evidence:** `server/src/**/*.test.ts` has flows/AI/campaigns only — **no inbox tests**.
- **Fix:** Vitest suite for `conversationFilter`, list when `numberId` undefined, bulk invalid ids, send outside 24h → 400.
- **Verify:** `cd server && npm test` includes inbox cases.

### H4 — Inbound path still infra-dependent (not an Inbox UI bug)
- **Why:** Health can show `totalReceived: 0` with tunnel up until a real reply arrives; empty webhook URL = broken inbound.
- **Evidence (runtime 2026-08-05):** API healthy; webhook URL set to ngrok; `totalReceived: 0` (expected without live phone traffic).
- **Fix:** Keep runbook; do not “fix Inbox” when tunnel/Meta registration is wrong.
- **Verify:** Challenge `ping` + phone reply increments health.

---

## 6. Medium / Low

| ID | Issue | Severity | Notes |
|----|-------|----------|-------|
| M1 | Inbox server logging sparse | Medium | Prefer structured `logger.error` on send/Meta failures with `conversationId`, Meta code, `fbtrace_id` |
| M2 | Silent client `.catch(() => undefined)` on realtime refetch / markRead | Medium | Prefer toast once or debug log in DEV |
| M3 | Mark as unread stub | Medium | Hide until API exists, or ship `PATCH unread` |
| M4 | Calling stub in chat header | Low/Med | Hide or deep-link to Calls when ready |
| M5 | List not virtualized | Medium at scale | OK for ≤ few hundred with page size 10–50; revisit at 1k+ |
| M6 | Filter chips Unreplied / Has ticket / Bot active | Low | Server query params exist (`unreplied`, `hasOpenTicket`, `botActive`); UI chips not exposed |
| M7 | A11y / reduced-motion gaps | Medium | Still relevant from Aug plan; not blocking daily use |
| M8 | Stats `totalChats` is contact-wide, not number-scoped | Low | May inflate across numbers |
| L1 | Doc drift in FEATURE_MATRIX “All DONE” | Low | Mark stubs honestly |

---

## 7. Error handling & bug visibility (QA lens)

### Agent-facing (good enough for daily ops)
- List load failure → error state + Retry
- Send failure → chat notice + failed bubble + Retry
- Media over limit → amber notice
- Assign/status/bot/snooze/bulk → `toastError` with server message when present
- Thread load → toast / error path (stale-response guards in `useConversationThread`)
- Export failure → toast

### Gaps
- Meta error codes (e.g. `#131030` allowlist) may surface as generic strings unless mapped
- Server Inbox module does not consistently log failed outbound Meta responses for later grepping in `.run/logs/`
- Webhook processing errors live more in WhatsApp webhook health (`lastError`, `lastFbTraceId`) than Inbox UI — agents need Settings/health literacy

### Recommended “bug management” minimum
1. Standard Meta error → human copy map (131047 window, 131030 allowlist, media size, rate limit)
2. Always log outbound Meta failures with `conversationId`, `messageId`, code, `fbtrace_id`
3. Inbox “Diagnostics” strip for OWNER: last webhook receive + last send error (optional, hide from agents)

---

## 8. Recommended QA checklist (manual — run before declaring Inbox closed)

Use a **connected** test number + allowlisted customer phone.

### Connection honesty
- [ ] Disconnected → Inbox list empty + Connect CTA (not old chats)
- [ ] Connect number A → only A’s chats
- [ ] Switch to number B (if multi) → list swaps; no A bleed
- [ ] Disconnect policy agreed (history keep vs wipe) and verified

### Messaging
- [ ] Text send inside 24h
- [ ] Media image/pdf/voice within limits; over-limit blocked
- [ ] Outside 24h → template-only path works; free text blocked with clear copy
- [ ] Interactive (reply buttons / list / CTA) send + render
- [ ] Reaction send + inbound reaction socket update
- [ ] Failed message → Retry succeeds or shows Meta reason
- [ ] Draft survives switching chats and returns

### Thread hygiene
- [ ] Load earlier messages when scrolling up
- [ ] Search in chat finds matches
- [ ] Unread badge clears on open; customer gets read receipt (Meta)
- [ ] Realtime: second browser tab sees new inbound without refresh
- [ ] Reconnect socket recovers list

### CRM actions
- [ ] Assign / unassign / bulk assign
- [ ] Status Open→Pending→Closed
- [ ] Snooze / unsnooze
- [ ] Labels + notes CRUD
- [ ] Bot on/off + switch bot
- [ ] Export txt/json
- [ ] Ticket create + payment link (if billing configured)

### Negative paths
- [ ] Deep-link `?conversation=` for other-number / orphan → 404 or empty, no send
- [ ] Invalid bulk ids rejected
- [ ] Tunnel down → health banner unhealthy; outbound may still work

---

## 9. Pros / cons

### Pros
- Cohesive 3-pane product surface; overlays are real, not mock-only
- Messaging core (window, templates, media, retry, realtime) is mature for a WhatsApp CRM
- Recent disconnect empty-list fix aligns product honesty
- Client error UX (notices + toasts) is better than average early SaaS
- Number header + cache pattern exists for multi-number orgs

### Cons
- “100% done” claim fails on stubs + no tests + disconnect history policy
- Tenancy for active number incomplete on detail routes
- Observability thin for support/debug
- Scale path (virtualization) deferred
- Older audit docs can mislead future agents if not superseded

---

## 10. Decision for “move to next feature?”

| If your bar is… | Recommendation |
|-----------------|----------------|
| **UI freeze + agent demo / beta** | **Yes, proceed** — track H1–H3 as Inbox hardening backlog (1–3 days) |
| **Paid multi-tenant production** | **Not yet** — ship H1 product decision + H2 number assert + H3 smoke tests first |
| **Literally “Inbox 100% complete forever”** | **No** — mark-unread, calling, a11y, virtualization, Meta error map still open |

### Do next (max 5, priority order)
1. **Decide disconnect history policy** and implement (soft delete vs re-link vs archive).
2. **Assert active-number on all Inbox `/:id` routes** (shared helper).
3. **Add Vitest**: empty filter, bulk tenancy, 24h send reject.
4. **Structured Meta send error logging** + humanize top Meta codes in UI.
5. **Hide or finish stubs** (mark unread / calling) so “Soon” does not look half-shipped.

---

## 11. Sources re-checked

- `client/src/pages/InboxPage.tsx`, `client/src/components/inbox/**`
- `server/src/modules/inbox/routes.ts`, `active-number.ts`, WhatsApp disconnect in `whatsapp/routes.ts`
- `docs/audit/FEATURE_MATRIX.md`, `INBOX_UI_COMPREHENSIVE_PLAN.md`, `ui-specs/inbox-content-poc.md`
- Runtime: `GET /health` ok; webhook health URL present, `totalReceived: 0` (no live inbound during review)

---

*Discussion artifact for product + eng. Prefer updating this file when hardening items close rather than resurrecting the Aug 3 comprehensive plan as live status.*
