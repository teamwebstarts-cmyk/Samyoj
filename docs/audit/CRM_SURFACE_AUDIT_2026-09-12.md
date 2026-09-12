# CRM Surface Audit — 2026-09-12

## Scope and verdict

This is a static, current-code audit of the already-built non-billing CRM. It covers Inbox, WhatsApp, messaging, media, AI/Train, calling, templates, Content Studio, contacts, leads, campaigns, automations, flows, forms, team, settings, auth/permissions, dashboard, analytics, tickets, commerce, and client reachability.

Billing/subscriptions were excluded except where shared entitlements affect CRM behavior. Live Meta, phone, provider-outage, customer-host, and off-host restore checks are reported separately; unit tests and synthetic webhooks do not prove those outcomes.

**Static verdict:** no P0 was evidenced. The current code still has multiple P1 risks that should be fixed before customer production, especially around message delivery, tenant/number boundaries, media access, AI/call lifecycle, and mutation authorization.

**Measured inventory:** 174 server test files, 40 client test files, and 9 admin test files. The existing manual readiness ledger still has G3 fresh inbound, G4 end-to-end send, G5 live isolation, and G6 GO/NO-GO open in `.unlazy/existing-harden-manual/GATES.md`.

## Evidence baseline

Already verified or recorded by the existing hardening packets:

- Webhook signature validation, encrypted persist-before-ack, durable claiming/replay, duplicate message repair, and multi-number dispatch.
- Inbox/campaign outbound idempotency and provider timeout classification.
- Campaign recipient normalization and `+91`/`91` deduplication.
- 1,000-recipient/restart harness with zero duplicate provider calls.
- Cookie auth, refresh rotation, CSRF, email-verification gating, socket membership re-check, and restore tooling.
- Active-number fail-closed selection and soft disconnect/reconnect semantics.

Those controls reduce risk but do not close the findings below. Every finding was traced against current source and existing tests; missing integration/concurrency tests are called out explicitly.

## P1 findings

### Messaging, media, and tenancy

1. **Local media path traversal can cross organization storage.**  
   Evidence: `server/src/modules/inbox/routes.ts:1435-1470` performs a prefix check; `server/src/modules/media/storage-adapter.ts:42-53,150-180` uses `path.join` without canonical containment. A path such as `orgA/../orgB/<known-file>` can pass the prefix check. Fix containment at the storage boundary for local reads, existence checks, and deletes; add traversal/cross-org tests.

2. **Outbound messages can remain permanently `PENDING`.**  
   Evidence: `server/src/modules/messages/send.service.ts:333-339` writes `providerCallStartedAt` before template/media preparation and the provider boundary; `server/src/workers/index.ts:191-204` skips pending rows with that marker. A crash before Meta I/O can strand the message. Claim immediately before provider I/O and add a recoverable pre-provider lease state; keep unknown-outcome handling after the call begins.

3. **Client timeout/retry can create duplicate WhatsApp sends.**  
   Evidence: `client/src/services/api.ts:228-233` creates a new idempotency key per request; `client/src/components/inbox/useInboxSender.ts:139-147,414-429` races a timeout without aborting the request and retries the optimistic failed bubble. Reuse one key per logical send, including retry/recovery, and test a server-success-after-client-timeout case.

4. **Organization realtime events are not consistently number-scoped.**  
   Evidence: `server/src/realtime.ts:11-20` delivers to a broad org room; message/webhook events in `server/src/workers/webhook.processor.ts:142-160`, `server/src/modules/messages/send.service.ts:530-550`, and `server/src/modules/messages/service.ts:157-175` do not consistently carry `whatsappNumberId`; `client/src/components/inbox/useInboxRealtime.ts:79-87` and `client/src/components/layout/NotificationCenter.tsx:80-100` filter fail-open when the ID is missing. Attach the canonical number ID to all number-owned events and reject missing/mismatched events client-side.

5. **Out-of-order inbound jobs can regress conversation activity/window timestamps.**  
   Evidence: `server/src/workers/webhook.processor.ts:628-645` and `server/src/modules/whatsapp/inbound-side-effects.ts:15-22` update `lastMessageAt` and `cs24hWindowOpensAt` independently. Use a row lock or conditional max-style updates so older webhook completion cannot overwrite newer timestamps.

6. **Catalog-order replay can create duplicate orders.**  
   Evidence: `server/src/workers/webhook.processor.ts:164-200` creates the order before associating its ID to message metadata; `server/src/modules/commerce/service.ts:292-360` uses a time-based reference; the schema only guarantees uniqueness for the supplied reference. Use a deterministic inbound-message reference and an idempotent upsert before association.

7. **Retention deletes message rows but leaves media objects.**  
   Evidence: `server/src/workers/media-retention.worker.ts:82-120` does not call `deleteMediaObject`, although `server/src/modules/media/storage-adapter.ts:167-180` exposes it. Collect media paths, delete local/S3 objects idempotently, then delete rows; add local and S3 retention tests.

8. **Configured `S3_PUBLIC_URL` can return unsigned media URLs.**  
   Evidence: `server/src/modules/media/storage-adapter.ts:120-123`. A public bucket/CDN turns possession of the URL into long-lived unauthenticated access. Keep storage private and issue signed URLs or use an authenticated proxy; verify the deployment ACL separately.

9. **Provider-status persistence has a read-modify-write race.**  
   Evidence: `server/src/modules/whatsapp/provider-status.ts:80-160` merges metadata in memory and updates without a version/timestamp predicate. Concurrent status webhooks can overwrite newer state. Use a transaction/row lock or conditional newer-than update.

10. **Direct outbound contact creation records undocumented opt-in.**  
    Evidence: `server/src/modules/messages/service.ts:80-99,220-240` creates contacts with `optedIn: true` without consent source/time/audit. Campaign sending fails closed today, but the contact record is misleading. Default to not opted in; only explicit consent paths set consent fields.

11. **Webhook replay can duplicate organization webhook deliveries.**  
    Evidence: `server/src/workers/webhook.processor.ts:247-254`; `ProviderWebhookDelivery` has no endpoint-plus-source-event uniqueness key in `server/prisma/schema.prisma:864-880`. Add a deterministic delivery key and unique upsert.

12. **Webhook-health refresh can stay stale after number switching.**  
    Evidence: `client/src/hooks/useWebhookHealth.ts:31-44,77-79`. A request for the old number can suppress the new request, then its response is discarded. Abort or queue the newly selected number’s refresh.

### AI and calling

13. **Calling AI can answer from Chat FAQ data.**  
    Evidence: `server/src/modules/ai/knowledge.service.ts:293-319` falls back to the first enabled `CHAT` bot when calling knowledge misses. Remove the fallback or make shared knowledge explicitly opt-in; add Chat-vs-Call isolation coverage.

14. **AI follow-up jobs can be acknowledged while unprocessed.**  
    Evidence: `server/src/modules/automation/engine.ts:380-419`; `server/src/workers/index.ts:782-795`. Lock contention returns successfully after logging “lock busy”, so BullMQ does not retry. Requeue or throw a retryable error when the message was not processed.

15. **AI outbound retries are not idempotent around provider success.**  
    Evidence: `server/src/modules/automation/engine.ts:231-250,323-327,463-472` creates a new outbound message on job retry. Persist a deterministic result/idempotency key per inbound message and separate post-send logging/handoff from delivery.

16. **Maximum concurrent calls admission is non-atomic.**  
    Evidence: `server/src/modules/calling/routing.service.ts:85-99`, `call.processor.ts:250-252`, and `agent-call.service.ts:61-64`. Two simultaneous calls can both observe capacity. Reserve a slot atomically in Redis/DB before routing.

17. **Agent accept/decline/terminate transitions race.**  
    Evidence: `server/src/modules/calling/agent-call.service.ts:20-61,80-116` and `call.processor.ts:748-797`. State is checked, external work runs, then status is written unconditionally. Claim with a conditional transition/per-call lock and require the expected prior state.

18. **Redis hangup protection fails open.**  
    Evidence: `server/src/modules/calling/session-store.ts:181-200` swallows marker failures; `call.processor.ts:489-497,748-770` can accept a late connect after a terminate event. Persist a durable terminal tombstone and fail closed on uncertainty; bound critical Redis operations.

19. **STT failure can leave an active call silent.**  
    Evidence: `server/src/modules/calling/sarvam.stt.ts:133-151` only logs socket failure; `ai-voice-agent.ts:230-240` does not reconnect or terminate durably. Add one bounded reconnect, then a durable provider-failed termination and operator-visible event.

20. **Call termination waits on summary generation.**  
    Evidence: `server/src/modules/calling/routes.ts:1034-1057` and `ai-voice-agent.ts:1059-1110`. A slow summary provider can leave the provider call connected after audio processing stops. Terminate/persist terminal state first; generate the summary asynchronously with a timeout.

21. **AI calling-minute billing has a crash window.**  
    Evidence: `server/src/modules/calling/ai-voice-agent.ts:1164-1207`, `server/src/modules/billing/ai-credits/service.ts:365-430`, and startup cleanup in `server/src/index.ts:374-389`. A crash after terminal call update but before deduction leaves no retry marker. Make completion and pending billing outbox state atomic; reconcile terminal calls lacking a deduction.

22. **Call recordings are unmanaged raw caller PCM.**  
    Evidence: `server/src/modules/calling/ai-voice-agent.ts:250-256,1113-1133`, `server/src/modules/calling/delete-call-logs.ts:26-52`, and `server/src/workers/media-retention.worker.ts:8-18,82-120`. Files lack DB metadata, authenticated access, deletion linkage, and per-org retention; capture begins before consent completion. Do not claim managed recording; either add tenant-scoped recording lifecycle or disable/limit capture until consent.

23. **Calling credit preflight semantics are inconsistent.**  
    Evidence: `server/src/modules/ai/sarvam-chat.service.ts:99-117`, `chat-completion.service.ts:45-51,94-100`, and `calling/ai-voice-agent.ts:159-163`. Voice passes `skipCreditCheck` but completion still checks credits per turn. Define a call-level reservation/allowance and honor it consistently.

24. **AI usage logging is lossy and mixes units.**  
    Evidence: `server/src/modules/ai/org-ai.service.ts:155-230`, `chatbot.service.ts:816-823`, `calling/ai-voice-agent.ts:129-137`, and `ai-usage-actions.ts:39-48`. Database write failures are swallowed, partial streams are unrecorded, and token, character, and call-minute quantities share a token quota. Use a durable usage outbox and separate ledgers/limits.

### Templates, growth, and automations

25. **Template test-send bypasses consent and durable outbound audit.**  
    Evidence: `server/src/modules/templates/routes.ts:350-418`. It accepts an arbitrary phone and sends directly through Meta without an auditable contact-consent check or message row. Require an active-number contact with campaign consent and use a shared audited/idempotent send path.

26. **Content Studio Meta drafts are not bound to a WhatsApp number.**  
    Evidence: `ContentDraft` in `server/prisma/schema.prisma:2102-2127` and `server/src/modules/content-studio/composer/routes.ts:350-478`. A draft submitted on number A can be refreshed/submitted on B. Persist the first target number and reject mismatches.

27. **Template variable metadata is organization-wide and can cross numbers.**  
    Evidence: `server/src/modules/templates/variable-meta.ts:60-100` and `routes.ts:210-249`. Key mappings by number, name, and language; remove arbitrary language fallback and reject duplicate/invalid component indexes.

28. **Content Studio budget checks are raceable and under-reserved.**  
    Evidence: `server/src/modules/content-studio/shared/cost-guard.ts:102-140`. Concurrent jobs can pass `assertBudget()` before later `recordUsage()`. Reserve estimated/max units atomically and reconcile actual usage.

29. **Lead assignment accepts a user outside the organization.**  
    Evidence: `server/src/modules/leads/routes.ts:15-22,67-94,107-137`. `assignedAgentId` is written without `OrganizationUser` validation. Validate membership and allowed role on create/update.

30. **Lead creation from a contact crosses numbers and is not idempotent.**  
    Evidence: `server/src/modules/leads/routes.ts:155-184`; existing lookup filters only organization/contact; schema lacks a composite unique. Include number scope, add the intended unique constraint, and use upsert/unique-conflict handling.

31. **Inbound automation stages are not atomically claimed.**  
    Evidence: `server/src/modules/automation/inbound-pipeline.ts:20-44` and `engine.ts:625-680`. Duplicate webhook jobs can both observe an incomplete stage and send. Use a CAS/unique stage claim before provider I/O.

32. **Automation conflict checks are raceable.**  
    Evidence: `server/src/modules/automation/routes.ts:153-190,205-250` and `conflicts.ts:60-160`. Conflict reads use the global client outside the organization lock. Use the transaction client and a database-backed conflict key/lock.

33. **In-flight flows are not pinned to an immutable version.**  
    Evidence: `server/src/modules/flows/engine.ts:94-114,1500-1520` and `versioning.ts:8-40`. Conversation state stores flow/node but resumed execution reads mutable current nodes. Store and execute against the immutable `FlowVersion`.

34. **Manual flow scheduling has no idempotency.**  
    Evidence: `server/src/modules/flows/routes.ts:591-622` and `engine.ts:2080-2104`. Repeated requests create multiple delayed starts. Require an idempotency key or enforce one active schedule per conversation/flow.

35. **Campaign repeats have a completion/scheduling crash window.**  
    Evidence: `server/src/modules/campaigns/service.ts:560-620,1710-1767`. Completion and next-run seeding are separate. Use an outbox/state transition or an idempotent recovery scan.

### Team, settings, analytics, tickets, and commerce

36. **Multi-organization users are silently bound to the first organization.**  
    Evidence: `server/src/modules/auth/routes.ts:177-206,300-340`, `auth/session.ts:66-94`, `auth/oauth.routes.ts:158-162,230-269`, `client/src/contexts/AuthContext.tsx:82-100`. `organizations[0]`/unordered `take: 1` is tenant selection. This needs an explicit organization-selection design; do not silently switch users.

37. **Configurable permission toggles do not protect Settings or Automations.**  
    Evidence: `server/src/modules/settings/routes.ts:65-76,120-230,249-311`, `automation/routes.ts:20-33,143-259,271-280`, and `client/src/components/team/TeamRolesTab.tsx:310-320`. Add `requirePermission('manageSettings')`/`manageAutomations` or remove those toggles from the matrix.

38. **Existing-account invites cannot be accepted.**  
    Evidence: `server/src/modules/team/routes.ts:618-662` returns conflict for an existing account; `client/src/pages/AcceptInvitePage.tsx:50-76,90-116` cannot reach its explanatory state. Add authenticated, email-matched acceptance and transactional membership attach.

39. **Cross-organization department IDs are accepted.**  
    Evidence: `server/src/modules/team/routes.ts:469-510,1070-1140,1165-1222`. Validate every department ID against the current organization on member create, invite, and update.

40. **Temporary-password enforcement is advisory only.**  
    Evidence: `server/src/modules/team/routes.ts:1128-1135`, `auth/routes.ts:238-267`, `client/src/pages/LoginPage.tsx:87-92`, `SettingsPage.tsx:135-190`. A `mustResetPassword` user receives a normal session. Enforce a reset-only session or remove the flag and UI.

41. **Commerce mutations lack role, permission, commercial, and transition guards.**  
    Evidence: `server/src/modules/commerce/routes.ts:20-24,58-178`, `commerce/service.ts:372-415`. Any member can change payment/fulfillment states, including invalid reversals. Define permission and entitlement guards, legal transition maps, atomic expected-state updates, and actor audit history.

42. **Analytics mixes active WhatsApp-number workspaces.**  
    Evidence: `server/src/modules/analytics/routes.ts:341-346,919-942,1155-1178`; `AiUsageLog` has a number but aggregate queries omit it. Apply active-number predicates to overview, AI deflection, reports, and CSV export; define legacy null-number behavior.

43. **AI deflection returns fabricated fallback queries.**  
    Evidence: `server/src/modules/analytics/routes.ts:965-1015`. Fixed counts are returned regardless of data. Derive from telemetry or remove the field.

44. **Settings partial failures look like successful defaults.**  
    Evidence: `client/src/pages/SettingsPage.tsx:204-236`. `Promise.allSettled()` ignores required failures, allowing defaults to be saved over real settings. Preserve panel errors and disable saves when required state failed.

45. **Settings JSON updates race, and GET mutates state.**  
    Evidence: `server/src/modules/settings/routes.ts:127-145,177-201,289-311` and `settings/org-profile.ts:99-121,150-220`. Use atomic/optimistic updates and move BrandKit initialization out of GET.

46. **Tickets have unrestricted state transitions and weak delete authorization.**  
    Evidence: `server/src/modules/tickets/routes.ts:40-50,112-166,224-286`. Validate transitions, query enums, and restrict delete with audit/soft-delete semantics.

47. **Team load balancing is organization-wide rather than number-scoped.**  
    Evidence: `server/src/modules/team/assignment.ts:65-132` and `ai/handoff.service.ts:8-29`. Pass active number through handoff and filter counts/round-robin state by number if team assignment is workspace-scoped.

## P2 findings

- `server/src/modules/ai/lock.ts:5-27`: fixed 45-second lock without renewal and non-atomic release.
- `server/src/modules/calling/session-store.ts:40-78`: active-call `SET`/`SADD`/`EXPIRE` is not atomic.
- `server/src/modules/ai-bot/routes.ts:920-960`: concurrent/batch Train creation can exceed count and duplicate titles.
- `server/src/modules/ai/chatbot.service.ts:846-873` and `ai/handoff.service.ts:11-33`: handoff assignment can race and emit duplicates.
- `server/src/modules/ai/sarvam-chat.service.ts:26-68`, `calling/sarvam.tts.ts:65-86`, `calling/meta-calling.service.ts:114-140`: provider retry/timeout policy is inconsistent.
- `client/src/utils/contactImport.ts:80-90,149-170` and `contacts/routes.ts:134-228`: blank imports can erase tags and supported fields are silently discarded.
- `server/src/modules/templates/types.ts:174-183` and `campaigns/template-validation.ts:80-86`: template media URLs accept non-HTTPS schemes.
- `server/src/modules/flows/validation.ts:270-274` and `flows/engine.ts:1090-1110`: supplied Meta Flow IDs are not validated against the active WABA.
- `server/src/modules/flows/versioning.ts:14-40,80-93`: concurrent version allocation can collide.
- `server/src/modules/automation/engine.ts:530-570`: bounded lock retries permanently drop inbound messages without a durable dead-letter/deferred record.
- `server/src/modules/automation/engine.ts:586-603`: opt-out lookup omits active-number scope.
- `server/src/modules/flows/analytics.ts:5-75`: flow analytics do not explicitly carry number scope.
- `server/src/modules/wa-forms/routes.ts:14-91`, `flows-assets/routes.ts:25-210`, and `client/src/components/flows/WaFormPicker.tsx:40-110`: two incompatible Forms backends remain active.
- `server/src/modules/templates/catalog.ts:650-678`: missing catalog URL overrides silently convert a URL CTA to QUICK_REPLY.
- `server/src/modules/media/public-sign.ts:4-34` and `media/public.routes.ts:7-50`: valid local media URLs last seven days and are not user/session-bound.
- `server/src/modules/analytics/routes.ts:139-150`: dashboard daily series truncates at 50,000 messages.
- `server/src/modules/tickets/routes.ts:1-16,136-286`: ticket mutations do not apply a commercial-expiry policy; product policy must decide this.
- `client/src/pages/ReportsPage.tsx:1-5`, `client/src/App.tsx:91-98`, `config/pageMeta.ts:60-70`: standalone Reports is dead navigation; `/leads` metadata exists without a route.
- `server/src/modules/media` call-recording files remain outside the normal media lifecycle and need the P1 recording decision above.

## Verified controls and deliberate boundaries

- Active-number resolution is fail-closed for multiple active numbers without a header; contact uniqueness is organization + number + normalized phone.
- Webhook HMAC, persist-before-ack, durable replay, message dedupe, outbound leases, campaign consent, and campaign worker safety are implemented and tested.
- Socket authentication/membership revocation and conversation-room scoping are implemented.
- NFM tokens include HMAC, expiry, conversation/node/phone checks, and replay CAS.
- Content Studio/WA Forms mutation role guards exist; Content Studio image/video/voice providers are intentional stubs and are labeled as such.
- Chat and Calling `AiBot` channels exist, but the Chat FAQ fallback finding must be fixed before claiming complete isolation.
- Live WebRTC agent transfer remains intentionally unsupported/message-only and is not treated as a bug.

## Live-only and production blockers

These cannot be closed by static review or local unit tests:

1. A new phone reply must increment webhook `totalReceived` and appear in Inbox on the real deployment path.
2. Connect → Inbox send → approved template → small consented campaign must be exercised against a test WABA, including a double-click/retry observation.
3. Two organizations/numbers must be exercised live for Inbox, contacts, campaigns, sockets, and webhook routing.
4. Backup restore must be rehearsed on a separate/customer-like host, not only the local isolated database.
5. Real AI calls must verify Meta/WebRTC media, Sarvam STT/TTS failure behavior, barge-in, Redis outages, recording consent, and session placement.
6. S3 bucket/CDN ACL and signed-URL policy must be verified in the deployed environment.

## Minimal implementation order

1. Fix security and tenant-boundary defects: local storage containment, S3 access mode, realtime number filtering, leads/team ownership checks, analytics number filters, template/content number binding, and permission guards.
2. Fix message/data integrity: pre-provider send leases, client idempotency reuse, inbound timestamp monotonicity, order/webhook delivery idempotency, media retention, consent provenance, AI lock/retry behavior, automation stage claims, flow scheduling/versioning, and campaign repeat recovery.
3. Fix calling lifecycle and accounting: Redis fail-closed hangup, atomic call admission/transitions, terminate-before-summary, STT failure handling, recording lifecycle, usage/billing outbox, and call-level credit semantics.
4. Fix correctness/UX gaps: settings failure states, invite acceptance, temporary-password enforcement, commerce/ticket state machines, contact imports, Reports reachability, and dead/duplicate Forms contracts.
5. Add focused regression tests for each corrected shared helper, then rerun the full verification set and update the audit with measured evidence.

## Fixed in this pass

The following verified defects were corrected and covered by the final build/test run: local media traversal and unsigned S3 URL fallback; provider-boundary lease timing; client send idempotency reuse; direct outbound consent fabrication; Chat-to-Calling FAQ leakage; AI lock-loss acknowledgement; inbound timestamp monotonicity; media retention cleanup; lead/team ownership and department scope; Settings/Automation permissions; number-scoped analytics/flow queries; automation conflict transaction scope; flow schedule/version allocation; ticket and commerce transition guards; template test-send consent/audit path; template metadata language/index validation; HTTPS template media URLs; STT/Redis/call transition failure behavior; Settings load-error visibility; message realtime number IDs; and deterministic catalog-order replay.

## Remaining open after this pass

The remaining code-level findings are not silently treated as fixed: complete realtime coverage, Content Draft number binding, webhook delivery idempotency, AI usage outbox/unit ledger, call admission/recording lifecycle/billing reconciliation, immutable in-flight flow version pinning, campaign repeat recovery, multi-organization selection, existing-account invite acceptance, temporary-password enforcement UX, Forms backend consolidation, and the other P2 items listed above.

## Implementation update from this audit

The first hardening batch has been applied and rechecked in source:

- Local media paths reject absolute/traversal segments; S3 media uses the authenticated signed media route instead of a raw public URL.
- Outbound provider leases are claimed immediately before Meta I/O, and direct outbound contact creation no longer fabricates marketing consent.
- Inbox logical sends reuse one client idempotency key across timeout recovery; message realtime payloads now carry number IDs and the Inbox rejects numberless message events.
- Calling knowledge no longer falls back from Calling FAQs to Chat FAQs; AI lock contention is retryable; STT socket failure ends the call; agent accept/decline transitions are conditional; hangup-marker reads fail closed; summaries run after provider termination.
- Media retention attempts to delete stored message media before deleting old message rows.
- Lead assignment/from-contact creation, team departments, Settings/Automation permission toggles, analytics AI-number filters, flow analytics/version scope, automation conflict checks, ticket transitions/deletion, commerce transitions/guards, template consent test-sends, template variable language/index validation, HTTPS media URLs, Settings load failures, and deterministic catalog-order replay were hardened.

Remaining P1 findings are intentionally open where they require a schema/outbox migration, a product decision, or live provider evidence: multi-organization selection, Content Draft number binding, complete realtime coverage, webhook/order delivery idempotency, AI usage ledger/outbox, call admission/recording lifecycle/billing reconciliation, flow execution version pinning, campaign repeat recovery, existing-account invites, temporary-password UX, and Forms backend consolidation.

## Final verification evidence

- Server: `174` test files, `1,114` tests passed; TypeScript build passed.
- Client: `40` test files, `183` tests passed; production build passed.
- Platform Admin: `9` test files, `19` tests passed; production build passed.
- Production dependency audits for server/client/admin: `0` high-severity vulnerabilities reported.
- WhatsApp-number isolation preflight: zero invalid identities, duplicate identities, invalid contacts, duplicate scoped contacts, cross-organization relationships, or cross-number relationships.
- Migration validation correctly refused raw deployment because the historical destructive migration `20260808120000_unique_whatsapp_phone_number_id` exists; this is the expected fail-closed safety behavior.
- Local testing deployment was already running and responded successfully: API health/database/Redis `ok`, embedded workers `true`, client HTTP `200`, admin HTTP `200`, public webhook challenge `200:ping`. The local receive counter is `8`, but its last event is old; this is not fresh customer-host proof.
- Unlazy CRM gate ledger: `8/8` gates met. The live-only items above remain open by design.

No customer-production GO claim is made by this document. The manual gates remain authoritative.
