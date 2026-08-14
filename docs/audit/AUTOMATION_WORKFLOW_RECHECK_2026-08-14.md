# Automation & Workflow — Recheck Audit

**Date:** 2026-08-14 (pass 3 — post-implementation)  
**Branch:** `call-ui-improvemnet`  
**Mode:** Critical re-verify against live repo. No new product features in this pass.  
**Compared to:** `docs/audit/AUTOMATION_WORKFLOW_COMPLETE_REVIEW.md` (pass 1–2, overall 5/10)

This is not a rubber stamp of the hardening work. Every Phase A claim was re-opened in source. Helper unit tests passing ≠ inbound pipeline proven.

---

## 1. Verdict

**Not perfectly built. Safer than two days ago. Not a production CRM pillar yet.**

Phase A mostly landed in code: STOP is exact-token, journeys honor opt-out, free-form sends are CSW-gated, delay/form waits interrupt, `ANY_MESSAGE` is a true catch-all, the Redis lock heartbeats and requeues, NFM is HMAC’d, webhook URLs are SSRF-checked, publish/enabled copy is honest, OWNER/ADMIN own mutations.

It is **not** “everything is up to date / complete.” Inbox “pause bot” does **not** stop conversation flows. Saving a draft does **not** stop in-flight delay jobs. There are still **zero** tests of `handleInboundFlow` / `handleInboundAutomations`. Keyword auto-replies are still substring. Two Meta Form backends remain. Live inbound is **not** certified this pass (`totalReceived: 0`).

**Overall: 7/10** — usable with clear known gaps (was 5/10). Demo-working with policy gates. Not 9 until pause, draft-vs-in-flight, and an inbound pipeline test exist.

---

## 2. Scores (now vs pass 2)

| Area | Pass 2 | Now | Why |
|------|-------:|----:|-----|
| Auto-replies (rule layer) | 6/10 | 7/10 | Opted-out contacts skipped. CSW skip on send. Keyword still `includes`. `AI_CHATBOT` row still a ghost. |
| Conversation flows (tree engine) | 6/10 | 7/10 | Opt-out, CSW, interrupt, catch-all, lock, cycles, sticky A/B. In-flight ignores `DRAFT`. No engine integration test. |
| Meta WhatsApp Forms | 4/10 | 5/10 | NFM HMAC + form-wait interrupt + naming. Still `wa-forms` vs `flows-assets` + orphan `/automations/meta-flows`. |
| Cross-module connections | 5/10 | 6/10 | `CAMPAIGN_REPLY` matches `metadata.campaignId`. No campaign picker. Inbox pause ≠ journey pause. |
| Meta policy / 24h window | 4/10 | 7/10 | Non-template sends gated; 131047 logged as skip. **No** template fallback. Analytics shows “Not sent”, not 131047. |
| UX / naming | 5/10 | 7/10 | Live = published **and** enabled. Promo no longer pretends Forms = chat tree. Default hub tab still Auto-replies. |
| Tests | 3/10 | 5/10 | 176 server tests (helpers). **Zero** `handleInboundAutomations` tests. Client has 9 unit files including `flow-live`. |
| Docs honesty (`FEATURE_MATRIX`) | 3/10 | 6/10 | Flow/automation rows partly corrected. Conflict note is stale. Footer still says “All DONE” / “0 client tests”. |

---

## 3. Runtime snapshot (this Codespace)

| Check | Result |
|-------|--------|
| `GET /health` | api / database / redis **ok** |
| `GET /api/whatsapp/webhook/health` | `webhookUrl` set (`ngrok-free.dev`), verify token + app secret configured |
| `totalReceived` | **0** — no inbound certified this pass |
| `cd server && npm test` | **176 passed / 31 files** |
| `cd server && npx tsc --noEmit` | **clean** (an older tsc failure on missing `keywordMatches` import is gone) |

Inbound still needs a **new** phone reply to prove the tunnel. Do not treat this audit as “Inbox receive works.”

---

## 4. Phase A scorecard (the work we said we would do)

Status: **DONE** in current code · **PARTIAL** · **NOT DONE** · **OVERCLAIMED** in docs/UI.

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | CSW-aware send + template fallback + log 131047 | **PARTIAL** | Gate in `send.service.ts` (`CSW_CLOSED`, Meta `131047`). Flow `executeNode` logs `skipped`. **No auto template fallback** (no UI to pick one). Analytics counts skipped, does not isolate 131047. |
| 2 | Honor `optedIn` in engine + delay resume | **DONE** | `skipIfOptedOut` on inbound, delay resume, missed-call, call-completed, scheduled start. Static auto-reply path also returns. NFM skips opted-out. |
| 3 | Delay **and** Meta Form wait: do not swallow inbound | **DONE** | `shouldInterruptWait` — delay always interrupts; form wait interrupts unless `waFlowResponse` present. Unit tests in `inbound-wait.test.ts`. |
| 4 | Tighten STOP — no prefix `cancel` | **DONE** | Exact set in `opt-out.ts`. `cancel my order` is **false**. Exact `cancel` / `end` / `quit` still opt out the whole pipeline. |
| 5 | `ANY_MESSAGE` catch-all | **DONE** | `partitionFlowsForMatch` runs non-catch-all first. Settings copy: “when no other flow matches.” |
| 6 | Lock refresh; miss → requeue, not AI | **DONE** | Heartbeat every 10s. `FLOW_LOCK_BUSY` → `retry-inbound` on `flow-queue` (max 8). Worker handles the job. |
| 7 | Publish / enabled honesty in UI | **DONE** with caveat | `flow-live.ts`: Live only if `PUBLISHED && enabled`. List will not turn on a draft. **Caveat:** delay resume + in-progress lookup use `enabled: true` **without** `status: PUBLISHED`. |
| 8 | Naming: Auto-replies vs journeys vs Forms | **PARTIAL** | Tabs + promo distinguish the three. Node label is “WhatsApp Form”. Did **not** rename product to Journey. Orphan MetaFlowBuilder still routed. |
| 9 | OWNER/ADMIN for publish/delete | **DONE** | `adminGuard` on automation + flow + flow-assets mutations. GET/validate/simulate stay member-readable. NFM is HMAC, not JWT. |
| 10 | Engine + inbound pipeline tests | **PARTIAL** | Helpers: opt-out, match-order, inbound-wait, SSRF, simulate, conflicts, trigger-match, validation. **No** test imports `handleInboundFlow` or `handleInboundAutomations`. |
| 11 | Cycle detection | **DONE** | Dangerous send-loops = error; wait-loops = warning; list rows > 10 = error. |
| 12 | Webhook SSRF | **DONE** | HTTPS, blocked private/reserved, DNS in `assertSafeWebhookUrl`, `redirect: 'error'`. |
| 13 | Sign NFM webhook | **DONE** | Raw body parser **before** `express.json`. Route requires `x-hub-signature-256`. Fallback `JSON.stringify(req.body)` if `rawBody` missing — keep the raw parser mounted. |
| 14 | Correct `FEATURE_MATRIX` | **PARTIAL** | Draft/publish, ANY_MESSAGE, WA Forms picker notes updated. **Still wrong:** conflict row says it misses ANY_MESSAGE/tag (those exist). Footer “All DONE” and “Client-side tests: MISSING”. |

---

## 5. Confirmed working (evidence-backed)

- Inbound funnel unchanged: conversation flow → static auto-reply → AI queue (`handleInboundAutomations`).
- New matches require `enabled: true` **and** `status: 'PUBLISHED'` (`matchFlow`, missed-call, scheduled start).
- STOP is exact-token; `cancel my order` is not opt-out (`opt-out.test.ts`).
- Opted-out contacts: flow engine clears state + cancels delay; static rules skip; AI already skipped.
- Free-form Meta send refused when CSW closed; templates still send.
- CSW window also considers last **USER_INITIATED** call (`service-window.ts`).
- Delay / form wait interrupt + rematch as new inbound.
- Stable delay job id `flow-delay-${conversationId}`.
- `ANY_MESSAGE` only after no other published flow matched.
- Lock TTL extended while the handler runs; lock miss does not fall through to AI.
- Webhook node cannot `fetch` localhost / RFC1918 / link-local (unit tests).
- NFM: signature required; skip if not waiting for `wa_flow` or opted out.
- Roles: agents get 403 on flow/automation writes.
- Shared `keywordMatches` used by live engine + simulate (still substring unless exact/regex).
- Handoff: `agency` ≠ `agent` (word boundary).
- Simulate: campaign trigger says preview-only; language uses `detectMessageLanguage`.
- Conflicts **detector** includes ANY_MESSAGE vs keyword, duplicate catch-alls, duplicate flow keywords, tag re-entry. Shown on hub banner, **not** at save.
- Sticky A/B stored on `botState.abSticky`; clearing flow state keeps sticky.
- UI Live / Draft / Off via `flowAudienceState`. Save toasts do not say live unless published + on.
- Forms promo CTA is “New conversation flow” with “not a chat tree” copy.
- Settings UI: no App ID / App Secret / Advanced override (grep on `SettingsPage` empty).
- Legacy `POST /whatsapp/connect` returns **410** (does not persist attacker tokens).
- Connect pending token is opaque Redis/memory; Meta access token stays server-side.
- `phoneNumberId` is `@@unique` in Prisma.

---

## 6. Critical / High (still open)

### 1. Inbox “pause bot” does not pause conversation flows

- **Why it matters:** Agent turns the bot off to take over. The journey (and delay jobs) keep messaging the customer. Looks like a haunted inbox.
- **Evidence:** `PATCH /inbox/:id/bot` with `active: false` sets `botActive` only — does **not** clear `botState` or cancel `flow-delay-*`. `processInboundFlow` checks `botHandoffAt` and assigned-agent, **never** `botActive`. AI path **does** check `botActive` (`automation/engine.ts` ~232).
- **Fix:** On pause: `botActive: false`, `cancelDelayJob`, `saveFlowState(null)`. On inbound: if `botActive === false`, skip flows and static rules too (or only skip new matches and abort in-flight — pick one and document it).
- **Verify:** Mid-menu, toggle bot off, customer taps a button → no next node send.

### 2. Draft / unpublish does not stop in-flight sends

- **Why it matters:** UI says Live = published AND enabled. Saving a draft sets `status: DRAFT` so **new** matches stop. Delay resume and in-progress continuation still load the flow with `{ enabled: true }` only (`engine.ts` ~1123, ~1393). A delay queued while live can still fire after “not live yet.”
- **Fix:** Same `enabled + PUBLISHED` predicate everywhere, **or** keep serving the last published snapshot until the conversation ends, and say that in the UI.
- **Verify:** Live flow with a 60s delay → Save draft → wait out the delay → no outbound (or documented continuation).

### 3. No inbound pipeline tests

- **Why it matters:** The dangerous bugs (STOP vs journey, lock miss → AI, CSW after delay) live in `handleInboundAutomations` + webhook processor. Helpers cannot catch a missed `return`.
- **Evidence:** Grep of `server/src/**/*.test.ts`: no `handleInboundFlow` / `handleInboundAutomations`.
- **Fix:** One file, given/when/then: cancel-my-order still runs the tree; exact STOP does not; lock miss requeues; CSW skip; opted-out delay resume no-ops.
- **Verify:** That file is in `npm test`.

### 4. CSW skip has no template fallback

- **Why it matters:** After a delay / missed call outside 24h, the customer gets silence. Meta would have returned 131047. Phase A asked for a fallback template. We skipped it because there is no UI to choose one — correct product call, still a policy gap.
- **Evidence:** `send.service.ts` throws `CSW_CLOSED`; no template substitution.
- **Fix:** Optional `cswFallbackTemplateId` on the flow (later). For now, surface skipped+131047 in Performance, not only “Not sent.”
- **Verify:** Delay 25h in a test clock / mocked window → log `skipped` / `csw_closed`; no free-form send.

---

## 7. Medium / Low

- **Keyword auto-replies still substring** — `processRuleAutomations` uses `message.includes(keyword)`. Flow keywords use the same `includes` unless exact/regex. “price” matches “pricey”. Handoff is word-boundary; keywords are not. `FEATURE_MATRIX` is honest here; Phase B #3 is **not** done.
- **Exact `cancel` / `end` / `quit` still global STOP** — better than prefix match; a customer who texts only `end` still kills all automation.
- **Conflicts at save** — banner on the hub only. Saving a second WELCOME does not block. Phase B #1 open.
- **Campaign picker** — `CAMPAIGN_REPLY` is a free-text ID. Engine can filter `metadata.campaignId`. Phase B #4 open.
- **Default Automations tab is Auto-replies** (`|| 'quick'`). Phase B #6 open.
- **No frequency cap** — welcome/keyword/tag can re-fire. Tag/segment warning exists; engine still re-enters. Phase B #2.
- **Inbox has no “bot is waiting for a button” / jump-to-node.** `botState` exists; UI does not show it. Phase B #9. Pause gap above is the urgent slice of this.
- **`waitingFor: 'media'` never set.** Media node sends media; it does not wait. Phase C #8.
- **`goto_flow` has no return stack** — it replaces `state.flowId` and does not come back. Phase C #7.
- **Two Form products** — `WaFormPicker` (`/api/wa-forms`) is the live path. `MetaFlowBuilder` (`/api/flows-assets`) is still routed. Phase C #1.
- **Schedule flow** — API only; `flowApi.scheduleStart` unused in UI.
- **`AI_CHATBOT` automation type** — enum + form dead-end. AI is the inbound fallback queue.
- **User-supplied regex** on flow keywords — ReDoS risk if regex mode is on.
- **Lock give-up after 8 retries** — message dropped from automation (no AI either). Rare; log-only.
- **`FEATURE_MATRIX` drift** — conflict row and footer totals still overclaim.
- **`/meta-config` GET/PATCH still exists** (OWNER/ADMIN). UI does not expose App Secret; API can still store an org override. Out of automation scope; still on the critic backlog.
- **Meta `client_secret` in query string** on token exchange (`meta.service.ts` `URLSearchParams` GET). Meta’s OAuth shape; still a log-leak risk.
- **Inbound not certified** — `totalReceived: 0` this pass.

---

## 8. What is still missing for production

Ordered. Do not start Phase C.

1. Pause = pause **journeys**, not only AI (`botActive` in `processInboundFlow` + cancel delay).
2. One published predicate for match **and** resume **and** delay jobs.
3. `handleInboundAutomations` tests (STOP, cancel-my-order, CSW, lock busy).
4. Campaign picker (or hide the ID field and treat “any campaign reply” as the only mode).
5. Keyword word-boundary for auto-replies **and** flow keywords (share `keywordMatches`, default to `\b`).
6. Conflict warning **at save** with a link to the other rule/flow.
7. Performance: show CSW / opt-out as distinct skip reasons (131047).
8. Default hub tab or a chooser so first-time users do not build a keyword auto-reply when they wanted a welcome menu.
9. Frequency cap (once per conversation / 24h).
10. One Forms list; hide or redirect `/automations/meta-flows`.
11. Honest `FEATURE_MATRIX` footer (not “184 All DONE”).
12. Live inbound proof: new phone reply increments `totalReceived`.

---

## 9. Phase B / C (unchanged intent)

**Phase B — still open (smoothness):** conflict-at-save, frequency cap, keyword word-boundary, campaign picker, send-test-to-phone, default hub tab, delay interrupt as a node setting, Inbox pause/jump/waiting UI, honest node drop-off.

**Already pulled forward from B (engine only):** shared matcher (substring), sticky A/B, delay interrupt (always interrupt, not a node toggle).

**Phase C — do not start:** merge Form builders, tickets/SLA node, template drip outside CSW, catalog, NL generate-flow, `on_tag_added`, goto return stack, wait-for-media.

---

## 10. Do next (max 5)

1. **Inbox pause must stop journeys** — `botActive === false` skips `processInboundFlow` and static rules; cancel delay; clear `botState`.
2. **Published gate on delay resume + in-progress** — same as `matchFlow`.
3. **Inbound pipeline tests** — cancel-my-order, exact STOP, CSW skip, lock requeue.
4. **Campaign picker** for `CAMPAIGN_REPLY` (list org campaigns; empty = any).
5. **Word-boundary keywords** for auto-replies and flows (opt-in exact/regex stay).

---

## 11. Self-Q&A (recheck)

**Q. Is automation “done”?**  
A. No. Safer. Not complete.

**Q. Can we tell customers a draft will never message them?**  
A. New matches: yes. Delay jobs / mid-tree: **no**, not until finding #2 is fixed.

**Q. If an agent pauses the bot in Inbox, does the welcome menu stop?**  
A. **No.** Only the AI fallback stops.

**Q. Did we prove WhatsApp receive?**  
A. **No.** Health has a tunnel URL; `totalReceived` is 0.

**Q. Did FEATURE_MATRIX catch up?**  
A. Partly. Conflict note and the “all DONE” footer still lie.

---

## 12. Sources (this pass)

- `server/src/modules/flows/engine.ts`, `lock.ts`, `match-order.ts`, `inbound-wait.ts`, `trigger-match.ts`, `validation.ts`, `simulate.ts`, `routes.ts`
- `server/src/modules/automation/engine.ts`, `conflicts.ts`, `routes.ts`
- `server/src/modules/compliance/opt-out.ts`
- `server/src/modules/messages/send.service.ts`
- `server/src/modules/inbox/service-window.ts`, `routes.ts` (`/:id/bot`)
- `server/src/modules/flows-assets/routes.ts`, `nfm-handler.ts`
- `server/src/utils/safe-webhook-url.ts`
- `server/src/index.ts` (raw NFM parser)
- `server/src/workers/webhook.processor.ts`, `index.ts`
- `client/src/utils/flow-live.ts`, `pages/FlowBuilderPage.tsx`, `components/flows/*`, `pages/AutomationsPage.tsx`
- `docs/audit/FEATURE_MATRIX.md`, `docs/audit/AUTOMATION_WORKFLOW_COMPLETE_REVIEW.md`
- Commands: `/health`, webhook `/health`, `server` `npm test` (176), `tsc --noEmit` (clean)
