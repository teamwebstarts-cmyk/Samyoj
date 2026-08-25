# Automation security and tenancy review

Research date: 2026-08-25. This is a negative-path review: each boundary is
checked for organization confusion, WhatsApp-number confusion, stale
credentials, untrusted queue data, replay, SSRF, and information leakage.

## Trust boundaries

### Meta webhook → webhook worker

The webhook verification and provider routing happen before automation. The
worker must route by Meta `phoneNumberId` and active workspace, not by a
client-supplied organization or number header. Conversation, contact, message,
consent, and automation operations are then scoped to the resolved organization
and `whatsappNumberId`.

**Current result:** active-number routing and number-scoped conversation
queries are present. Inbound payloads now carry a DB `whatsappNumberId`, not an
access token or provider phone ID. Status: **PASS by code review; NEEDS live
negative test**.

### API/UI → flow graph

The API is the authority. A client can omit a node, alter a branch, change a
target flow, set an agent ID, or submit invalid URLs regardless of UI checks.

**Current result:** graph validation rejects missing references, duplicate node
IDs, over-100-node graphs, invalid conditions, malformed schedules, invalid
button IDs, bad CTA URLs, excessive waits, unsafe webhooks, and missing
provider-critical fields covered by the current validator. Status: **PASS for
covered cases**.

### Queue → worker

Redis job data is not an authorization boundary. A job can be stale, duplicated,
manually altered, or run after a number disconnects.

**Current result:**

- flow and automation payloads use workspace IDs rather than credentials;
- delayed workers re-read organization/number/conversation state;
- outbound delivery resolves active credentials immediately before Meta I/O;
- assignment checks organization membership;
- durable inbound retry stores identifiers and reconstructs message data from
  the Inbox record.

Status: **PASS for credential and basic tenancy controls**. An attacker with
Redis write access remains able to cause denial of service; Redis must stay
private and authenticated.

### Outbound provider boundary

The risk is not only leaking a token. The system must avoid sending a message
through a different active number after a reconnect or reusing a token after
disconnect.

**Current result:** `getActiveWhatsappNumberCredentials()` requires the
organization, DB number ID, and active flag; `deliverOutboundMessage()` checks
the message’s conversation workspace and uses the resolved current phone ID and
decrypted token. Status: **PASS by code review; NEEDS disconnect/rotation test**.

### NFM reply boundary

An NFM reply contains provider-supplied number/sender/form data plus a
flow-token string. It must not be allowed to advance a conversation merely
because a token happens to contain a known ID.

**Current result:** handler checks token structure, active number, phone number
identity, sender/contact identity, conversation ownership, waiting node,
expected node ID, and expected Meta flow ID. Flow-asset lookup is organization
scoped. Status: **PASS for the reviewed binding flaw**.

**Open:** the token is not an authenticated expiring envelope and does not
include nonce replay storage. Implement HMAC or opaque random state with expiry,
single-use consumption, and a bounded lookup key. Priority: **P0**.

### Customer webhook/HTTP boundary

Customer-configured URLs are an SSRF surface and can also leak query secrets
through logs or follow redirects to a private destination.

**Current result:** `server/src/utils/safe-webhook-url.ts` blocks non-HTTPS,
URL credentials, internal hostnames, literal private/reserved addresses, and
DNS records resolving to private/reserved addresses. Configuration and
last-mile dispatch both enforce the check. Flow webhook fetch uses
`redirect: 'error'`; flow errors redact query strings.

**Open:** DNS can change between validation and fetch. Use an egress proxy or
resolve-and-pin the permitted address for the request. Also define an explicit
redirect policy for every integration path. Priority: **P1**.

### Realtime boundary

Socket connection checks organization membership, and conversation rooms are
organization plus number scoped. The remaining operational limitation is that
membership is checked at connect time; a role/number change does not remove a
live socket until reconnect.

Status: **PASS for connect-time tenancy; OPEN for live membership revocation**.

## Security findings and disposition

- **S1 — Fixed:** encrypted credentials in flow/automation delayed job data.
- **S2 — Fixed:** cross-flow recursion could exhaust a worker.
- **S3 — Fixed:** arbitrary cross-organization agent assignment.
- **S4 — Fixed:** NFM cross-number/cross-org/form-step binding.
- **S5 — Fixed:** webhook integration SSRF checks at configuration and dispatch.
- **S6 — Fixed:** webhook URL query parameters in flow error logs.
- **S7 — Fixed:** flow execution continues after pause/handoff in later nodes.
- **S8 — Deferred P0:** provider timeout ambiguity can duplicate outbound
  messages; the current database status transition cannot prove whether Meta
  accepted a timed-out request.
- **S9 — Deferred P0:** NFM replay and token forgery defenses.
- **S10 — Code fail-closed; deploy residual:** `webhook-signature-gate.ts`
  rejects production unsigned/unconfigured traffic (unit-tested). Remaining:
  HMAC must use raw request bytes (`rawBody`), not `JSON.stringify(payload)`,
  and that behavior needs a production-like deploy check.
- **S11 — Open:** live socket membership revocation.
- **S12 — Deferred P1:** DNS rebinding/egress isolation.

## Required negative tests

1. Use an active number A, enqueue a delay, disconnect A, and verify no send.
2. Reconnect with a rotated token and verify the queued send uses only the new
   token.
3. Alter a queued job’s organization/number/contact IDs and verify no
   cross-tenant read/write/provider call.
4. Submit an agent ID from another organization and verify assignment fails.
5. Replay an NFM reply after the wait is consumed and verify no state advance.
6. Send an NFM reply with valid token but wrong provider number, sender, or form
   ID and verify rejection.
7. Configure localhost, `127.0.0.1`, IPv6 loopback, link-local metadata,
   private DNS, credentials-in-URL, HTTP, and redirecting endpoints; verify
   all are rejected or not followed.
8. Force a webhook process failure after message insert and verify the durable
   retry runs exactly once at the automation decision level.
9. Make Meta accept a request but delay the response; verify reconciliation
   avoids an automatic duplicate.
10. Remove webhook secret/config in a production-like process and verify the
    endpoint rejects requests rather than accepting unsigned traffic.

No test should print access tokens, message body, phone number, webhook query,
or provider response containing PII.
