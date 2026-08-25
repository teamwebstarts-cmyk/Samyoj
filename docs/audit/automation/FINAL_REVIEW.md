# Final automation review

Review date: 2026-08-25.

## Verdict

The automation platform is structurally strong enough for continued internal
testing, but it is not customer-production ready. The current implementation
has the important organization/number/credential boundaries and several
high-impact flow defects are fixed. Exact-once provider side effects, NFM
single-use authentication, raw webhook fail-closed proof, DNS rebinding
defense, live inbound proof, backup restore proof, and HttpOnly auth remain
outside a production-ready claim.

The most important product conclusion is that the flow builder should reduce
effort through deterministic scaffolding and metadata-driven defaults, not
through guessed security-sensitive values. A valid graph is more valuable than
an editor that allows every combination and discovers failure at send time.

## Cross-layer integration

The user path is: inbound message → durable Inbox row → flow/static/AI
decision → node execution → delay or immediate send → Meta acceptance → status
webhook → realtime Inbox update. The `pause` lock, number/tenant checks, retry
state, and `publish`/draft contract are the integration points that must be
tested together, not only as isolated functions.

## Classification legend

`FIXED` means code and a relevant automated check support the claim.
`DEFERRED` means the issue is known and deliberately not implemented in this
pass. `NOT A BUG` means the behavior is required by product/provider semantics.
`NEEDS LIVE TEST` means local tests cannot prove the Meta/ngrok or deployment
behavior.

## Confirmed working

- Active WhatsApp number and current credentials are resolved before outbound
  provider I/O.
- Flow/automation delayed jobs no longer carry encrypted WhatsApp tokens.
- Inbound flow, static automation, and AI precedence is explicit.
- Conversation locks serialize inbound flow state and pause clearing.
- Flow waits and delay jobs re-read current conversation state.
- Cross-flow recursion has a bounded runtime guard.
- Assignment validates organization membership.
- NFM replies are bound to number, sender, conversation, node, and Meta asset.
- Webhook URLs are checked on write and immediately before dispatch.
- Flow URL logs remove query parameters.
- Draft/publish/restore/duplicate preserve the audited settings and start node.
- Server graph validation rejects the audited invalid node configurations.
- Pagination inputs are clamped rather than allowing negative/unbounded values.
- A post-message-insert automation error gets a durable identifier-only retry.

## Critical / High

### Fixed in this pass

- Stale or exposed WhatsApp credentials in flow/automation job payloads.
- Unbounded `goto_flow` recursion.
- Pause race that could write a new wait state.
- Cross-organization agent assignment.
- Cross-number/cross-org NFM binding gap.
- Customer webhook SSRF at configuration/dispatch boundaries.
- Partial flow restore and stale publish state.
- Post-insert inbound automation drop.

### Still high risk

- **Outbound ambiguity:** Meta may accept a message while the request times
  out. Retrying the database message can duplicate the customer-facing send.
  Add a provider operation/idempotency record and reconciliation workflow.
- **NFM token replay/forgery:** current binding is strong but token semantics
  should be authenticated, expiring, and single-use.
- **Webhook signature deployment mode:** prove missing production secret fails
  closed and that raw request bytes are used for HMAC verification.
- **SSRF DNS TOCTOU:** validate all DNS answers now; add IP pinning/egress
  isolation before treating this as closed.

## Still deferred

- Provider operation/idempotency records and accepted-but-timed-out
  reconciliation.
- Authenticated, expiring, single-use NFM tokens.
- Production proof for webhook fail-closed configuration, DNS-rebinding
  defenses, live inbound delivery, and backup restore.
- HttpOnly authentication migration remains deferred by the workspace security
  policy.

## Medium findings

- Add static cross-flow cycle validation and display a graph warning.
- Replace read/modify/write analytics/version counters with atomic or
  transactional operations.
- Unify the duplicate frontend preview traversals.
- Make synthetic preview branches and outcomes explicit.
- Add provider metadata completion checks for templates, forms, and media.
- Add execution history with node status, retries, wait state, and last error.
- Add recipes for common flows and one-click branch wiring.

## Not bugs / deliberate constraints

- A customer-service-window failure for a free-form message outside the 24-hour
  window is expected Meta policy behavior, not an Inbox transport bug.
- `SENT` means provider acceptance; delivery requires the status webhook.
- A delay cannot cancel a provider request already in flight; cancellation
  stops later nodes and clears waits.
- A preview that chooses a representative path is acceptable if clearly labeled
  and branch selection is available.
- A 100-node cap is a safety bound, not a claim that every 100-node graph is
  usable.
- Billing, Phase C automation, live call transfer, and customer production
  launch were not implemented by this audit.

## User-effort improvement plan

### Ship next

1. Add starter recipes: welcome, lead capture, business-hours handoff, FAQ,
   and missed-call callback.
2. Prewire deterministic branches and show incomplete-branch badges.
3. Load template/form metadata to generate parameter fields.
4. Add an explicit completion checklist before publish.
5. Show “draft saved” and “live version” as separate states.
6. Add branch-aware example preview controls.

### Do not automate

Never infer or auto-fill access tokens, consent, URLs, phone numbers, agent
identity, billing choices, or customer-facing claims.

## Test evidence

### Passed

- `cd server && npm run build`
- `cd server && npx vitest run src/modules/automation src/modules/flows
  src/modules/flows-assets src/modules/integrations src/modules/messages`
  — 146 test files and 971 tests passed (server); 31 files and 145 tests (client).

## Verification (2026-08-25 recheck hardening)

- Server: `146` test files, `971` tests passed.
- Client: `31` test files, `145` tests passed.
- `npm run build` passed in `server/` and `client/`.

Customer production readiness is still **not** claimed.

### Required before claiming closure

- Unit tests for cross-flow cycle/hop protection.
- Unit tests for pause versus slow-node execution.
- Unit test for durable inbound retry payload reconstruction.
- NFM handler negative tests for wrong number, sender, form, node, replay, and
  organization.
- SSRF route/dispatch tests for HTTP, localhost, private IPv4/IPv6, DNS
  private resolution, credentials, and redirects.
- Flow validation tests for duplicate IDs, conditions, CTA HTTPS, schedules,
  and node limits.
- Client tests for publish-first-save, restore, duplicate draft, and timezone
  schedule preservation.
- Live ngrok/Meta test: a new phone reply must increment `totalReceived` and
  create/advance the correct Inbox flow.
- Live test: disconnect/rotate a number while a delay is queued.
- Provider ambiguity/reconciliation test with a simulated accepted-but-timed-
  out request.

## Gate accounting

The unlazy root ledger records artifact, compile, backend regression, client
regression, and classification gates. Its final count must be remeasured after
the checks execute; this document intentionally lists outstanding test gates
instead of converting them into a false “all tested” claim.
