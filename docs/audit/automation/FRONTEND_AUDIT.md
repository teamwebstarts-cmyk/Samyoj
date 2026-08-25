# Frontend flow-builder audit

Research date: 2026-08-25. Scope: `client/src/pages/FlowBuilderPage.tsx`,
`client/src/components/flows/FlowNodePanel.tsx`, graph utilities, preview
simulators, Meta Flow builder, and the flow API contract.

## Current user journey

The **palette**, **canvas**, and **node editor** form the main workflow; the
setup panel owns triggers and the validation/save/publish controls own the
server contract.

1. The user selects a trigger in the setup panel.
2. The user drags a step from the palette onto the canvas.
3. A node panel exposes fields for that step.
4. The canvas connects `next` edges and named branch edges.
5. The preview simulates a representative path; it is not a provider sandbox.
6. Save creates/updates either a draft or published flow.
7. Publish now saves the current draft first, then calls the publish endpoint.
8. Version restore returns the complete flow and rehydrates nodes, start node,
   trigger configuration, enabled state, and priority.

## Confirmed fixes

### F1 — Publish could publish stale server state

**Old failure:** the publish action could call the publish endpoint without
persisting the latest editor state first.

**Current behavior:** `handlePublish()` calls `flowApi.update(id,
buildPayload(true))` before `flowApi.publish(id)`. A publish failure leaves a
draft instead of silently publishing a previous graph. Status: **FIXED**.

### F2 — Restore was partial and could create a misleading editor

**Old failure:** restore returned only nodes in the client contract; trigger,
start node, enabled, and priority could remain from the current flow.

**Current behavior:** `FlowVersionsPanel` accepts the expanded restore object,
and `handleRestoreVersion()` applies all returned settings and lays out the
graph from the returned start node. Status: **FIXED**.

### F3 — Duplicate used published nodes instead of the active draft

**Old failure:** a user iterating on a draft could duplicate an older published
graph.

**Current behavior:** the server duplicates `draftNodes ?? nodes` and carries
the source start node/configuration. The copy starts as a draft. Status:
**FIXED**.

### F4 — Button IDs could drift from branch keys

**Old failure:** editing/reordering quick buttons could leave `branches`
pointing to stale IDs, especially for the third option.

**Current behavior:** `prepareNodesForSave()` normalizes button IDs, labels, and
branch mappings before validation/save. Server validation also rejects
duplicates and missing branch targets. Status: **FIXED**.

### F5 — Local validation could be bypassed

**Old failure:** important checks existed only in React state/UI.

**Current behavior:** API graph validation covers node count, references,
conditions, buttons, schedules, URLs, delays, webhooks, and form presence.
Client validation mirrors the common errors for earlier feedback. Status:
**FIXED for the audited cases**.

### F6 — Schedule input displayed UTC as local time

**Old failure:** `new Date(localInput).toISOString()` stored UTC, then
`slice(0, 16)` displayed UTC clock fields as if they were local. A user in
India could see a saved time shifted by 5:30 hours.

**Current behavior:** `toDateTimeLocal()` formats an ISO timestamp with local
date/time getters, while input changes still normalize local input to ISO.
The API accepts schedule delay up to seven days and enforces delay nodes at
24 hours. Status: **FIXED**.

## Remaining usability and contract findings

### U0 — Hardening pass (2026-08-25)

The recheck hardening pass landed:

- Per-WhatsApp-number scoping for flows, legacy auto-replies, and Meta flow assets (`whatsappNumberId` + migration `20260825170000_flow_automation_number_scope`).
- Durable inbound pipeline stages on message metadata to prevent duplicate static/AI on webhook retries.
- Fresh `botActive` re-check before static replies; pause cleanup returns success/failure with tenant scope.
- Handoff emits `activeFlow: null` for Inbox.
- Builder: `linkNodes()` in save path, keyboard delete propagation, load-error gate, `expectedUpdatedAt` conflict (409), draft-only version restore, server validation errors surfaced, edge delete clears branches, duplicate-edge rejection, analytics error/refresh, automation activity panel mounted.

### U0b — Recheck audit reconciliation (subagent `ab5d056e`, read-only)

| Finding | Status after hardening |
|--------|-------------------------|
| Save can publish without clear label | **Partially addressed** — header shows **Publish** when enabled; draft path remains separate |
| Server validation errors ignored | **Fixed** — `validationErrors` block save and appear in the issues banner |
| Preview is synthetic | **Open** — label/branch selector still deferred |
| Reply-button “Go to next step” vs required branch | **Open** — implicit `linkNodes` helps runtime; explicit branch validation unchanged |
| URL/call nodes keep reply handles | **Open** — graph handles still branch-shaped |
| Restore destructive + live | **Fixed** — server writes `draftNodes` only; client confirms restore |
| Unsaved work on number switch / no conflict detection | **Partial** — `expectedUpdatedAt` 409 + load-error gate; unload guard still open |
| Flow APIs ignore selected number | **Fixed** — `resolveActiveWhatsappNumber` on flow/automation/asset routes |
| Reference-data cache keyed only by Meta phone id | **Fixed** — cache key is `organizationId:whatsappNumberId` |
| Draft Meta forms in picker | **Open** |
| Template parameter mapping in flow editor | **Open** |
| Stale `intentRoutes` after button delete | **Fixed** |
| Regex trigger safety | **Open** |
| Contact/location dangerous defaults | **Open** |
| Question field falls back to `answer` | **Open** |
| Meta Flow Publish on new asset only saves | **Open** |
| Keyboard delete not persisted | **Fixed** |

Deferred for live verification: edge reconnection handler, mobile editor clipping at 375px, stale template reference on publish.

### U1 — Preview behavior is intentionally synthetic but not explicit enough

The builder has multiple preview paths that automatically choose the first
button/list option and force conditions to “yes”. This is useful for a quick
smoke view, but users can mistake it for the actual customer path.

**Recommendation:** label the preview “Example path”, add a branch selector,
show `business hours`, tag, language, variable, and webhook outcomes as
controls, and mark generated values such as “Customer answer”.
Priority: **P1**.

### U2 — Builder has two simulation implementations

`flowUtils.ts` contains more than one preview traversal for related views. They
can diverge as node types are added, producing a preview that does not match
the other preview or server execution.

**Recommendation:** define one pure `simulateFlow(nodes, input)` engine and
reuse it for both panels. Keep provider rendering separate from traversal.
Priority: **P1**.

### U3 — Branching defaults hide incomplete routing

`BranchSelect` displays “Go to next step” when no explicit target exists. That
is a useful default for a linear flow, but it is dangerous for conditions and
A/B splits because a branch may silently fall into the linear `next` path.

**Recommendation:** show a warning badge on unconnected branch handles and
provide “Connect both paths” as a one-click action. Treat condition/A-B
branches as required before publish. Priority: **P1**.

### U4 — The node panel repeats domain rules

Button max lengths, schedule limits, form requirements, and URL rules are
represented in the panel, client utilities, server Zod, server graph
validation, and provider payload builders.

**Recommendation:** create a versioned flow-contract package for shared
constants and pure validators. The server remains authoritative; the client
uses the same rules for immediate feedback. Priority: **P1**.

### U5 — Adding common flows still requires too many manual fields

The builder has useful defaults, but the user must still manually wire many
common patterns: welcome → buttons → handoff, lead capture → tag → team,
business-hours routing, and FAQ → AI fallback.

**Recommendation:** add “starter recipes” that create a valid, connected graph
with clear placeholders and a short completion checklist. Auto-create branch
targets only where intent is unambiguous; never invent a customer-facing URL,
phone, template, or agent. Priority: **P1**.

### U6 — Restore and dirty state need a stronger mental model

Restore immediately makes a version live according to the toast, while the
editor state also changes. A concurrent edit in another tab can overwrite it.

**Recommendation:** make restore a draft operation followed by an explicit
publish confirmation, include version/updated-at conflict detection, and show
“saved draft / live version” separately. Priority: **P1**.

### U7 — Large graphs degrade the canvas

The API now caps graphs at 100 nodes, but layout is breadth-first and uses
array searches. Dense graphs can cause repeated scans and a difficult canvas.

**Recommendation:** maintain an ID map during layout, virtualize palette/node
details if needed, and add semantic complexity warnings for high fan-out,
deep nesting, and long synchronous paths. Priority: **P2**.

### U8 — Missing fields are discovered late for provider-specific nodes

Template parameter names, Meta Flow field compatibility, media MIME/size, and
phone formatting are not all fully validated before save.

**Recommendation:** fetch provider metadata when selecting the node and present
field-level completion states. The API must repeat all provider-critical checks.
Priority: **P1**.

## User-effort improvements

### Safe defaults

Safe defaults are deterministic values that do not make a security or consent
decision: stable option IDs, the first start node, common recipe wiring, and
provider metadata-derived parameter rows.

### Explicit confirmation

Restore, publish, disable, and any action that changes live customer behavior
should use explicit confirmation and show the target version/settings.

## Effort-reduction design

The safest automation is deterministic scaffolding:

- start-node selection defaults to the first node and is visible;
- new reply buttons receive stable IDs and labels;
- connected nodes inherit a clear next-step summary;
- common recipe nodes are prewired;
- selecting a template can pre-create parameter rows from its metadata;
- selecting a contact field can fill the question field and retry copy;
- schedule input preserves the user’s local clock;
- publish explains exactly what is still blocking it;
- destructive restore/disable actions use explicit confirmation.

Do not auto-fill secrets, URLs, phone numbers, consent, agent identity, or
Meta credentials. Those require deliberate user input.

## Frontend test plan

- Save a new flow as draft, reload, and verify every setting.
- Edit a published flow, publish, reload, and verify no stale graph is live.
- Duplicate a flow with unsaved draft changes.
- Restore versions with different trigger/start/enabled/priority values.
- Reorder and rename all three buttons; verify branch targets survive.
- Delete a branch target and verify publish is blocked.
- Enter non-HTTPS CTA, invalid schedule, 24-hour-plus delay, and 100-plus
  nodes; verify immediate errors and server rejection.
- Change a scheduled time in a non-UTC browser and verify the same wall-clock
  time after reload.
- Preview each node type and compare the chosen path with server semantics.
- Open two tabs and verify stale updates are rejected or clearly surfaced.

Client compilation was re-run after the current changes; interactive browser
and provider tests remain **NEEDS LIVE TEST**.
