# External research mapped to Samyoj

Research date: 2026-08-25. Sources were checked against current official
documentation where available. External guidance is used to identify failure
classes; it does not override Samyoj’s product and tenancy rules.

## Sources

The primary source links are grouped below by Meta, BullMQ, Temporal, n8n, and
OWASP. Each source is mapped to an implementation decision rather than copied
as a generic best-practice list.

## Applicable patterns

The applicable patterns are: customer-service-window enforcement, accepted
versus delivered message states, stable job IDs, bounded retry/backoff,
idempotent side effects, explicit loop termination, per-node error policy,
redirect-safe SSRF validation, and durable flow state.

## Decisions for Samyoj

Samyoj keeps BullMQ for short waits, persists conversational state in Postgres,
validates three times at security-sensitive boundaries, and adds operation
idempotency before attempting customer production.

## Non-goals

This research does not authorize a Temporal migration, Phase C automation,
billing implementation, live call transfer, or a replacement of the existing
WhatsApp provider integration.

## Prioritized backlog

### P0

- Add provider operation/idempotency records and reconcile ambiguous sends.
- Make NFM tokens authenticated, expiring, and single-use.

### P1

- Add explicit error branches and execution history for long-running flows.
- Add DNS/IP pinning or isolated egress for customer-configured HTTP nodes.
- Add atomic analytics/version allocation and cross-flow cycle validation.

### P2

- Add deterministic recipes, branch wiring, and metadata-driven field forms.
- Unify preview behavior and expose wait/retry state to operators.

## Meta WhatsApp Cloud API

Primary sources:

- [Service messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/)
- [Conversation types](https://developers.facebook.com/docs/whatsapp/conversation-types/)
- [Template fundamentals](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/)
- [Flow response webhooks](https://developers.facebook.com/docs/whatsapp/flows/reference/flowswebhooks/)
- [Implement Flow endpoints](https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint/)
- [Flow JSON reference](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson/)

Relevant rules:

- Free-form service messages require an open 24-hour customer-service window.
- Outside that window, use an approved template.
- An accepted Messages API request is not delivery; delivery status arrives by
  webhook.
- A Flow completion webhook does not include the Flow ID. A business-generated
  flow token is the correlation/session identifier and must be unpredictable.
- Flow completion data is user/provider input and must be validated against the
  expected conversation and Flow step.

Samyoj mapping:

- CSW checks belong immediately before non-template provider calls, not only at
  flow selection.
- `SENT` means Meta accepted the request, not delivered; UI and audit wording
  must preserve that distinction.
- NFM state must bind token, conversation, sender, number, node, and asset.
- The current NFM binding hardening is correct directionally; expiring,
  authenticated, single-use tokens remain required for a P0-grade solution.

## BullMQ

Primary sources:

- [Job IDs](https://docs.bullmq.io/guide/jobs/job-ids)
- [Deduplication](https://docs.bullmq.io/guide/jobs/deduplication)
- [Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [Base job options](https://docs.bullmq.io/api/interfaces/v5.BaseJobOptions.html)

Relevant rules:

- Custom job IDs can prevent duplicate enqueue while the original job remains.
- Job IDs must not contain `:` and should not be digit-only.
- Removal of completed/failed jobs removes the duplicate barrier.
- Retries need explicit attempts and backoff; retrying a side effect does not
  make the side effect idempotent.
- Deduplication and execution idempotency are separate concerns.

Samyoj mapping:

- Stable IDs and no-colon IDs are now used for flow retries and delay jobs.
- Self-rescheduling lock retries are bounded so an occupied Redis lock cannot
  create an unbounded queue storm.
- Provider sends still require a database operation key and reconciliation;
  BullMQ job IDs alone cannot solve a timeout after Meta accepted a request.
- Removal policies should retain enough failed-job evidence to operate and
  reconcile, without retaining secrets or unnecessary PII.

## Temporal durable execution comparison

Primary sources:

- [Activity definition and idempotency](https://docs.temporal.io/activity-definition)
- [Error handling](https://docs.temporal.io/best-practices/error-handling)
- [Activities](https://docs.temporal.io/activities)
- [Fixed-count retries](https://docs.temporal.io/design-patterns/fixed-count-retries)

Relevant rules:

- Activities can execute more than once, including after a worker succeeds but
  crashes before recording completion.
- External side effects need stable idempotency keys.
- Permanent/configuration failures should be non-retryable; transient failures
  should use bounded retry policy.
- Long operations need checkpoints/heartbeats rather than one giant activity.

Samyoj mapping:

- The current conversation `botState` plus flow queue is a pragmatic fit for
  short WhatsApp journeys.
- Add an `automation_execution` or `node_operation` record before adopting a
  larger workflow engine. It should capture flow version, node ID, inbound
  message ID, attempt, status, and provider idempotency key.
- Do not migrate to Temporal merely to hide missing idempotency; the same
  provider boundary problem exists in an Activity.

## n8n workflow ergonomics

Primary sources:

- [Loop behavior](https://docs.n8n.io/build/flow-logic/loop/)
- [Loop Over Items](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.splitinbatches.md)
- [Handling rate limits](https://docs.n8n.io/integrations/builtin/handle-rate-limits/)
- [Working with node settings](https://docs.n8n.io/build/understand-workflows/workflow-components/work-with-nodes/)

Relevant rules:

- Loop nodes need an explicit termination condition.
- Wait/batch controls are useful for rate limits.
- Error handling should be selectable per node: stop, continue, or error path.
- Users benefit when iteration context and “items left” state are visible.

Samyoj mapping:

- Keep the current runtime safety cap and add explicit loop/termination controls
  before exposing general loops.
- Add a first-class error branch for customer webhooks and AI/provider errors,
  rather than silently continuing or relying only on worker logs.
- Expose wait state, retry count, and last error in the Inbox/flow run view.
- Add batch/rate-limit controls only for campaign-like fan-out, not per-chat
  conversational flows.

## OWASP SSRF guidance

Primary sources:

- [SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet)
- [SSRF Prevention in Node.js](https://owasp.org/www-community/pages/controls/SSRF_Prevention_in_Nodejs.html)
- [OWASP Top 10 A10](https://owasp.org/Top10/2021/A10_2021-Server_Side_Request_Forgery_%28SSRF%29/)

Relevant rules:

- Parse and normalize URLs instead of trusting regex/string checks.
- Restrict scheme, host, port, and destination.
- Validate all DNS results, including IPv4/IPv6 and mapped forms.
- Disable redirects or revalidate every redirect target.
- Initial DNS validation alone has a TOCTOU/DNS-rebinding window.

Samyoj mapping:

- `assertSafeWebhookUrl()` adds the right application-layer defense and is
  enforced at both configuration and dispatch.
- Use an outbound proxy or DNS/IP pinning before treating customer webhooks as
  production-safe against rebinding.
- Apply request timeout, response-size, and body-size limits consistently to
  every customer HTTP node.

## Prescriptive implementation decisions

1. Keep BullMQ for short waits and retries; make side effects idempotent.
2. Keep flow state in Postgres/Conversation state until execution history,
   cancellation, and fan-out justify a dedicated workflow service.
3. Treat Meta acceptance and delivery as different states.
4. Validate at save time, again at execution time, and again immediately before
   outbound/HTTP side effects.
5. Prefer deterministic recipes and inferred defaults to asking users for
   values the system already knows; never infer security-sensitive values.
