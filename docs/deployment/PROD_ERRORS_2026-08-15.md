# Production error investigation — 2026-08-15

Read-only. No code edits, no PM2 restarts, no `.env` changes, no git writes except this notes file.

**Fix applied later the same day:** see `docs/deployment/PROD_FIX_2026-08-15.md` (Meta app webhook was pointing at a dead ngrok URL; outbound agent SDP was invalid). This file remains the investigation snapshot.

Collected **2026-08-15 ~13:51–13:56 UTC** (19:21–19:26 IST). Window: **2026-08-15 00:00 IST = 2026-08-14 18:30 UTC** through collection time. Calendar date in IST was still **15 Aug 2026** (not 16). VM clock is **UTC**.

| Item | Value |
|------|--------|
| Live | `https://app.samyoj.com` |
| VM | `samyoj-server` / `asia-south1-c` / project `project-cf2ff302-9e0b-42b0-a1b` |
| App | `/home/samyoj/Samyoj` as `samyoj` |
| Git | `call-ui-improvemnet` @ **`92e2605`** (matches expected) |
| `META_WEBHOOK_URL` host | **`app.samyoj.com`** path `/api/whatsapp/webhook` — **not** ngrok, **not** localhost |
| PM2 | `whatsapp-api` **online** 18h, pid 1693008, **0 unstable restarts**. No `whatsapp-worker` (deleted at deploy; workers embedded). Restart count **8** is historical (Aug 8 SIGINT deploys), not crashes today. |

---

## Executive (broken right now?)

| Area | Broken now? | Evidence |
|------|-------------|----------|
| **Inbound webhook** | **Likely yes (delivery), not yes (endpoint)** | Public/local health: `webhookConfigured: true`, challenge with real token succeeded. **Zero** `POST /api/whatsapp/webhook` in nginx from ~13 Aug onward. In-memory `totalReceived/Queued/Processed/Failed: 0`, `lastReceivedAt: null`. DB `provider_webhook_events` empty. Last inbound processed on this VM: **2026-08-10T18:21:53Z**. |
| **AI chat bot** | **Not proven broken as a runtime crash** | No `generateBotReply` / Sarvam chat / embeddings / `NO_KB` errors today. Bot never ran today because **no inbound**. The thread they used today has **`bot_active = false`** (would skip even if a reply arrived). `GET /api/ai-bot` returned 200. |
| **AI voice** | **Outbound agent call failed today; AI inbound voice not exercised** | Sarvam pre-warmed at startup. Today’s failure is **agent outbound** (`handler=AGENT`), Meta Graph **SDP validation error** → HTTP **502**. Last **USER_INITIATED / AI** calls were **2026-08-08/09**, before this deploy. No `calls` webhook POSTs today. |
| **Inbox realtime** | **No** (server-side) | Socket.IO `101` websocket + `200` polling. Inbox list/messages/start/send **200/201**. No socket errors in API logs. **Browser console cannot be collected from the server.** |

**App process health:** `GET /health` local + public: `api/database/redis ok`, `workersStarted: true`. Postgres 17 and Redis are **native systemd** (not Docker); both accepting connections. Nginx `error.log` empty today.

---

## Timeline (UTC and IST)

| UTC | IST | What |
|-----|-----|------|
| 2026-08-10T18:21:53Z | 11 Aug 00:51 IST | **Last inbound WhatsApp message processed** on this VM (`Processing inbound message`). Same conversation: `AI bot skipped for conversation` (`botActive: true`, `botHandoffAt: 2026-08-08T18:24:28.068Z`). |
| 2026-08-14T18:47:22Z | 15 Aug 00:17 IST | `Failed to poll conversation analytics` (daily Graph field syntax; also 10–13 Aug). WhatsApp number `updated_at` matches. Worker process still existed. |
| 2026-08-14T19:11:41Z | 15 Aug 00:41 IST | Pre-deploy probe: `Webhook verification token mismatch` — `GET .../webhook?hub.verify_token=wrong` **403**. Expected. |
| 2026-08-14T19:36:43Z | 15 Aug 01:06 IST | **Deploy restart.** `pm2 delete whatsapp-worker`; `whatsapp-api` online. Startup: SMTP unset, Google OAuth unset, workers started, `API server started`, `WebSocket server ready`, `Sarvam voice model pre-warmed`. |
| 2026-08-14T19:37:14Z | 15 Aug 01:07 IST | Deploy probe: wrong-token challenge **403** again. |
| 2026-08-14T19:37:15Z | 15 Aug 01:07 IST | **`Webhook verified successfully — returning challenge`** (real token). Endpoint works. |
| 2026-08-14T19:41:51Z | 15 Aug 01:11 IST | User session: `Invalid or expired token` **401** then `POST /api/auth/refresh` **200**. |
| 2026-08-14T19:41:52Z | 15 Aug 01:11 IST | `WhatsApp OAuth URL issued`. `GET /api/whatsapp/connect-url` 200. **No OAuth callback** hit nginx afterward. |
| 2026-08-15T06:13:01Z | 15 Aug 11:43 IST | User login 200. Connect URL issued again. Inbox + `GET /api/ai-bot` 200. Webhook health/status polled. |
| 2026-08-15T06:13:54Z | 15 Aug 11:43 IST | `POST /api/inbox/start` **201** (new/upserted thread). |
| 2026-08-15T06:14:03Z | 15 Aug 11:44 IST | `POST /api/inbox/.../messages` **201** — **outbound send succeeded**. |
| 2026-08-15T06:15:30Z | 15 Aug 11:45 IST | `Call permission request sent` (`POST /api/calling/permission/request` 200). |
| 2026-08-15T06:16:17Z | 15 Aug 11:46 IST | **Only application error today:** Meta call `connect` rejected — SDP invalid → `POST /api/calling/callback` **502**. Call row left `BUSINESS_INITIATED / CONNECTING / AGENT`. |
| 2026-08-15T06:17:21Z | 15 Aug 11:47 IST | Connect URL issued a third time. Still **no** `/settings/whatsapp/callback` in nginx. |
| 2026-08-15T07:57–08:07Z | 15 Aug 13:27–13:37 IST | Internet scanners: `/api/.env`, GraphQL, etc. **404**. Not product traffic. |
| 2026-08-15T13:51Z | 15 Aug 19:21 IST | This investigation. Health still ok; webhook counters still all zeros. |

No further API winston lines after 08:07Z until our health curls (HTTP 2xx are mostly not written to the PM2 JSON log).

---

## Exact error messages (quoted)

### Application (PM2 `whatsapp-api-out-0.log`) — only `level=error` in window

```
Meta call action failed
```

Meta Graph body (secrets redacted; `to` is a contact MSISDN, omitted):

```
"error": {
  "code": 138008,
  "error_subcode": 2593093,
  "error_user_msg": "Provided SDP is invalid",
  "error_user_title": "SDP validation error",
  "fbtrace_id": "AYKqPo778nN-w3RnNkEGKAf",
  "is_transient": false,
  "message": "SDP Validation error",
  "type": "OAuthException",
  "error_data": { "details": "", "messaging_product": "whatsapp" }
}
"action": "connect",
"module": "meta-calling",
"status": 400
```

Then:

```
[API] Provided SDP is invalid
```

```
AppError: Provided SDP is invalid
    at parseMetaGraphError (/home/samyoj/Samyoj/server/src/modules/calling/meta-calling.service.ts:58:10)
    at Function.callAction (/home/samyoj/Samyoj/server/src/modules/calling/meta-calling.service.ts:117:13)
    at async Function.initiateOutboundCall (/home/samyoj/Samyoj/server/src/modules/calling/meta-calling.service.ts:132:24)
    at async <anonymous> (/home/samyoj/Samyoj/server/src/modules/calling/routes.ts:629:24)
```

```
POST /api/calling/callback 502 2676ms
```

Nginx matches: `2026-08-15T06:16:17+00:00 POST 502 /api/calling/callback` — **only 5xx in the window**.

### Webhook (warn, not inbound POST failures)

```
Webhook verification token mismatch
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=ping 403
```

Twice: 19:11:41Z (pre-deploy) and 19:37:14Z (post-deploy). These are **intentional wrong-token probes** from the deploy checklist, not Meta.

Success immediately after the second probe:

```
Webhook verified successfully — returning challenge
```

**No** `Invalid signature` / signature-fail lines in the entire PM2 out log. **No** `POST /api/whatsapp/webhook` in nginx `access.log`, `access.log.1`, or `access.log.2.gz`.

### Pre-existing daily warn (not a user-facing webhook outage)

```
Failed to poll conversation analytics
Error: Syntax error "Expected ")", got end of string" at character 44: conversation_analytics.data(start=1786579200
module: billing-usage
```

Same shape 2026-08-10 through 2026-08-14 ~18:47Z. Code: `server/src/modules/whatsapp/meta.service.ts` `getConversationAnalytics` → `/${wabaId}?fields=conversation_analytics.data(${params})` with a `URLSearchParams` string Graph does not accept.

### Startup warns (known, unchanged `.env`)

```
Config: SMTP_HOST is not set — password reset and email verification will only log emails
Config: Google OAuth not configured — Continue with Google will be unavailable
```

### Session warn (recovered)

```
[API] Invalid or expired token
```

Followed by successful refresh + `/api/auth/me` 200.

### Historical inbound (10 Aug, not today) — AI skip + duplicate retry

```
AI bot skipped for conversation
botActive: true
botHandoffAt: 2026-08-08T18:24:28.068Z
module: automation-engine
```

```
Unique constraint failed on the fields: (`meta_message_id`)
Duplicate inbound message skipped (Meta retry)
```

### Infra noise (not Samyoj app)

- GCP Ops Agent `otelopscol`: `Permission 'logging.logEntries.create' denied` (IAM on Cloud Logging). Continuous; unrelated to WhatsApp.
- `sshd` `kex_exchange_identification: Connection reset by peer` (internet scanners).
- Nginx `error.log.1` (11 Aug only): SSL keepalive `bad record type` from a random client.
- Scanner 404s on `/api/.env`, `/graphql`, etc.

PM2 **error** files (`whatsapp-api-error-0.log`) are **0 bytes** — JSON goes to stdout.

---

## Likely root causes (ranked)

1. **Meta is not delivering inbound webhook POSTs to this host (config/subscription/traffic), not a down API.**  
   Challenge GET works; outbound Graph works (`inbox/.../messages` 201, call-permission 200). Nginx has **zero** POSTs to `/api/whatsapp/webhook` across retained access logs (~13–15 Aug). Last successful inbound processing **2026-08-10**. In-memory counters reset at deploy and stayed at 0. `provider_webhook_events` (migration `20260814220000_webhook_durability`) has **0 rows**. This **predates** the 14/15 Aug deploy by ~4 days unless nobody messaged; it is **not** explained by ngrok (prod URL host is `app.samyoj.com`). Cannot see Meta Developer Console from the VM.

2. **Today’s calling failure = Meta rejected the browser WebRTC SDP offer on `calls` `connect`.**  
   Stack: `calling/routes.ts` `POST /callback` → `MetaCallingService.initiateOutboundCall` → Graph `POST /{phoneNumberId}/calls`. Branch shipped is `call-ui-improvemnet`. Comment in `routes.ts` says agent outbound must use **browser** SDP, not a server bridge. Graph `138008` / `2593093` “Provided SDP is invalid” is Meta saying the SDP is malformed/incompatible — **env/token look fine** (permission request succeeded seconds earlier). Could be new client SDP, browser WebRTC, or Meta Cloud Calling SDP rules. **Not** Sarvam STT/TTS (those never ran on this attempt; handler was `AGENT`).

3. **AI chat would not have answered today’s thread even if inbound worked.**  
   Newest conversation (`last_message_at` 2026-08-15 06:13:59 UTC) has **`bot_active = false`**. `queueAiBotProcessing` in `server/src/modules/automation/engine.ts` returns `AI bot skipped for conversation` when `!botActive`. Org still has **8 enabled** `ai_bots`. No chatbot/embeddings/handoff/`NO_KB` lines today because the inbound path never ran.

4. **Webhook health `totalReceived: 0` after deploy is a counter reset plus (1), not a new signature bug.** Public JSON correctly omits `webhookUrl` / `lastError`. User polling `/api/whatsapp/webhook-status` + `/health` around 11:43–11:47 IST matches “webhook errors” in the UI without any failed Meta POST.

5. **Conversation analytics poll** is a **pre-existing Graph query bug** in `meta.service.ts` / `billing/usage.service.ts`. Daily warn. Does not block inbox or calling.

---

## What is NOT the problem

- **Wrong git SHA** — VM is `92e2605`.
- **ngrok / localhost webhook URL** in production `.env`.
- **API / Postgres / Redis down** — `/health` ok. Native `postgresql@17-main` and `redis-server` active. **Docker is not used** on this VM (no `docker` binary); that is normal here, not an outage.
- **Missing PM2 `whatsapp-worker`** — deleted on purpose; `Workers started` inside the API; Redis Bull `webhook-queue` `failed=0`, `wait=0`, `completed=74` (historical).
- **Webhook signature verification failures** — none in logs.
- **Broken challenge endpoint** — real-token GET succeeded 19:37:15Z.
- **Outbound WhatsApp send** — 201 today.
- **Inbox HTTP / Socket.IO server errors** — none.
- **Sarvam “not configured” / 401/403 Graph on messaging** — not present today. Calling Graph error is SDP (`OAuthException` type name, not an app-secret 401).
- **SMTP / Google login** — startup warns only; email verification is already disabled in this build.
- **Scanner 404/401** on `/api/config`, `/graphql`, `/.env`.
- **GCP Ops Agent Cloud Logging IAM** — does not affect the app.
- **Frontend bundle missing** — `/` 200, `assets/index-BJPYrl-b.js` served (same hash as deploy log).

**Frontend console:** cannot be collected from the VM except via nginx (status codes only). No browser CDP in this investigation.

---

## Health snapshots (collection time)

Public `GET https://app.samyoj.com/health`:

```json
{"status":"ok","checks":{"api":"ok","database":"ok","redis":"ok"},"workersStarted":true,"version":"1.0.0"}
```

Public `GET https://app.samyoj.com/api/whatsapp/webhook/health`:

```json
{"success":true,"data":{"totalReceived":0,"totalQueued":0,"totalProcessed":0,"totalFailed":0,"totalErrors":0,"lastReceivedAt":null,"queueDepth":0,"webhookConfigured":true,"verifyTokenConfigured":true,"appSecretConfigured":true}}
```

Localhost `:8000` identical. No `webhookUrl` / `lastError` / `lastFbTraceId` (expected after this SHA).

Redis Bull (names only): all queues `wait=0 active=0 delayed=0 failed=0`. `webhook-queue` completed=74.

DB (PII omitted): 1 active WhatsApp number; 4 conversations (newest `bot_active=false`); 22 inbound / 15 outbound messages all-time; **0 inbound since 2026-08-10**; 1 outbound message **2026-08-15**; 1 call today stuck `CONNECTING`.

---

## Optional follow-ups (logs incomplete for Meta-side proof)

No patch. If a next session continues:

1. **New phone → business-number text** while tailing nginx for `POST /api/whatsapp/webhook`. If still absent, check Meta Developer Console / WABA webhook subscription URL and `messages` (+ `calls`) fields — that UI is not on the VM.
2. **Browser console + WebRTC SDP** on the calling page at the moment of `POST /api/calling/callback` (server only has Meta’s reject; not the SDP).
3. Confirm whether the user **completed** Facebook OAuth after the three `WhatsApp OAuth URL issued` events (no `/settings/whatsapp/callback` in nginx) — reconnect was started, not finished.

---

## Collection notes

- PM2 JSON window: 481 lines; levels warn 463 / info 15 / error **3** (the SDP triplet).
- No `/home/samyoj/Samyoj/.run/logs/` (prod does not use the Codespace tunnel logger).
- `journalctl -u pm2-samyoj` empty (PM2 is user `samyoj`, not that unit’s stdout).
- Secrets not copied: tokens, `DATABASE_URL`, App Secret, phone numbers, access tokens.
