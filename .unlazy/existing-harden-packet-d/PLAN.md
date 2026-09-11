# PLAN — Packet D outbound idempotency

Owner: engineering
Mode: Solo
Scope: Same Inbox/campaign click key returns one message and one Meta POST. sendMessage uses AbortSignal and does not retry after timeout/abort. Campaign claim/lease tests still pass. No webhook persist (C), no 1000-send harness (F).

## Out of this packet

- New idempotency product table
- Changing campaign worker claim algorithm
- Client retry-button reuse of the original key (retry endpoint is FAILED-only)
