# Automation / Flow Deep Audit Plan

Scope: Re-verify the Samyoj automation and flow system end to end, research
current workflow-engine patterns, document every material finding, and fix
confirmed high-impact defects without inventing Phase C features.

## Contract

- Preserve organization and `whatsappNumberId` isolation on every read, write,
  queue job, webhook, and realtime event.
- Preserve the embedded-worker architecture; do not add a standalone worker.
- Preserve CSW rules: customer-service-window failures must fail closed and
  may only use an approved template fallback where the current product
  contract supports one.
- Preserve `botActive` pause behavior and existing campaign/message consent
  rules.
- Treat existing code and `docs/memory/` as the source of truth; stale audit
  docs are evidence to re-check, not requirements.
- Review Phase C ideas and missing capability gaps, but do not implement
  tickets such as tickets/SLA, catalog, NL flow generation, form-builder
  merge, `goto_flow` stack, or wait-for-media unless the user explicitly
  chooses that scope after the audit.
- Do not put access tokens, secrets, or database credentials into job payloads,
  logs, browser storage, or documentation.
- User-effort improvements must reduce required decisions/inputs while keeping
  explicit confirmation before an externally visible send.

## Depth tree

### Layer 1: automation system audit

- `leaf-backend`: backend flow/automation execution, persistence, validation,
  queueing, retries, loops, pauses, idempotency, tenancy, and Inbox event
  integration. Owns `server/src/modules/automation/**`,
  `server/src/modules/flows/**`, and `server/src/workers/**`.
- `leaf-frontend`: builder and automation workflow ergonomics, node contracts,
  defaults, validation feedback, save/publish/version behavior, and UI
  duplication. Owns `client/src/pages/FlowBuilderPage.tsx`,
  `client/src/pages/MetaFlowBuilder.tsx`, `client/src/pages/AutomationsPage.tsx`,
  `client/src/components/flows/**`, `client/src/components/automations/**`,
  and `client/src/utils/flow*.ts`.
- `leaf-research`: external standards and ecosystem research plus the durable
  audit documentation. Owns `docs/audit/automation/**` and
  `.cursor/agents/samyoj-automation-audit.md`.

### Integration

- `node-integration`: parent re-verification, cross-layer contract checks,
  targeted fixes for confirmed defects, full relevant test suites, and final
  documentation reconciliation. It starts only after all three leaves return.

## Shared interfaces

- Flow graph node and edge schema: `server/src/modules/flows/types.ts`,
  validation/linking modules, and the client flow metadata/node components.
- Runtime trigger inputs: WhatsApp inbound webhook/message context, contact
  and conversation identity, active WhatsApp number, and organization.
- Queue payloads: identifiers and immutable run/version data only; credentials
  must be resolved at execution time from the tenant-scoped database context.
- Status semantics: draft, published/live, paused, completed, failed, and
  waiting states must remain compatible with current API clients and existing
  tests.
- Error semantics: use existing `AppError`/structured API errors and preserve
  safe, user-readable messages without leaking provider secrets.

## Evidence standard

Each finding must include exact path/line evidence, impact, reproduction or
reasoning, severity, proposed fix, and verification. Separate:

1. confirmed bug/security issue,
2. fragility or scale risk,
3. user-effort improvement,
4. intentionally deferred capability.

Status: leaf-backend READY; leaf-frontend READY; leaf-research READY;
node-integration WAITING.
