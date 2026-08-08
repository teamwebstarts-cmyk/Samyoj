# Samyoj Campaign Broadcasts — Phase 0 Baseline and Overhaul Roadmap

**Reviewed:** 2026-08-08 (UTC+05:30)
**Scope owner:** `docs/campaigns/COMPREHENSIVE_CAMPAIGNS_DOCUMENTATION.md` only
**Evidence rule:** “Implemented” below means observable in the current repository. “Planned” and “decision” are not claims about current behavior.

## 0. Executive verdict

Campaigns are a working, organization-scoped template broadcast prototype, not a production-grade broadcast system. CRUD, audience resolution, scheduling, a BullMQ worker, webhook status updates, analytics, CSV export, and Inbox conversation recording exist. Redis is an operational dependency for BullMQ queues/workers (`server/src/config/queues.ts:4–8`); without reachable Redis, campaign enqueue/processing is unavailable. The critical gaps are delivery idempotency and ordering, consent provenance and enforcement, quota/budget correctness, schedule semantics, retry policy, auditability, and scale isolation.

**Current readiness:** not assigned a numeric score in Phase 0. The former `4/10` score was an unsupported snapshot, not a durable measurement. Readiness must be scored only after the acceptance criteria in §6 are tested.

## 1. Verified current behavior

### 1.1 User-facing flow

- Campaign creation and editing are in `client/src/pages/CampaignsPage.tsx`; only `DRAFT` and `SCHEDULED` are editable (`92–94`).
- The form supports approved-template selection, body/header parameters, optional header media URL, manual phone entry, tags, selected contacts, selected WhatsApp number, scheduling, and browser-local timezone selection (`61–77`, `125–169`).
- The UI hardcodes `requireOptIn: true` for TAGS, CONTACTS, and ALL_OPTED_IN (`145–161`). Manual phone entry does not carry a consent assertion.
- The API does not enforce that UI choice: callers can submit `audienceConfig.requireOptIn: false` for TAGS or CONTACTS because the schema accepts the boolean (`server/src/modules/campaigns/types.ts:40–46`) and audience resolution skips the `optedIn` filter when it is explicitly false (`service.ts:35–48`). ALL_OPTED_IN still forces `optedIn = true` (`service.ts:52–54`). This is distinct from the current UI behavior.
- The API client exposes list, quota, preview, CRUD, send/test/pause/resume/cancel/retry/duplicate, stats/analytics, recipient listing, and export methods. Verify `client/src/services/api.ts` campaign API block; do not infer server guarantees from the method list.
- Campaign page refreshes list/detail data on `campaign:status` and `campaign:progress` (`347–357`). There is no evidence here of a durable event cursor or replay mechanism.

### 1.2 API and authorization

- Read routes use `authenticateJwtOrApiKey`, `requireOrg`, and active-number resolution; mutating routes additionally require `OWNER` or `ADMIN` (`server/src/modules/campaigns/routes.ts:34–36`).
- The list query conditionally filters by `req.activeWhatsappNumberId` when one is present (`routes.ts:47–50`), but detail, recipients, analytics, stats, and export look up the campaign by `organizationId`/campaign ownership and do not add an active-number predicate (`routes.ts:197–212`, `223–245`, `454–499`). Do not describe those endpoints as active-WhatsApp-number scoped.
- Create and update persist caller-supplied `whatsappNumberId` values; these routes do not validate that the ID belongs to the organization or is the active number (`routes.ts:166–180`, `257–328`). The selected number is resolved/validated later when sending (`service.ts:261–273`); this is a documented risk, not proof of an exploitable cross-tenant result.
- Create resolves the submitted audience in the organization, rejects an empty result, persists the resolved recipients, and records `organizationId`, template, audience, number, schedule, and creator (`routes.ts:141–193`).
- Send validates an approved Meta template, checks quota/budget, sets `RUNNING`, resets counters/recipient delivery fields, and enqueues batches (`service.ts:227–344`).
- Test send is a real Meta send and is admin-guarded, but accepts an arbitrary caller-supplied phone number with no Contact lookup or consent check; it is not represented as a campaign recipient (`routes.ts:377–391`, `types.ts:74–76`, `service.ts:346–387`). This is a static consent risk, not a reproduced external send.

### 1.3 Audience, consent, and schema

- Audience types are `MANUAL`, `TAGS`, `CONTACTS`, and `ALL_OPTED_IN` (`server/src/modules/campaigns/types.ts:4–5`).
- TAGS and CONTACTS filter organization contacts and, by default, `optedIn = true`; ALL_OPTED_IN always filters `optedIn = true` (`service.ts:35–54`).
- MANUAL recipients are deduplicated but are not checked against the Contact consent record during resolution (`service.ts:37–39`; `recipients.ts`). The worker later fails a matching contact when `optedIn` is false, but a phone with no Contact row is not rejected (`server/src/workers/index.ts:179–197`).
- The database stores `Contact.optedIn`, `consentSource`, and `consentAt` (`server/prisma/schema.prisma:504–517`), but CampaignRecipient stores no consent snapshot, category, policy version, or opt-out event reference.
- STOP handling runs only after inbound processing has a resolved Contact and calls `handleOptOut` with that contact ID (`server/src/workers/webhook.processor.ts:462–478`; `server/src/modules/compliance/opt-out.ts:14–34`). A manual/unknown campaign phone with no Contact row can therefore still be sent: the worker rejects only a found contact whose `optedIn` is false (`server/src/workers/index.ts:179–197`). START/SUBSCRIBE sets that resolved Contact back to `optedIn:true`, `consentSource:'START_KEYWORD'`, and a new timestamp, but records no consent category or provenance beyond that generic source (`opt-out.ts:50–65`).
- Campaign status enum is `DRAFT`, `SCHEDULED`, `RUNNING`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED` (`schema.prisma:147–155`). Recipient status uses the shared `MessageStatus` enum; recipient records have unique `metaMessageId`, unique `(campaignId, phone)`, retry count, timestamps, and an error string (`schema.prisma:965–984`).
- Campaign stores nullable `scheduledAt` and nullable `timezone`; schedule execution compares `scheduledAt <= new Date()` and does not use the timezone field (`service.ts:705–730`). The UI converts the browser-local input to an ISO instant before submission (`CampaignsPage.tsx:163–167`). Therefore scheduling currently means “an already-converted UTC instant,” not server-side timezone-aware wall-clock scheduling.

### 1.4 Queue, send, retries, and lifecycle

- There is one BullMQ `broadcast-queue` and a broadcast worker with `concurrency: 2` (`server/src/config/queues.ts:6–9`; `server/src/workers/index.ts:124–140`, `279–285`).
- Send creates delayed jobs per batch, default batch size `50` and delay `1000ms` (`service.ts:305–335`; `types.ts:84–96`). Delays do not establish ordering when multiple workers/processes or retries are present.
- `broadcastQueue.add(...)` sets only a per-job `delay` (`service.ts:313–335`, `443–465`, `558–580`); it does not pass `attempts`, `backoff`, or retention options. The exported `defaultJobOptions` object (`queues.ts:19–26`) is not supplied to the `broadcastQueue` constructor (`queues.ts:6–8`) or these adds, so broadcast jobs have effective `attempts = 1` and do not inherit its retry/backoff/retention values. The worker’s custom backoff hook (`workers/index.ts:279–285`) is inactive for these jobs without a job-level backoff option. The worker catches per-recipient send errors and marks them `FAILED`, so a job can complete after partial failure (`workers/index.ts:207–273`). Per-recipient bounded retry, job-level backoff, dead-lettering, and idempotency are intended future retry design, not current behavior.
- `retry-failed` resets failed recipients and increments `retryCount`, but has no max retry policy or idempotency key (`service.ts:503–590`).
- Pause changes the campaign status, and the worker checks status before each recipient; already-in-flight Meta calls cannot be withdrawn (`service.ts:389–401`; `workers/index.ts:172–177`). Cancel marks pending recipients failed, but queued jobs are not removed (`service.ts:472–501`).
- Completion is inferred when no recipient is `PENDING`; all-failed means `failedCount >= totalContacts` (`service.ts:104–123`). There is no explicit `SENDING`, `RETRYING`, `PARTIAL`, or terminal reason state.

### 1.5 Webhooks, ordering, analytics, and Inbox

- Meta webhook requests are acknowledged before asynchronous processing; status payloads are queued with four attempts (`server/src/modules/whatsapp/routes.ts:779–801`).
- Campaign status synchronization looks up `CampaignRecipient` by `metaMessageId` and accepts `DELIVERED`, `READ`, and `FAILED` (`service.ts:141–152`). READ promotes delivered count if needed, but there is no timestamp comparison or event-id deduplication (`service.ts:157–197`). Out-of-order FAILED after READ can decrement counters and overwrite the terminal state.
- The current campaign progress event payloads are minimal: send/failure events contain `campaignId`, `recipientId`, `status`, and failure may include `errorMessage` (`workers/index.ts:243–272`); webhook updates emit the same identity/status shape (`service.ts:199–203`). The old documentation’s `{sent, delivered, read, failed, total}` payload is not verified.
- Successful broadcast sends are recorded in the normal conversation/message path with `campaignId` metadata and the selected WhatsApp number (`workers/index.ts:218–230`). This is the current Inbox routing integration; it is not a separate campaign Inbox model.
- Analytics counts recipient rows and error strings, and calculates delivery/read percentages over `totalContacts` (`service.ts:629–674`). It does not expose spend, template category, consent cohort, unique event counts, latency, retries, or time-series data.
- CSV export is unpaginated and emits `phone,name,status,error,sent_at,delivered_at,read_at`; values are quoted, but phone/name are not CSV-escaped consistently and formula-injection protection is absent (`service.ts:677–703`; `routes.ts:474–499`).

### 1.6 Current defaults and cost preview

| Behavior | Current value/evidence | Interpretation |
|---|---|---|
| Daily send limit | 5,000 | Organization setting fallback; count uses SENT/DELIVERED/READ rows with `sentAt` since server local midnight (`types.ts:91–96`; `quota.ts:16–37`). |
| Daily budget | ₹5,000 | Estimate-only guard using the same recipient count, not delivered-message billing (`quota.ts:63–93`). |
| Batch size/delay | 50 / 1,000ms | Queue shaping, not Meta rate-limit enforcement (`types.ts:91–96`; `service.ts:305–335`). |
| Worker concurrency | 2 | Global worker concurrency, not per organization/number (`workers/index.ts:279–285`). |
| Cost preview | MARKETING ₹0.78, UTILITY ₹0.35, AUTHENTICATION ₹0.35; fallback conversion USD→INR 83 | Local heuristic in `usage.service.ts:7–16`, `255–264`; not a live Meta rate card and not sufficient for billing. |

## 2. Static findings and risks

The items below are static code-review findings. Unless an item explicitly cites a reproduced test or runtime observation, label it **risk—unreproduced**, not a confirmed production incident.

1. **Risk—unreproduced: consent is not an auditable send gate (High).** Manual recipients bypass resolution consent checks; unknown contacts can be sent after the worker’s `if (contact && ...)` check; API callers can also set `requireOptIn:false` for TAGS/CONTACTS; STOP handling applies only to a resolved Contact; START re-enables that contact without category/provenance tracking; and admin test sends accept arbitrary phones without consent checks. Evidence: `types.ts:40–46`, `74–76`; `service.ts:35–54`, `346–387`; `server/src/workers/webhook.processor.ts:462–478`; `server/src/modules/compliance/opt-out.ts:14–65`; `workers/index.ts:179–197`. Impact: unsolicited messaging and no proof of consent. Minimal fix: resolve every recipient against a consent decision at send time, persist a consent snapshot and policy/category, and fail closed, including test sends. Verify with manual, unknown, revoked, bypass-flag, STOP/START, arbitrary test-phone, and category-mismatch tests.
2. **Risk—unreproduced: webhook state may not be monotonic or idempotent (High).** Status updates have no event timestamp/order guard or deduplicated event record; FAILED can mutate counters after READ. Evidence: `service.ts:141–197`. Impact: incorrect campaign state, analytics, and retries. Minimal fix: append immutable status events keyed by Meta message/status identity and apply only valid monotonic transitions. Verify permutations and duplicate delivery.
3. **Risk—unreproduced: campaign enqueue may not be idempotent (High).** Repeated send/resume/scheduler execution can reset recipients and enqueue duplicate batches; jobs have no stable job IDs or send-attempt key. Evidence: `service.ts:227–344`, `705–730`; `queues.ts:6–8`. Impact: duplicate customer messages and double counts. Minimal fix: transactional claim/version plus `(campaignRecipient, attempt)` idempotency and unique queue job IDs.
4. **Risk—unreproduced: quota and budget may race and are semantically incomplete (High).** Assertions count rows before enqueue without reservation; daily boundary is server local time; budget assumes fixed INR rates and counts attempted recipients, while Meta pricing is delivered-message/category/country dependent. Evidence: `quota.ts:20–29`, `40–61`, `63–86`; `usage.service.ts:9–16`, `255–264`. Minimal fix: atomic reservations, WABA timezone policy, delivered billing facts, and rate-card versioning.
5. **Risk—unreproduced: schedule timezone is misleading (Medium).** `timezone` is stored but ignored by execution; browser conversion makes behavior dependent on the creator’s machine. Evidence: `CampaignsPage.tsx:73–76`, `163–167`; `service.ts:705–730`. Minimal fix: store intended local datetime plus IANA timezone or normalize explicitly at API boundary, and document DST behavior.
6. **Risk—unreproduced: queue retries are not recipient retries (Medium).** The worker absorbs per-recipient errors, while queue attempts apply to the whole batch and there is no max/backoff classification or dead-letter contract. Evidence: `queues.ts:19–28`; `workers/index.ts:207–273`. Impact: transient failures are not reliably retried and permanent failures may be retried indiscriminately.
7. **Risk—unreproduced: scale isolation is absent (Medium).** A global concurrency of two and unbounded per-campaign batch enqueue provide no per-org/number fairness, rate limit, or backpressure. Evidence: `workers/index.ts:124–140`, `279–285`; `service.ts:305–335`. Impact: one large campaign can delay all tenants.
8. **Risk—unreproduced: export is unsafe/incomplete for operational use (Medium).** It loads all recipients, lacks consent/category/cost/event fields, and does not neutralize spreadsheet formulas. Evidence: `service.ts:677–703`; `routes.ts:487–498`.
9. **Risk—unreproduced: readiness score and pricing claims drifted (Medium).** The former `4/10`, “9.2/10 documentation,” conversation-based billing, and fixed rates were not tied to a current test set. Evidence of current heuristic: `usage.service.ts:7–16`, `255–264`. They are removed from this baseline.

## 3. Explicit product decisions for the overhaul

These are decisions to implement or validate; they are not current behavior:

- **Tenancy:** every campaign, recipient, consent record, event, export, and metric is scoped by organization and WhatsApp number. Cross-org and cross-number references fail closed.
- **Consent:** campaigns may send only to recipients with recorded opt-in appropriate to the template category. Consent must include source, timestamp, policy/version, business identity, and opt-out history. Manual import is an input method, not consent.
- **Lifecycle:** states are explicit and terminal transitions are guarded. A campaign run has a stable run/version; send, pause, resume, cancel, retry, and schedule operations are idempotent.
- **Ordering:** Meta status events are applied by event timestamp and valid transition rules, not arrival order. Duplicate webhook deliveries are harmless.
- **Scheduling:** API accepts an IANA timezone and local wall-clock time, stores the resolved instant and original intent, and defines DST gap/overlap behavior.
- **Quota/retries:** reserve quota before enqueue; charge usage from authoritative delivered status/pricing facts; retry only classified transient failures with bounded exponential backoff and a dead-letter outcome.
- **Exports/analytics:** exports are streamed/paginated and safe for spreadsheets; analytics are event-derived, explainable, and include delivery, failure, retry, consent, cost, and latency dimensions.
- **Inbox:** every successful campaign send appears in the same organization/number conversation with campaign provenance; inbound replies route by Meta `phone_number_id` and preserve campaign linkage without changing assignment policy.
- **Scale:** fairness and rate limiting are per organization and phone number, with bounded queue depth, observable lag, and resumable runs.

**Provisional acceptance thresholds (product decisions for Phase 1–4; confirm before production):** deterministic race tests must produce zero duplicate sends; scheduler claim latency must be ≤60 seconds; ten concurrent quota requests (`N=10`) must produce zero quota oversubscription; cost/analytics reconciliation error must be ≤1%; and the multi-tenant load, fairness, alert, and restart thresholds in §6 are provisional until a production capacity review records final SLOs.

## 4. Meta constraints and source register

Checked **2026-08-08**. Meta policies and rates can change; implementation must store the source/rate version and never treat the local heuristic as authoritative billing.

- Cloud API overview, templates, scale, quality, analytics, and opt-in: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Sending/service-window rules and opt-in reminder: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/
- Pricing (per-message model, delivery/category/country conditions, free windows, volume tiers): https://developers.facebook.com/docs/whatsapp/pricing/
- Pricing update history and conversation-based pricing deprecation: https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/
- Template categorization and opt-in-management guidance: https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/
- Webhook components/status payloads and multiple status notifications: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/
- Webhook payload examples: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples/
- WhatsApp Business Messaging Policy (consent, expectations, opt-out): https://business.whatsapp.com/policy/

Operational implications:

1. Templates are required for business-initiated messaging outside the customer-service window and generally require approval.
2. Opt-in must be obtained before template messaging; the business name and intent must be clear, and opt-outs must be honored.
3. Current Meta pricing is per delivered template message, varying by category and recipient country/region; conversation-based pricing must not be presented as current.
4. A business message can produce separate sent, delivered, and read status webhooks. Status processing must tolerate duplicates and non-sequential arrival.
5. The 24-hour customer-service window affects free-form messaging; it does not remove the consent/policy obligations for campaigns.

## 5. Roadmap

### Phase 0 — documentation and contract baseline (this change)

- Replace stale claims with evidence tables and exact file/line references.
- Record product decisions, Meta constraints, acceptance criteria, and known risks.
- Stop using the numeric readiness score until criteria are measured.

#### Phase 0 self-acceptance checklist

- [x] Removed or corrected stale claims, including active-number scoping, timezone behavior, consent, queue retries/concurrency, schema, event payloads, CSV, pricing, and readiness score.
- [x] Added exact current-client/server/schema/worker evidence references for behavior and defects.
- [x] Kept verified current behavior, static risks, explicit product decisions, Meta constraints, and roadmap in separate sections.
- [x] Added the caller-supplied `whatsappNumberId` validation gap and documented Redis/BullMQ as an operational dependency.
- [x] Labeled static race/security findings as risks—unreproduced unless backed by a reproduced test or runtime observation.
- [x] Validated the Meta source register URLs and access date recorded in §4.
- [x] Assigned stable IDs, phase, owner/component, `TEST:` placeholders, and measurable pass conditions to every Section 6 criterion.
- [x] Ran `git diff --check`, IDE diagnostics, and the exact reproducible consistency assertions recorded in §7.

### Phase 1 — safety and correctness

- Consent ledger/snapshot and fail-closed recipient resolution.
- Immutable campaign run, send-attempt, webhook-event, and audit records.
- Idempotent enqueue/send/status application with monotonic transitions.
- Explicit schedule timezone/DST contract.
- Correct org/number scoping tests, including active-number mismatch cases.

### Phase 2 — quota, retry, and operations

- Atomic quota reservations and delivered-message cost facts.
- Error taxonomy, bounded per-recipient retries, dead-letter/replay tooling.
- Per-org/number throttling, fairness, backpressure, pause/cancel claims, and queue lag metrics.
- Operational dashboards and alert thresholds for stuck runs, webhook lag, duplicate suppression, and quota rejection.

### Phase 3 — customer-facing completeness

- Consent status and reason visible before send; category-aware opt-out controls.
- Safe streamed exports with stable schema/version and filters.
- Event-derived analytics with latency, cost, retries, and cohort breakdowns.
- Inbox campaign provenance, reply routing verification, and user-visible partial/failure explanations.

### Phase 4 — scale and governance

- Load tests for multi-tenant campaigns and webhook bursts.
- Partition/retention strategy for recipients and events.
- Disaster recovery/replay runbook, rate-card updates, privacy retention, and production readiness review.

## 6. Acceptance criteria

Every criterion below has a stable ID, phase, owner/component, verification placeholder, and measurable pass condition. The `TEST:` values and named artifacts are outputs to implement or produce; they are not claims that those tests or artifacts already exist.

### Tenancy and authorization

- [ ] **CAM-TENANT-001** — Phase 1 | Owner: Campaign API/auth | Verify: `TEST: campaigns.cross_org_read_and_export` | Pass: every cross-organization read, preview, mutation, enqueue, and export returns 404/403 and creates no side effect.
- [ ] **CAM-TENANT-002** — Phase 1 | Owner: Campaign API/WhatsApp context | Verify: `TEST: campaigns.number_ownership_matrix` | Pass: a campaign cannot resolve contacts or send through a number owned by another organization; active-number and explicit-number cases either both reject or both select the same owned number.
- [ ] **CAM-TENANT-003** — Phase 1 | Owner: Campaign route authorization | Verify: `TEST: campaigns.role_matrix` | Pass: only OWNER/ADMIN can mutate or send; SUPERVISOR/AGENT read only permitted organization/number data.
- [ ] **CAM-TENANT-004** — Phase 1 | Owner: Campaign audit | Verify: `TEST: campaigns.audit_required_fields` | Pass: 100% of campaign actions record organization, user, campaign/run, request ID, outcome, and no credential/token fields.

### Consent and compliance

- [ ] **CAM-CONSENT-001** — Phase 1 | Owner: Audience resolver/send worker | Verify: `TEST: campaigns.consent_fail_closed` | Pass: preview and send apply one fail-closed decision to 100% of MANUAL/TAGS/CONTACTS/ALL_OPTED_IN recipients.
- [ ] **CAM-CONSENT-002** — Phase 1 | Owner: Campaign API | Verify: `TEST: campaigns.require_opt_in_false` | Pass: TAGS/CONTACTS requests with `requireOptIn:false` are rejected or still exclude every non-consented contact; no bypass sends.
- [ ] **CAM-CONSENT-003** — Phase 1 | Owner: Test-send route | Verify: `TEST: campaigns.test_send_consent` | Pass: an arbitrary test phone without an auditable consent decision is rejected, or is allowed only under a documented test-destination policy with 100% audit coverage.
- [ ] **CAM-CONSENT-004** — Phase 1 | Owner: Consent policy | Verify: `TEST: campaigns.revoked_and_category_consent` | Pass: absent, revoked, expired, or category-incompatible consent produces zero Meta sends and a recipient/audit reason.
- [ ] **CAM-CONSENT-005** — Phase 1 | Owner: Consent ledger | Verify: `TEST: campaigns.consent_snapshot` | Pass: every sent recipient has source, timestamp, business identity, category/policy version, and opt-out state persisted before send.
- [ ] **CAM-CONSENT-006** — Phase 1 | Owner: Webhook/compliance | Verify: `TEST: campaigns.stop_start_unknown_manual` | Pass: STOP blocks the next send for a resolved Contact; unknown/manual phones with no Contact are blocked before send; START re-enables only with recorded category/provenance policy.

### Lifecycle and idempotency

- [ ] **CAM-LIFE-001** — Phase 1 | Owner: Campaign run/queue | Verify: `TEST: campaigns.idempotent_enqueue` | Pass: duplicate send, scheduler, redelivery, resume, and retry requests create at most one Meta send per recipient attempt.
- [ ] **CAM-LIFE-002** — Phase 1 | Owner: Campaign state machine | Verify: `TEST: campaigns.lifecycle_transitions` | Pass: every transition is guarded/audited and no terminal campaign or recipient state regresses in 100% of permutation tests.
- [ ] **CAM-LIFE-003** — Phase 1 | Owner: Recipient counters | Verify: `TEST: campaigns.counter_reconciliation` | Pass: counters equal recipient facts after duplicate and retry events, with zero double-counted sent/delivered/read/failed outcomes.
- [ ] **CAM-LIFE-004** — Phase 1 | Owner: Queue controls | Verify: `TEST: campaigns.pause_cancel_race` + artifact `campaign-state-transition-matrix` | Pass: the matrix lists every queued/in-flight pause/cancel outcome, and 1,000 deterministic race iterations produce zero duplicate sends and zero unclassified outcomes.

### Webhook ordering

- [ ] **CAM-WEBHOOK-001** — Phase 1 | Owner: Webhook processor | Verify: `TEST: campaigns.duplicate_status_webhook` | Pass: replaying any identical Meta status webhook changes recipient state/counters exactly once.
- [ ] **CAM-WEBHOOK-002** — Phase 1 | Owner: Campaign status sync | Verify: `TEST: campaigns.status_permutations` | Pass: READ-before-DELIVERED, delayed FAILED, and mixed status permutations yield one valid monotonic state and reconciled counters.
- [ ] **CAM-WEBHOOK-003** — Phase 1 | Owner: Webhook validation | Verify: `TEST: campaigns.invalid_status_isolation` | Pass: unknown IDs, malformed payloads, and cross-number IDs produce zero campaign mutations and an observable error/event.
- [ ] **CAM-WEBHOOK-004** — Phase 1 | Owner: Webhook event store | Verify: `TEST: campaigns.webhook_replay` | Pass: replay reproduces recipient outcomes while preserving Meta timestamps, status, and error codes byte-for-byte.

### Scheduling

- [ ] **CAM-SCHED-001** — Phase 1 | Owner: Scheduler/API | Verify: `TEST: campaigns.schedule_dst` + artifact `schedule-dst-fixture-table` | Pass: 100% of the DST gap/overlap fixture cases listed in the artifact resolve to one explicitly recorded instant or one explicitly recorded rejection.
- [ ] **CAM-SCHED-002** — Phase 1 | Owner: Scheduler worker | Verify: `TEST: campaigns.scheduler_claim` | Pass: concurrent scheduler ticks claim each due run once, scheduler claim latency is ≤60 seconds, and every misfire/late-start outcome is recorded.
- [ ] **CAM-SCHED-003** — Phase 1 | Owner: Campaign UI/API | Verify: `TEST: campaigns.schedule_preview` | Pass: preview displays the exact resolved instant and WABA/business timezone policy for 100% of scheduled campaigns.

### Quota, pricing, and retries

- [ ] **CAM-QUOTA-001** — Phase 2 | Owner: Quota service | Verify: `TEST: campaigns.concurrent_quota_reservation` | Pass: under N=10 concurrent sends, quota oversubscription equals 0 for both organization and number reservations.
- [ ] **CAM-QUOTA-002** — Phase 2 | Owner: Billing/quota | Verify: `TEST: campaigns.usage_window_semantics` | Pass: usage uses the documented timezone and separately counts attempted, accepted, delivered, and billable messages.
- [ ] **CAM-QUOTA-003** — Phase 2 | Owner: Billing service | Verify: `TEST: campaigns.rate_card_reconciliation` + artifact `rate-card-reconciliation-report` | Pass: every estimate carries a Meta category/country rate version and delivered pricing facts reconcile with absolute error ≤1% against the test oracle.
- [ ] **CAM-QUOTA-004** — Phase 2 | Owner: Retry worker | Verify: `TEST: campaigns.retry_taxonomy` | Pass: only transient errors retry within the configured maximum/backoff; permanent errors reach dead-letter state and replay is auditable.

### Exports and analytics

- [ ] **CAM-EXPORT-001** — Phase 3 | Owner: Export API | Verify: `TEST: campaigns.export_safety_and_bounds` | Pass: export is tenant-safe, bounded/streamed, schema-versioned, deterministic, and neutralizes every spreadsheet formula cell.
- [ ] **CAM-EXPORT-002** — Phase 3 | Owner: Export schema | Verify: `TEST: campaigns.export_columns` | Pass: each export includes outcome, timestamps, Meta error/status, retry count, consent decision, category, and cost when available.
- [ ] **CAM-ANALYTICS-001** — Phase 3 | Owner: Analytics service | Verify: `TEST: campaigns.analytics_reconciliation` | Pass: analytics reconcile to recipient/event facts and expose sent/delivered/read/failed, rates, latency, retries, spend, and denominators.

### Inbox routing

- [ ] **CAM-INBOX-001** — Phase 3 | Owner: Broadcast/message service | Verify: `TEST: campaigns.inbox_provenance` | Pass: 100% of successful sends link to the correct organization, number, conversation, and campaign run.
- [ ] **CAM-INBOX-002** — Phase 3 | Owner: Webhook/inbox routing | Verify: `TEST: campaigns.inbound_number_routing` | Pass: inbound replies route by Meta `phone_number_id` with zero tenant/number cross-links and preserved campaign provenance.
- [ ] **CAM-INBOX-003** — Phase 3 | Owner: Realtime client/API | Verify: `TEST: campaigns.realtime_catchup` | Pass: disconnect/reconnect or missed Socket.IO events converges to server truth without stale campaign/Inbox state.

### Scale and operations

- [ ] **CAM-SCALE-001** — Phase 4 | Owner: Queue/platform | Verify: `TEST: campaigns.multi_tenant_load` + artifact `multi-tenant-load-report` | Pass (provisional): with 10 organizations × 10 active campaigns and 50 recipients/campaign, p95 queue start lag is ≤60 seconds, no campaign is stalled >5 minutes, and all campaigns reach a terminal state; thresholds require production capacity review before launch.
- [ ] **CAM-SCALE-002** — Phase 4 | Owner: Rate limiter | Verify: `TEST: campaigns.fair_throttling` + artifact `fairness-load-report` | Pass (provisional): with N=10 equally backlogged tenants, each tenant receives at least one batch within 60 seconds, zero sends exceed configured per-number limits, and no tenant waits >3× the median tenant wait; thresholds require production capacity review.
- [ ] **CAM-SCALE-003** — Phase 4 | Owner: Operations/observability | Verify: `TEST: campaigns.operational_alerts` + artifact `alert-threshold-catalog` | Pass (provisional): injected stuck-job, webhook-lag, duplicate, quota-rejection, dead-letter, and partial-completion cases each emit the named metric within 60 seconds and an alert within 5 minutes, with 100% detection in 10 repetitions; thresholds require production capacity review.
- [ ] **CAM-SCALE-004** — Phase 4 | Owner: Platform/recovery | Verify: `TEST: campaigns.restart_replay` + artifact `restart-replay-report` | Pass (provisional): restart API/workers/Redis at each deterministic checkpoint yields zero duplicate sends, restores processing within 5 minutes, and replays every unfinished recipient exactly once; thresholds require production capacity review.

## 7. Verification record for this rewrite

- **Repository snapshot:** reviewed at current HEAD `53237ab4d34c3aee1931b3eb9441051927b2ac09`. The documentation change is uncommitted working-tree evidence; no commit was created.
- Re-read current campaign client: `client/src/pages/CampaignsPage.tsx` and campaign components/API references.
- Re-read current campaign server: `server/src/modules/campaigns/types.ts`, `routes.ts`, `service.ts`, `quota.ts`, `recipients.ts`.
- Re-read persistence: `server/prisma/schema.prisma` Campaign, CampaignRecipient, Contact, and WhatsappNumber models.
- Re-read queue/worker behavior: `server/src/config/queues.ts` and `server/src/workers/index.ts`.
- Re-read Meta webhook acknowledgement/queue path: `server/src/modules/whatsapp/routes.ts`.
- Re-read local billing heuristic: `server/src/modules/billing/usage.service.ts`.
- Checked official Meta documentation and policy URLs in §4 on 2026-08-08.
- Reproducible consistency check: the exact Python command below verifies nine level-2 sections, absence of the stale section-10 reference and old documentation-status row, at least eight HTTP source URLs, and presence of required acceptance/evidence phrases.
- Exact command (run from repository root):

```sh
python3 -c 'from pathlib import Path; import re; s=Path("docs/campaigns/COMPREHENSIVE_CAMPAIGNS_DOCUMENTATION.md").read_text(); assert len(re.findall(r"^## ",s,re.M))==9; assert chr(167)+"10" not in s; assert "Documentation"+" Status" not in s; assert len(re.findall(r"https?://[^)\s]+",s))>=8; assert len(re.findall(r"CAM-[A-Z]+-\d{3}",s))>=34; assert all(x in s for x in ["CAM-TENANT-001","CAM-CONSENT-006","CAM-LIFE-001","CAM-WEBHOOK-001","CAM-SCHED-001","CAM-QUOTA-001","CAM-EXPORT-001","CAM-ANALYTICS-001","CAM-INBOX-001","CAM-SCALE-001","broadcastQueue.add","effective `attempts = 1`","requireOptIn:false","STOP handling","START/SUBSCRIBE","N=10","Repository snapshot:"]); print("campaign-doc consistency ok")'
```
- `git diff --check` passed and IDE diagnostics reported no errors for this Markdown file.
- No source code, schema, plan, or runtime configuration was changed by this Phase 0 documentation update.

## 8. Change-control note

Line references describe the reviewed snapshot and should be refreshed when implementation changes. A future documentation update must preserve the distinction between verified behavior, defects, decisions, external constraints, and roadmap; it must not promote a roadmap item to “done” without acceptance evidence.
