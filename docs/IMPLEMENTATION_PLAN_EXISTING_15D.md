# Existing system — implementation plan (15 din)

> Working checklist: [ROADMAP_CHECKLIST_HINGLISH_2026.md](./ROADMAP_CHECKLIST_HINGLISH_2026.md)  
> Yeh **naya product nahi**. Jo already Inbox / Connect / Templates / Campaigns / Admin mein hai, usko crash-safe + honest banana.

**Code status (2026-09-11):** Packet **A + E + B + D + C + F** landed (gates met). Next: **Manual** (live inbound phone, off-host restore, GO/NO-GO). Customer production: **no**.

## OUT OF SCOPE

Is track mein **mat** likho / mat banao:

- Embedded Signup v4 SDK / Tech Provider popup
- Razorpay Subscriptions, GST invoice product, recurring AI add-ons
- Lead Ads / Ads Manager / Conversions API
- real Content Studio providers (image/video/voice APIs)
- Live call transfer, Phase C automations, Instagram / Messenger

Content Studio / billing **sirf honesty**: jhoot copy hatao, stub ko success+bill mat bolo. Naya engine nahi.

---

## Order (dependency)

```text
A honesty + known test     → customer jhoot band
B tenancy / permissions    → leak / bypass band
C webhook save-before-ack  → inbound lost band
D outbound idempotency     → duplicate send band
E campaign phone dedupe    → +91 / 91 double send band
F 1000 + restart harness   → scale proof
Manual: inbound phone, restore on other host, GO/NO-GO
```

A/B parallel chal sakte hain. C se pehle D/E ke tests likh sakte ho, lekin webhook persist C ke bina “inbound lost nahi” claim mat karo. F C+D ke bina mat chalao.

---

## Packet A — Din 1–2 honesty + known fail

**Status: done (2026-09-11)** except multi-org `organizations[0]` (needs org-switcher UI — skipped). Gates: `.unlazy/existing-harden-packet-a/` 4/4.

**Done jab:** client campaign test green; GST/Autopay/Full backup/Studio jhoot nahi; Settings mein App ID/Secret nahi.

| Kaam | File | Kya karna hai | Test |
|---|---|---|---|
| Empty audience error | [client/src/components/campaigns/campaignSendConfirm.ts](../client/src/components/campaigns/campaignSendConfirm.ts) `getCampaignSendErrorMessage` | `'Campaign must have at least one recipient'` ko subscribe copy pe map karo | [campaignSendConfirm.test.ts](../client/src/components/campaigns/campaignSendConfirm.test.ts) line 42–48 pehle fail, baad green |
| GST jhoot | Billing history UI (`client/src/pages/BillingPage.tsx` / billing components) | “GST Paid / SAC / invoice” mat dikhao jab invoice model nahi. Payment receipt bolo | UI string test ya grep gate: no `GST Paid` on receipt |
| Autopay live copy | [admin/src/pages/BillingConfigPage.tsx](../admin/src/pages/BillingConfigPage.tsx) ~423 | “live Razorpay recurring SKUs / UPI Autopay” hatao. Likho: catalog config, recurring checkout nahi | admin copy test |
| Full backup | [client/src/components/settings/IntegrationsPanel.tsx](../client/src/components/settings/IntegrationsPanel.tsx) ~196 | “Full backup” → export / not restorable, jo honestly hai | string assert |
| Studio stub | [images/routes.ts](../server/src/modules/content-studio/images/routes.ts) `stub-v1`; same [videos](../server/src/modules/content-studio/videos/routes.ts), [voices](../server/src/modules/content-studio/voices/routes.ts); [ContentStudioPage.tsx](../client/src/pages/ContentStudioPage.tsx) | Success + `recordUsage` mat. `sizeBytes: 0` fail/demo. Image pe bhi stub warning. Job poll | unit: stub does not increment billable usage |
| App ID/Secret | Connect/Settings UI; `PATCH /meta-config` already 410 | Confirm no App ID/Secret fields. Stale [api.ts](../client/src/services/api.ts) `updateMetaConfig` dead call mat use | grep Settings for App Secret |
| Multi-org silent pick | [server/src/modules/auth/routes.ts](../server/src/modules/auth/routes.ts), [session.ts](../server/src/modules/auth/session.ts) `organizations[0]` | Explicit org choose ya 409; pehli org silent nahi | auth test: two memberships |

**Packet A gate:** `cd client && npm test -- campaignSendConfirm` pass. Admin/client string checks. No new billing product.

---

## Packet B — leak / permission (existing routes)

**Status: done (2026-09-11).** Shared `requireAdminOnMutation` on Content Studio / wa-forms / onboarding; settings hours uses `adminGuard`; unsigned `/api/media/public` is 401 (HMAC query). API keys still integration-grade on contacts/campaigns — not studio/settings admins. Gates: `.unlazy/existing-harden-packet-b/` 4/4.

**Done jab:** agent Content Studio / wa-forms mutate 403; API key full-admin nahi (policy + test); public media guess nahi.

| Kaam | File | Kya karna hai | Test |
|---|---|---|---|
| Studio mutate auth | `server/src/modules/content-studio/**/routes.ts` (brand-kit, library, approvals, images, videos, voices, composer) | `authenticate` ke baad `loadPermissions` / `requireOrgRole('OWNER','ADMIN')` jaisa flows-assets | agent 403, admin 200 |
| wa-forms | [server/src/modules/wa-forms/routes.ts](../server/src/modules/wa-forms/routes.ts) | Same role guard as [flows-assets/routes.ts](../server/src/modules/flows-assets/routes.ts) | role test |
| onboarding mutate | [server/src/modules/onboarding/routes.ts](../server/src/modules/onboarding/routes.ts) | OWNER/ADMIN; arbitrary `stepId` lock | 403 agent |
| settings hours | [server/src/modules/settings/routes.ts](../server/src/modules/settings/routes.ts) | mutation role check | 403 |
| API key | [api-key.ts](../server/src/middleware/api-key.ts), [permissions.ts](../server/src/middleware/permissions.ts), Prisma `ApiKey` | Abhi all-admin. Minimum: documented scopes **ya** no campaign/studio/settings mutate without human role. Prefer fail-closed on dangerous routes | api-key cannot hit studio generate |
| Public media | [public.routes.ts](../server/src/modules/media/public.routes.ts) | `Cache-Control: public` + no auth. Signed URL ya auth + short cache | unauthenticated 401/403 |

**Packet B gate:** negative tests for agent + api-key on mutate. Number isolation existing tests still pass (`active-number`, contacts unique).

---

## Packet C — webhook: save pehle, phir ack (Din 3–7)

**Status: done (2026-09-11).** HMAC first; encrypted envelope persist then queue then `EVENT_RECEIVED`; jobId = envelope key; processor routes every `phone_number_id`; duplicate `metaMessageId` resumes media/order/automation; admin `POST /api/whatsapp/webhook-replay` (CSRF **not** exempt — path-boundary fix so `webhook-replay` is not treated as `/webhook`); health `oldestWaitingMs`. Gates: `.unlazy/existing-harden-packet-c/` 4/4. Live inbound still Manual. Migration `20260911150000_webhook_envelope_payload` applied on the running DB via `db:migrate-startup-safe` (with Packet D `20260911140000_outbound_idempotency_key`).

**Karna (landed):**

1. HMAC/validate jaise abhi (pehle 401/400).
2. Durable row: raw payload (encrypted/redacted) + `requestId` + per-entry `phoneNumberId`.
3. **Uske baad** `200 EVENT_RECEIVED`.
4. Queue job `jobId` = event id (duplicate Meta delivery = same job).
5. [webhook.processor.ts](../server/src/workers/webhook.processor.ts): har entry/change apne number se. First-entry-only filter hatao.
6. Duplicate `metaMessageId`: incomplete side effects resume (media, order, automation), skip-all nahi.
7. Operator: replay by event id + audit. Health: oldest waiting age.

**Tests:** persist-then-ack unit; crash between persist and queue → replay creates 1 message; 10k duplicate payloads → 0 extra messages (can start smaller N); two phone numbers in one payload → two inboxes.

**Manual later:** naya phone reply (Packet Manual).

---

## Packet D — duplicate send band (Inbox + campaign)

**Status: done (2026-09-11).** `Idempotency-Key` on Inbox + campaign send; unique message/campaign keys; Meta `AbortSignal` 20s, timeout = no retry; 429 still retries. Campaign claim/lease tests green. Gates: `.unlazy/existing-harden-packet-d/` 4/4. 1000-send restart proof is Packet F (met).

**Aaj:** [messages/routes.ts](../server/src/modules/messages/routes.ts) `/send` + Inbox POST read `Idempotency-Key`. [meta.service.ts](../server/src/modules/whatsapp/meta.service.ts) `sendMessage` has timeout/`AbortSignal`.

---

## Packet E — campaign `+91` / `91`

**Status: done (2026-09-11)** with Packet A. `dedupeRecipients` last-10 identity. Daily limit UI honesty still open if you want it later.

**Aaj:** [recipients.ts](../server/src/modules/campaigns/recipients.ts) `dedupeRecipients` last-10 via `normalizePhoneIdentity`. [validation.test.ts](../server/src/modules/campaigns/validation.test.ts) `+9198…` vs `9198…` = 1 row.

**Still open:** `dailySendLimit` UI vs [quota.ts](../server/src/modules/campaigns/quota.ts) — jo naam hai wahi enforce, ya UI se hatao. Jhoot limit mat chhodo.

---

## Packet F — 1000 send + restart (Din 8–11)

**Status: done (2026-09-11).** Harness, not a product feature. Gates: `.unlazy/existing-harden-packet-f/` 4/4. Evidence: `.run/packet-f-evidence.json`.

**Measured:** 1000 eligible → 1000 Graph calls, 1000 unique `to`, 0 dups. Restart after `providerCallStartedAt` → 0 extra Graph calls (crashed recipient 0 sends). 429 retried (2 HTTP); timeout and 5xx = 1 HTTP each. Isolated restore refused primary URL; schema-only restore into `samyoj_packet_f_restore` then dropped. Off-host encrypt + other-host restore still Manual.

Scripts: [packet-f-harness.ts](../server/scripts/packet-f-harness.ts), [restore-database.ts](../server/scripts/restore-database.ts) `--isolated` + `RESTORE_DATABASE_URL`. Checklist: `.unlazy/existing-harden-packet-f/RESTORE_CHECKLIST.md`.

---

## Manual gates (code se “done” nahi)

| Gate | Proof |
|---|---|
| Naya phone reply | Current deploy ke baad **naya** inbound; Inbox + webhook health counter |
| Connect → send → template → campaign | Test account, existing OAuth (ES v4 nahi) |
| Restore other host | Isolated DB, sample tenant/number rows |
| GO / NO-GO | 8 must-tick. Fail = customer nahi |

---

## 15-din box → packet

| Roadmap box | Packet |
|---|---|
| Campaign error test | A |
| GST / Autopay / Full backup / Studio jhoot | A |
| App ID/Secret | A |
| Org/number mix quick check | B (+ existing isolation tests) |
| Webhook save pehle | C |
| Crash replay inbound | C |
| Double-click 2 messages nahi | D |
| Agent URL bypass | B |
| `+91` / `91` | E |
| 1 org × 1000 | F |
| API/Redis restart no dup | D + F |
| Backup restore | F + Manual |
| Naya phone reply | Manual |
| Test-account flow | Manual |
| GO/NO-GO | Manual |

---

## 8 must-tick → kaise prove

| Must-tick | Proof |
|---|---|
| Doosre org ka data nahi | B tests + isolation audit script `db:audit-number-isolation` |
| Number mix nahi | B + socket payload `whatsappNumberId` review [realtime.ts](../server/src/realtime.ts) |
| Inbound lost nahi | C tests + Manual phone |
| Duplicate send nahi | D tests + F harness |
| 1000 numbers likhe | F evidence file (1000/1000/0) |
| Restore chala | F isolated rehearsal transcript; other-host still Manual |
| Naya phone reply | Manual |
| Jhoot nahi | A grep/tests |

---

## Pehle kaun sa packet code kare

1. **A** — done  
2. **E** — done (with A)  
3. **B** — done  
4. **D** — done  
5. **C** — done  
6. **F** — done  
7. **Manual** — F ke baad live ← next

Unlazy: har packet apna `GATES.md` jab code start ho. Abhi sirf yeh plan ledger.
