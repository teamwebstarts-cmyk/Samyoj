# Automation and flow deep audit

Research date: 2026-08-25.

This audit traces the customer path from an inbound WhatsApp webhook through
Inbox persistence, flow matching, waits, automation fallback, outbound delivery,
realtime events, and worker recovery. It also reviews the flow builder and Meta
Flow builder for data loss, misleading previews, and unnecessary user effort.

## Documents

- [Backend audit](./BACKEND_AUDIT.md) — execution, persistence, queues, waits,
  retries, validation, and Inbox integration.
- [Frontend audit](./FRONTEND_AUDIT.md) — creation, editing, graph wiring,
  publish/version behavior, previews, and effort reduction.
- [Security and tenancy](./SECURITY_AND_TENANCY.md) — negative checks for
  organization, number, credentials, queues, realtime, NFM, and SSRF.
- [External research](./EXTERNAL_RESEARCH.md) — primary-source patterns mapped
  to Samyoj decisions.
- [Final review](./FINAL_REVIEW.md) — fixed, deferred, not-a-bug, and live-test
  classifications with verification evidence.

## Prioritized backlog

### P0

- Add durable operation/idempotency records for outbound provider calls so a
  timeout cannot create an ambiguous duplicate.
- Add durable inbound automation completion state if webhook processing must
  guarantee recovery across every post-message-insert crash.
- Replace NFM token parsing with an authenticated, expiring token format and
  replay protection.

### P1

- Add cross-flow graph validation or a persisted execution stack for
  `goto_flow`; runtime hop protection is now present.
- Add an execution lease/state machine for pause, cancellation, and long-running
  nodes instead of relying only on a conversation lock.
- Add atomic flow analytics increments and transactional version allocation.
- Add number-scoped flow definitions if the product requires different flows
  for different active numbers in one organization.
- Pin validated DNS addresses or use an isolated egress proxy for all
  customer-configured HTTP delivery.

### P2

- Unify the two frontend preview simulators.
- Add branch controls and explicit synthetic-preview labels.
- Add field-level server validation messages and a shared dirty/live indicator.
- Add semantic flow complexity limits beyond the 100-node cap.

## Scope and non-goals

This audit covers the current automation and flow path. Non-goals are billing,
Phase C automation, live call transfer, a Temporal migration, and a customer
production-readiness claim before the separately listed live and operational
checks pass.

The audit fixes confirmed Phase A/B defects that are safe to change now. It does
not implement Phase C tickets, live transfer, a general loop stack, wait-for-
media, catalog/ticket/SLA automation, natural-language flow generation, billing,
or a Temporal migration. Customer production readiness remains unclaimed until
the separate authentication, live-inbound, backup, and operational gates pass.
