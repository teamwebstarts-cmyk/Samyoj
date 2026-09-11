# PLAN — Packet C webhook persist-then-ack

Owner: engineering
Mode: Solo
Scope: HMAC stays first. Durable encrypted envelope exists before `EVENT_RECEIVED`. Queue jobId is the envelope id. Processor routes every `phone_number_id`. Duplicate `metaMessageId` resumes media/order/automation. Operator can replay by event key. Public health stays URL-free and exposes oldest waiting age.

## Out of this packet

- Live phone reply (Manual)
- Packet F 1000-send harness
- New admin UI for replay
- KMS (app `ENCRYPTION_KEY` ciphertext)

## Recheck (2026-09-11, Packet F session)

- CSRF exemption used `startsWith('/api/whatsapp/webhook')`, which also matched `/webhook-replay`. Fixed to path-boundary match. Replay stays authenticated + CSRF.
- Running DB was missing envelope + outbound-idempotency migrations; applied with `npm run db:migrate-startup-safe` (historical unique-phone DELETE was not pending).
