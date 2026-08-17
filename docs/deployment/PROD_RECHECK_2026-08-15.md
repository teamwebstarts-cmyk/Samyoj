# Production recheck — 2026-08-15 (evening)

Live: `https://app.samyoj.com`. VM `samyoj-server` / `asia-south1-c`. App `/home/samyoj/Samyoj` as `samyoj`.

Internal testing deploy of this build. **Not** a claim that customer production is complete.

## What we rechecked

| Check | Result |
|-------|--------|
| `GET /health` local + public | `api/database/redis ok`, `workersStarted: true` |
| Public challenge `ping` | **200** `ping` (localhost and `https://app.samyoj.com`) |
| `GET /api/whatsapp/webhook/health` | `webhookConfigured: true`; durable counters survive PM2 restart. Latest inbound POST `lastReceivedAt` around **2026-08-15T15:09:51Z** |
| Nginx Meta POSTs | `facebookexternalua` **200** at **14:34:40Z**, **15:03:42Z**, and **15:09:51Z** (status ticks — delivery path is live) |
| Meta **app** callback | `https://app.samyoj.com/api/whatsapp/webhook` (host **app.samyoj.com** only — not ngrok) |
| Subscribed fields | includes **`messages`** and **`calls`** |
| WABA `override_callback_uri` | pinned to `app.samyoj.com` (`setup-webhook` success) |
| PM2 | `whatsapp-api` **online** only. No `whatsapp-worker`. Embedded queues including `automation-queue` + `webhook-queue` |
| Sarvam | API key present; voice model pre-warmed at API start |
| Org calling (Student) | `ai_only`, `aiAutoAnswer: true`, `defaultBotId` set, STT language no longer `unknown` |
| Frontend | `assets/index-BUIMjAXK.js` — hard-refresh required |
| `nginx -t` | syntax ok (existing harmless `:80` `server_name` warning) |
| Production `.env` | **unchanged**. Webhook host `app.samyoj.com`. Local `.env` was **not** copied |
| Production Postgres | **not wiped**. Counts unchanged: 9 orgs, 4 contacts, 37 messages, 1 WhatsApp number |

## User symptoms — what was actually wrong / what we fixed

### 1. Call the AI → phone keeps ringing

Webhook delivery was the first outage (Meta app callback had been ngrok). That is now `app.samyoj.com` with `calls` subscribed.

Code gap after that: inbound **accept** SDP was still the weak path. Node WebRTC `addTrack` before `setRemoteDescription` can emit a **second audio m-line**; answers also used `a=setup:actpass` and `ice-options:trickle`. Meta then rejects accept (`138008` / invalid SDP) and WhatsApp keeps ringing.

**Fix:** set Meta offer first, attach send track onto that transceiver, sanitize inbound **accept/pre_accept** the same way as outbound (`SHA-256`, single audio m-line, `a=setup:active`, drop trickle / mDNS / TCP / IPv6 ICE). Process `calls` webhooks **inline** (do not wait for the message worker). Duplicate connect is locked + ignored if an AI session is already running.

### 2. Chat: AI does not reply

The Nirbhay/test thread had `bot_active = false` (and historically `botHandoffAt` set while `botActive` was still true). `queueAiBotProcessing` skipped on **either** flag.

**Fix:** `bot_active` is the pause switch. Stale `botHandoffAt` no longer skips AI when the bot is on. Turning the bot on in Inbox also clears handoff. Student org threads with **no human assignee** were re-enabled (`bot_active=true`, `bot_handoff_at` cleared), including conversation `c15382a7-…`. Human-assigned live chats were not present; none were disabled.

Automation worker runs **inside** `whatsapp-api` (`automation-queue`).

### 3. Inbox not updating / inbound not showing

Root cause was Meta not POSTing (ngrok callback), not a broken Inbox UI. Socket.IO `message:new` emit is unchanged and workers are in-process. After a **new** phone text, Inbox should show it; health `totalReceived` should increment.

Durable health counters live in Redis so a restart no longer shows `totalReceived: 0` / `lastReceivedAt: null`.

## Old junk removed (safe)

- Deleted leftover `server/.env.bak-*` (four Aug 8 backups). **Live `.env` kept.**
- Did **not** flush Redis (a campaign is `SCHEDULED`).
- Did **not** truncate PM2 logs (disk 55%, ~4 GB free — no pressure).
- Did **not** drop/wipe Postgres.

## Error tracking

- Sentry: existing `server/src/config/sentry.ts`. `SENTRY_DSN` is **unset** — no DSN invented.
- Durable ops log: `/home/samyoj/Samyoj/.run/logs/ops-errors.log` (error-level JSON).
- `provider_webhook_events` receipt row on every Meta POST (`receipt:<requestId>`).
- Tenant `GET /api/ops/recent-errors` is **removed** (404). Platform operators use `GET /api/platform/errors`.
- Runbook: `docs/ops/SERVER_HEALTH.md`.

## Remaining risks

- Inbound **text** and **voice** are not fully proven until you send a **new** WhatsApp message and **call** the business number. Nginx POSTs so far today were **status** events, not a new inbound text or `calls` connect.
- Socket membership is still connect-time (reconnect if Inbox looks stale).
- Auth tokens still in `localStorage`. Customer production pipeline still **no**.
- One campaign is `SCHEDULED` — Redis was not flushed.
- Live WebRTC agent transfer is still not production-ready (`message_only`).

## What you must test

1. Hard-refresh `https://app.samyoj.com` (bundle `index-BUIMjAXK.js`).
2. Send a **new** WhatsApp **text** to the business number (not only an old handed-off thread if you can start a new chat). Inbox should show it; the bot should reply.
3. **Call** the business WhatsApp number. The AI should answer (not ring forever). Talk after pickup (Sarvam STT/TTS).

We cannot place that phone call from the VM. The accept path is now the one Meta requires.
