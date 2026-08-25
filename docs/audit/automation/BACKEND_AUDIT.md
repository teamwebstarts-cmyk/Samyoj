# Backend automation and flow audit

Research date: 2026-08-25. This document records current code evidence after
the hardening changes in this audit. “Fixed” means the current code contains the
control and the relevant build/regression checks pass; it does not mean a live
Meta/ngrok test has been performed.

## Architecture map

### Inbound path

The supported **triggers** are inbound message, keyword, welcome, business
hours, contact tag/segment, campaign reply, missed call, and call completion.

1. `server/src/modules/whatsapp/routes.ts` verifies the webhook and enqueues it.
2. `server/src/workers/index.ts` consumes `webhook-queue`.
3. `server/src/workers/webhook.processor.ts` routes by active Meta
   `phoneNumberId`, scopes the workspace by organization and DB number, then
   upserts the contact, conversation, and inbound message.
4. The processor emits `message:new` to the organization room and runs
   compliance handling.
5. `handleInboundAutomations()` in
   `server/src/modules/automation/engine.ts` uses this precedence:
   paused → flow → lock retry → opt-out → static rule → AI queue.
6. `handleInboundFlow()` in `server/src/modules/flows/engine.ts` acquires a
   Redis conversation lock, recovers waits, matches only live published flows,
   and runs nodes.

### Node execution

`executeNode()` supports text, interactive buttons/lists, questions, tags,
assignment/handoff, AI, templates, media, delay/schedule, customer webhooks,
locations, contact cards, Meta-native forms, A/B splits, language routing, and
local/cross-flow jumps. State is persisted in `Conversation.botState`; delay
continuations use `flow-queue`.

### Delay/wait, pause, and retry

- Button/text/form waits are persisted in `botState`.
- Delay jobs now carry identifiers and state is re-read from the database.
- Queue workers resolve the active number and current encrypted credential at
  execution time.
- `pauseConversationAutomations()` cancels the timer and serializes state
  clearing with flow execution.
- A webhook message is persisted before automation. If automation then throws,
  a durable `retry-inbound-message` job rebuilds its payload from the Inbox row.
- BullMQ remains embedded in the API; no second worker process is introduced.

### Outbound and Inbox

`sendFlowMessage()` and `sendAutomationReply()` create an outbound pending
message, then call the centralized `deliverOutboundMessage()`. Delivery
revalidates the organization-owned active WhatsApp workspace, resolves the
current Meta phone number and token, enforces the customer-service window for
non-template messages, calls Meta, updates status, and emits realtime status.

## Confirmed findings

## Severity and evidence convention

Each finding includes exact code-area **Evidence**, an impact statement, a
reproduction or negative-test condition, a disposition, and a verification
status. Severity is P0 when it can cause a security boundary break, duplicate
customer-facing side effect, or unrecoverable data loss; P1 when it can break a
common journey or exhaust a worker; P2 for maintainability or polish.

### A1 — High — Queue payloads retained credentials and stale number context

**Evidence:** the old automation/flow payload shape contained
`encryptedToken`; delayed flow jobs copied it at enqueue time. The current
`server/src/modules/automation/engine.ts` payload uses `whatsappNumberId`, the
flow delay/start jobs use IDs only, and
`server/src/modules/messages/send.service.ts` resolves an active number before
provider I/O. The message worker no longer forwards a queue token.

**Impact:** a disconnected number or rotated token could previously be used by a
delayed job, and queue inspection could expose encrypted credentials.

**Fix:** resolve `(organizationId, whatsappNumberId, isActive)` immediately
before sending; use the current DB phone ID/token; bind the outbound message to
the same workspace. Status: **FIXED**.

**Verification:** server build and automation/flow/message regression suite
pass. A live disconnect-before-delay test remains **NEEDS LIVE TEST**.

### A2 — High — Cross-flow `goto_flow` recursion was unbounded

**Evidence:** `server/src/modules/flows/engine.ts` executes `goto_flow` by
calling `runFromNode()` recursively; the old 50-node limit was local to each
invocation. The current engine carries a flow path and a bounded
`MAX_CROSS_FLOW_HOPS`, rejecting a repeated target or excessive hop count.

**Impact:** Flow A → Flow B → Flow A could repeatedly send messages and exhaust
worker resources.

**Fix:** runtime cycle/hop guard with a failed node log and terminal stop.
Static organization-wide `goto_flow` graph validation remains a P1 improvement.
Status: **FIXED**, with static validation **DEFERRED**.

### A3 — High — Pause could race a running flow

**Evidence:** `server/src/modules/flows/pause-automation.ts` now wraps state
clearing in `withConversationLock()`. `runFromNode()` also rechecks the
organization/number conversation state before each node.

**Impact:** a human pause could previously be followed by a later automated
send or a stale wait state.

**Fix:** serialize pause cancellation with the flow lock and stop when
`botActive` is false or handoff is active. A node already inside provider I/O
cannot be cancelled mid-request; it is allowed to finish, but no later node is
run. Status: **FIXED**.

### A4 — High — Post-insert webhook failure permanently skipped automation

**Evidence:** `webhook.processor.ts` inserts the inbound message before calling
the automation engine. Duplicate Meta messages are intentionally skipped, so a
crash between those operations could leave the message visible but never
automated.

**Impact:** a customer receives no configured flow/static/AI response even
though Inbox shows the message.

**Fix:** failures now enqueue `retry-inbound-message` with identifiers only;
`retryInboundAutomations()` reloads the durable Inbox message and reconstructs
the payload. Status: **FIXED for the post-insert failure window**.

**Remaining limit:** provider timeouts can still be ambiguous after a send
crosses Meta’s boundary. A durable outbound operation key is P0 and
**DEFERRED**.

### A5 — High — Assignment accepted arbitrary user IDs

**Evidence:** flow configuration accepts `assignAgentId`; `assignToAgent()` in
`flows/engine.ts` now verifies an AGENT/ADMIN/OWNER membership in the current
organization before updating a conversation scoped to that organization.

**Impact:** a crafted flow could otherwise assign a conversation to a known
user ID from another organization.

**Fix:** organization membership check plus organization-scoped update. Status:
**FIXED**.

### A6 — High — NFM replies were not bound to the active form context

**Evidence:** `flows-assets/nfm-handler.ts` previously derived only a
conversation ID from a colon-delimited token and trusted webhook-supplied
sender/number values. It now requires a three-part token, verifies active
number and contact identity, requires the token node to equal the persisted
`wa_flow` wait node, scopes `FlowAsset` by organization, and verifies the Meta
flow ID against the current published node.

**Impact:** a valid webhook could otherwise advance a different conversation or
use a mismatched number/form context.

**Fix:** current conversation/number/contact/flow-step binding. Status:
**FIXED for the demonstrated binding gap**.

**Remaining limit:** the token is still a random opaque value rather than a
cryptographically authenticated expiring token with nonce replay protection.
Status: **DEFERRED P0**.

### A7 — High — Integrations webhook delivery allowed SSRF

**Evidence:** integration and Zapier endpoints previously accepted any
syntactically valid URL, while `integrations/dispatch.ts` fetched it directly.
Create/update and delivery now call the shared
`assertSafeWebhookUrl()` guard; redirects remain disabled for flow webhooks and
raw endpoint URLs are no longer written to auto-disable logs.

**Impact:** a user with endpoint-management permission could target localhost,
private networks, link-local metadata, or internal hostnames.

**Fix:** HTTPS, credential, literal-IP, DNS, and internal-host checks at both
configuration and execution boundaries. DNS pinning/egress isolation remains
P1 **DEFERRED** because the current hostname check has a TOCTOU window.

### A8 — Medium — Delay and scheduled jobs had weak retry semantics

**Evidence:** `server/src/config/queues.ts` now gives `flowQueue` bounded default
attempts/backoff; lock-retry jobs explicitly remain one-attempt self-rescheduling
jobs.

**Impact:** transient Redis, database, or provider failures could permanently
drop a continuation.

**Fix:** bounded retry policy plus current-number/state revalidation. Status:
**FIXED**, with exact provider-side idempotency **DEFERRED**.

### A9 — Medium — Scheduled start was counted before lock acquisition

**Evidence:** `startFlowFromJob()` now records the start inside the acquired
conversation lock. The same ordering was applied to missed-call and
call-completed event flows.

**Impact:** analytics could claim a start when lock contention prevented any
node from running.

**Fix:** record after lock acquisition. Status: **FIXED**.

### A10 — Medium — Draft and publish persistence was inconsistent

**Evidence:** `flows/routes.ts`, `flows/versioning.ts`, and the flow builder now:

- preserve draft nodes on draft create and template create;
- save name, description, trigger, start node, enabled, and priority in a draft;
- save a draft before calling publish;
- return the restored flow to the client;
- persist `FlowVersion.startNodeId`;
- validate a version before restore; and
- duplicate the current draft when one exists.

**Impact:** users could lose draft settings, publish with no draft, see an empty
editor after restore, restore the wrong trigger/start node, or duplicate stale
published content.

**Fix:** unified draft/version contract. Status: **FIXED**.

### A11 — Medium — Flow graph validation allowed silent invalid behavior

**Evidence:** `flows/validation.ts` now rejects duplicate button/list row IDs,
missing reply buttons, incomplete condition configuration, invalid schedule
dates, and excessive delay/schedule durations. The API caps graphs at 100
nodes and preserves template parameter fields in its Zod schema.

**Impact:** API callers could persist graphs that the builder did not
meaningfully route, while UI-only validation could be bypassed.

**Fix:** server-side validation and bounded graph size. Status: **FIXED for
these cases**. Full Meta template/form semantic validation remains
**DEFERRED**.

### A12 — Medium — Flow analytics and version allocation are read/modify/write

**Evidence:** `flows/analytics.ts` reads stats and writes an increment, and
`flows/versioning.ts` derives the next version from the current row.

**Impact:** concurrent starts can lose counters; concurrent publishes can
collide or produce an unexpected version.

**Fix:** use atomic JSON/database counters and a transaction/locking strategy.
Status: **DEFERRED P1**; no behavior change was invented in this audit.

## Verification matrix

- `cd server && npm run build`: **PASS**.
- Automation, flow, NFM, integration, and message focused tests:
  **PASS — 17 files, 82 tests**.
- Cross-flow cycle runtime test: **TODO** — add a mocked engine test.
- Pause during a slow node: **TODO** — requires a lock/DB concurrency test.
- Post-insert retry reconstruction: **TODO** — add a worker/engine unit test.
- Disconnect before delay expiry: **NEEDS LIVE TEST**.
- Meta NFM identity/flow mismatch: **TODO** — add handler tests.
- Integration SSRF negative tests: **TODO** — add route/dispatch tests.
- Raw-body signature fail-closed production check: **OPEN**.
- Real Meta/ngrok inbound response and provider status: **NEEDS LIVE TEST**.

The passing suite proves compilation and existing regression compatibility; the
TODO rows are explicit test debt, not claims of exact-once or live correctness.
