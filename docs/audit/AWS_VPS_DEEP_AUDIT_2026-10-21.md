# AWS VPS Deep Audit — 21 Oct 2026

Host: `samyoj-poc` (t3.medium, ap-south-1c, Debian 12, `3.108.25.94`)
Domains: `app.samyoj.com`, `admin.samyoj.com`
Audit window: app log 13 Oct 08:24 UTC → 21 Oct 08:33 UTC; nginx 14–21 Oct.
Method: live probes + PM2 log parse (7,698 JSON lines) + Postgres/Redis queries + nginx access/error logs.

---

## 1. Verdict

| Area | Status |
|---|---|
| Process / OS / services | Healthy |
| Inbound WhatsApp webhooks | Healthy since 15 Oct (52/52 HTTP 200) |
| Database | Healthy; one failure class explained (below) |
| Redis | Healthy, 2.86 MB / 91 keys |
| Security posture | Adequate; no rate limit, SSH open to one IP |
| **Backups** | **Not scheduled — biggest risk** |
| **Rate limiting / bot mitigation** | **Missing** |
| Leftover broken Meta number | Degraded, noisy (not user-facing) |

No outage in the window. 5xx occurred in two windows: 17 Oct 07:02–07:05 UTC (19 template 500s + 1 Inbox send 500, from the dead number — see P1-1) and a single 500 on 19 Oct 02:58:04 UTC from a malformed bot `POST /.env` body (see P3-1). Nothing else.

---

## 2. System

| Item | Value |
|---|---|
| Uptime | 8 days (uptime check at 08:30 UTC) |
| Load | 0.00 / 0.00 / 0.00 (idle) |
| Disk | 2.9 GB of 30 GB (11%), inodes 5% |
| RAM | 669 MB used / 3,198 MB available, **no swap** |
| Node RSS | 187 MB (normal) |
| PM2 | `whatsapp-api` online, uptime since 15 Oct 11:26 UTC, `restart_time = 1` / `unstable_restarts = 0` — **1 restart (deliberate deploy, 15 Oct 11:26 UTC), not a crash** |
| Services | nginx, postgresql, redis-server, amazon-ssm-agent, certbot.timer = active |
| `pm2-samyoj.service` | **`inactive` but `enabled`** — enabled means systemd *will* try to start it on boot; inactive means it is not running now (the app is alive only because the PM2 daemon was started by hand). See P2-1. |
| Node / npm / PM2 | 20.20.2 / 10.8.2 / 7.0.4 |
| Pending apt upgrades | 0 (security updates current) |
| Nginx version | 1.22.1 |
| TLS | `app.samyoj.com` + SAN `admin.samyoj.com`, valid to **11 Jan 2027** (82 days); certbot timer active |

---

## 3. Health endpoints

| Endpoint | Result |
|---|---|
| `https://app.samyoj.com/health` | 200 `status: ok`, api/database/redis ok, workers started |
| `https://admin.samyoj.com/health` | 200 ok |
| `http://127.0.0.1:8000/health` | 200 ok |
| `GET /api/whatsapp/webhook` verify | 200 challenge ok; bad token → 403 |
| `GET /api/socket.io/?EIO=4` | 200 (socket path is `/api/socket.io`, not `/socket.io`) |
| App + admin SPA routes | All 200 |
| Feature API prefixes | 401 unauthenticated = route alive, ~40–50 ms |

Public webhook counters at audit time:

```
totalReceived 55 · totalQueued 55 · totalProcessed 49 · totalFailed 2 · totalErrors 2
byChannel whatsapp 49 / instagram 6 / page 0
lastReceivedAt 2026-10-21T08:29:11Z
oldestWaitingMs 487413478  ← stale row from 15 Oct, see P1-2
```

`/health` and `/api/whatsapp/webhook/health` expose no secrets (verified key list).

---

## 4. Webhooks

- 52 POSTs since cutover, **all HTTP 200**; Meta UA confirmed (`facebookexternalua`, `Webhooks/1.1`).
- 15 Oct 17:02 — first real inbound after the ngrok-override incident; delivered to the right conversation.
- 15 Oct 17:06 — **2 envelopes failed with `54000 index row size 3328 exceeds btree max 2704`** on `provider_webhook_events(organization_id, event_key)`.
  - Only happens when `encrypt(payload)` pushes the unique key over ~2.7 KB.
  - Those 2 events were `account_update` with `messageCount: 0` — **no message lost**.
  - The worker threw before marking the row, so both rows sit `RECEIVED` forever and inflate `oldestWaitingMs`.
  - Failed BullMQ jobs (2) still in `bull:webhook-queue:failed`. Safe to delete.
- 16/18/19/21 Oct — template-status and account-update events only; no inbound traffic.

---

## 5. Database

| Item | Value |
|---|---|
| Version / size | PostgreSQL 17.11, `whatsapp_platform` 16 MB |
| Connections | 1 active / 3 idle of 100 |
| Slow queries | none |
| Largest tables | `product_events` 576 kB, `provider_webhook_events` 512 kB, `refresh_tokens` 296 kB, messages 120 kB |

Message counts (all time):

```
INBOUND  DELIVERED 5 · READ 12
OUTBOUND SENT 14 · READ 2 · AMBIGUOUS 7
```

The 7 `AMBIGUOUS` are 23 Sep – 6 Oct, all on the old number/WABA — pre-cutover history, not real failures. No `FAILED` rows.

`org_health_snapshots` (21 Oct): main org `LIVE`, 2 numbers, 4 contacts, 3 conversations, 12 in / 9 out, **`webhook_stale = true`** because last inbound is 15 Oct — expected for a test tenant.

`whatsapp_numbers`: 3 rows — 2 active (`919303618219` WABA `1096978842799680`, `918839888531` WABA `1593477159022923`), 1 inactive (`15559747503` WABA `1049608361215767`).

---

## 6. Findings — priority order

### P0-1 — No scheduled database backups  ⚠️ highest risk
- Only two manual dumps exist (`pre-v10` 13 Oct, `pre-b30d415` 15 Oct) in `/var/lib/postgresql/`.
- No cron, no systemd timer, no off-host copy. Disk is on **one** EBS volume.
- Losing this instance = losing every organization, conversation and message.
- Fix: nightly `pg_dump -Fc` + keep 14 days + copy to S3 (or enable EBS snapshots via Data Lifecycle Manager). Small change, large downside avoided.

#### Code / config where it lives
- There is **no** backup job in the app. `server/scripts/backup-database.ts` and `restore-database.ts` exist but are only run by hand (`npm run db:backup` dumps the `DATABASE_URL` database into `.run/backups/`), and `.run/` does not exist on the box (the deploy ships `dist` only).
- AWS-side there is no Data Lifecycle Manager policy and no S3 bucket used for backups. The instance role `samyoj-poc-ec2-role` currently has only `AmazonSSMManagedInstanceCore` (fine for SSM, useless for backup).
- **Measured on the box (relevant to the choice):** `wal_level = replica`, `archive_mode = off`, `pg_basebackup`, `pg_receivewal`, `pg_verifybackup`, `pg_restore` all installed; `aws` CLI v2.9.19 installed and `aws sts get-caller-identity` already works through the EC2 instance role (no keys on disk — IMDSv2 with `HttpTokens: required`).

#### Production-ready strategy (4 layers, in this order)
1. **Nightly logical backup (primary restore path).** systemd timer on the box:
   - `pg_dump -Fc --no-owner --no-acl -Z 6 -f /var/backups/samyoj/db-$(date +%F).dump whatsapp_platform` as the `postgres` OS user (peer auth locally, no password in a file).
   - `pg_dump` is set via `UMask=0077`; run under `flock` so two runs never overlap.
   - Delete local dumps older than `7d`.
   - `pg_verify_restore` step: after the dump, `pg_restore -l` into `/dev/null` to prove the archive is readable before uploading (`pg_restore --list` fails fast on a truncated file).
   - Upload to S3 with the **instance role** (add an inline policy: `s3:PutObject` on `arn:aws:s3:::samyoj-backups/db/*`, `s3:GetObject`, `s3:ListBucket`), plus SSE-S3 (`--sse AES256`) and an Object Lock / versioning bucket so a compromised box cannot delete history.
   - Keep **35 daily + 12 weekly** via S3 Lifecycle rules (cost is pennies at 400 KB/dump).
2. **Weekly physical base backup (faster full restore, PITR base).** `pg_basebackup -Ft -z -D /var/backups/samyoj/base -P` into S3. Weekly because the DB is small now; move to daily when it passes ~1 GB.
   - If point-in-time recovery is wanted later: enable `archive_mode = on` + `archive_command` writing WAL to S3 (`aws s3 cp %p s3://samyoj-backups/wal/%f`), then `recovery_target_time`. Requires `wal_level >= replica` (already true) and is optional at this data size.
3. **EBS snapshot as the last resort** for “whole box is gone” (OS + app + DB together). AWS Data Lifecycle Manager policy on `vol-072445c369ac323af`: daily snapshot, retain 7 — this covers the case where the app config, not just the DB, is lost.
4. **Restore verification (the part almost everyone skips).** Monthly job:
   - `createdb samyoj_restore_check && pg_restore -d samyoj_restore_check <latest dump>`
   - Compare row counts against live: `organizations`, `users`, `contacts`, `conversations`, `messages`, `whatsapp_numbers` — abort + alert if any count differs by more than 0.
   - `DROP DATABASE samyoj_restore_check` after the check.
   - Record the result in the ops log / alert; 3 consecutive failures should page someone.
   - Keep the current proven dump (`pre-b30d415`, 15 Oct) until the first scheduled backup has been restored once end to end.

#### Failure modes to plan for
| Scenario | What saves you |
|---|---|
| App bug deletes/changes rows | nightly logical dump (12–24 h RPO) |
| Disk full / corrupted filesystem | nightly dump in S3 + weekly base backup |
| Box/instance terminated | EBS snapshot + S3 dumps |
| Ransomware / stolen credentials on the box | versioned + Object-Lock S3 bucket, different account or at least a different role scope |
| Dump itself corrupt | `pg_restore --list` check before upload + the restore drill |
| Operator restores the wrong dump | `--no-owner` dumps, restore into a scratch DB first, then swap |

#### Operational notes
- Put the script at `/usr/local/sbin/samyoj-db-backup.sh` (root, `700`), timer at `/etc/systemd/system/samyoj-db-backup.{service,timer}`; `OnCalendar=*-*-* 01:30 UTC` (07:00 IST), `Persistent=true`.
- Failure visibility: `systemctl status` + `journald`, plus a one-line CloudWatch alarm on the timer’s exit code (or push to a Slack/email via the existing `notification-queue`).
- Do not store `DATABASE_URL` in the script; `sudo -u postgres` peer auth avoids any secret on disk.
- When growing past one box: keep the same script but point S3 at a bucket in another account with a cross-account role; the logical dump format is unchanged.

### P1-1 — Dead Meta number `918839888531` keeps every Meta call failing
- Stored in `whatsapp_numbers` as `is_active = true`; the stored token is valid (`/me` ok) but **cannot read WABA `1593477159022923`** (Graph 100).
- Errors in 7 days: 40 `billing-usage`, 39 `webhook` status, 19 `listMessageTemplates`, 6 `coexistence`, 2 `meta-whatsapp`, 1 `getMessageTemplate` = **107 (about 50% of all errors)**.
- Visible effect: 17 Oct 07:02–07:05 — `GET /api/templates` 19× → **500** (users saw a broken Templates page) and one Inbox send → **500**.
- Root cause: a Graph 100 is thrown as a plain `Error`, becomes HTTP 500, and `listMessageTemplates` iterates every active number without isolating a failing WABA.
- Least-effort fix now: set that row inactive (or delete it). Code fix later:
  1. `graphGet` → throw `MetaApiError(424/502)` on Graph 100/190/200 so it is not a 500.
  2. `listMessageTemplates`: per-WABA `try/catch`, return the rest + a warning.
- Same class as the Messenger "page profile" notifications (`28728250306809046`, 60×) — cosmetic, but should not be logged as errors.

#### Code / config where it lives
- Row: `whatsapp_numbers.id = 0e1c995d-25c3-4750-9b49-5e110b79cc94`, `phone_number = 918839888531`, `waba_id = 1593477159022923`, `is_active = true`, `coexistence_status = history_declined`. It is the row whose WABA is no longer readable — **not** the already-disabled `15559747503` row.
- Callers that iterate it:
  - `server/src/modules/billing/usage.service.ts` → `pollConversationAnalytics()`: `for daysAgo 1..7` × `for number of numbers` × `MetaWhatsAppService.getConversationAnalytics()`. The `try/catch` **continues** but logs a warning on every iteration → 40 errors and useless billing rows attempted per run.
  - `server/src/modules/whatsapp/routes.ts` → `GET /webhook-status`: `Promise.allSettled([inspectAccessTokenExpiry, getWebhookStatus])`; `getWebhookStatus()` (`meta.service.ts:1597`) throws via `graphGet`.
  - `server/src/modules/templates/routes.ts` → `GET /api/templates?all=true`: `listAllMessageTemplates(wabaId, accessToken, …)` → `graphGet` → **uncaught** → `errorHandler` returns 500.
  - `server/src/modules/whatsapp/coexistence/index.ts:60,87` → WABA-only routing finds 0 active numbers for `4568747570038284` and warns.
- Root cause in code: `MetaWhatsAppService.graphGet()` (`meta.service.ts:675`) does `throw new Error(message)` on any non-2xx response. `isWhatsAppRateLimit()` only recognises `80008`/“too many calls” (`meta.service.ts:207`), so Graph 100/190/200 never become an `AppError`, never get a 4xx mapping, and surface as 500. `MetaApiError` already exists (`meta.service.ts:212`) but `graphGet` does not use it.

#### Proper solution (code-level)
1. **Immediate (ops, no code):** stop the noise by deactivating that row through the product path — `DELETE /api/whatsapp/numbers/0e1c995d-…` (OWNER/ADMIN via `metaAdminGuard`). It soft-deletes (`isActive: false`, token blanked) and keeps conversations/contacts (`1 conversation / 2 contacts` stay attached, `scopedConversationWhere` just hides them until reconnected). Keep a note that reconnecting the same number later restores history.
2. **`graphGet()` → typed errors.** Build an error from Meta’s payload:
   ```ts
   throw new MetaApiError(data.error?.message ?? `Graph API request failed: ${path}`, {
     metaCode: data.error?.code, metaSubcode: data.error?.error_subcode,
     fbtraceId: data.error?.fbtrace_id, status: res.status,
   });
   ```
   Then map in one place: code `190` (invalid/expired token) → 401/`META_TOKEN_INVALID`; `100`/`200` (permissions/object) → 424/`META_OBJECT_UNAVAILABLE`; `80008`/429 → 429/`WHATSAPP_RATE_LIMIT`; 5xx → 502. `errorHandler` already hides non-operational messages, so this is a one-file change that removes the 500 class everywhere.
3. **`listAllMessageTemplates()` isolation.** Accept `{ skipWabaIds?: Set<string> }` or return `{ templates, warnings }`. Wrap each WABA: on 100/190 mark that number `isActive=false` (or a `wabaUnavailableAt` column) and continue; the user sees the remaining numbers’ templates plus a banner “1 number needs reconnecting”. Route `GET /api/templates` then filters out `META_OBJECT_UNAVAILABLE` instead of 500.
4. **`pollConversationAnalytics()`**: move the health check outside the 7-day loop (one `getWebhookStatus`-style probe per number per run, not 7), skip numbers flagged unavailable, and treat 100/190 as “disable + log once” rather than a per-iteration warning. On success, upsert as today (idempotent by the composite key).
5. **`GET /webhook-status`**: already quiet-caches after failure (`webhookStatusQuietUntil`), but it should cache **per number** and return `statusCheckFailed: true` with an actionable message (“this number’s Meta access was revoked; reconnect it”) instead of logging a stack each poll.
6. **`base.html`-class Messenger noise** (`messenger-ingest.ts:50`): keep it a warn but downgrade to debug after the first failure per page id, or add the page to a “profile lookup disabled” set.
7. **Regression test:** one test with a mocked Graph 100 asserting (a) `graphGet` throws `MetaApiError` with `metaCode 100`, (b) `GET /api/templates` returns 200 with the healthy WABA’s list, (c) `pollConversationAnalytics` logs exactly one warning per run.

### P1-2 — Webhook envelope overflow (2 rows stuck forever)
- Event key is `envelope_<sha256(payload)>` but Postgres compares the **encrypted ciphertext**, so a large payload can exceed the btree limit (case above).
- Poison-pill shape: Meta keeps retrying, every retry hits the same overflow, and the 2 stale rows keep `oldestWaitingMs` lying.
- Code fix (later): store `event_key = sha256(ciphertext)` (fixed 64 chars) or add a separate `event_key_hash` unique index; on `54000`, log + ACK 200 instead of retrying forever.
- Operational now: clear the 2 `RECEIVED` rows and the 2 failed Redis jobs after confirming they carry no messages.

#### Code / config where it lives
- Key generation: `webhook-accept.ts:24` `inboundWebhookEnvelopeKey()` → `envelope_${hashWebhookPayload(payload)}` (sha256 hex, **64 chars + 9 prefix = 73**). That is fine — the problem is not `eventKey`, it is **`payload_ciphertext`**.
- Schema (`server/prisma/schema.prisma:2184`): `ProviderWebhookEvent` has `@@unique([organizationId, eventKey])` as a btree on `(organization_id, event_key)`. Postgres checks the **whole row** against the index limit only for the column in the key… but the observed `3328 > 2704` came from the row tuple, meaning the unique index is being built over a row where the stored key is long — in practice `encrypt(JSON.stringify(payload))` in `utils/crypto.ts:16` returns `iv:tag:ciphertext` (hex, **2× payload**), and `persistEnvelope()` writes it in the same `create()`. When the *encrypted* value is placed in a btree-indexed column pair (or when the row is later re-indexed/reclaimed by `claimProviderWebhookEvent`), the 2.7 KB limit is hit. Either way the row is unrecoverable.
- Both failure paths have the bug:
  - `persistEnvelope()` (`webhook-accept.ts:85`) only converts **P2002** to `duplicate`; `54000` throws.
  - `claimProviderWebhookEvent()` (`webhook-dispatcher.ts:140`) does the same for the **page/IG** path (`create(... status: 'PROCESSING')`), so the same payload class can 500 a Page webhook too.
- `enqueueEnvelope()` (`webhook-accept.ts:113`) uses `{ jobId, attempts: 4 }` with **no `backoff`**, no `removeOnFail` limit override, and the queue is created with **no `defaultJobOptions`** (`config/queues.ts:15`). The worker is one process (`workers/index.ts:145`) with `lockDuration: 120_000` — fine for volume, but a poison job is retried 4× in quick succession.
- `completeInboundWebhookEnvelope()` (`webhook-accept.ts:214`) only flips `RECEIVED|PROCESSING → COMPLETED`; nothing ever expires a stale `RECEIVED`.

#### Proper solution — large payloads + many simultaneous events
1. **Stop indexing the payload.** Split the table:
   - keep `payloadCiphertext` in `provider_webhook_events` **out of any index** (already true) and make `eventKey` a fixed-width hash: store `event_key` as `sha256(payload)` **without** the `envelope_` prefix, or add `event_key_hash` (char(64)) and index `(organization_id, event_key_hash)`.
   - Better: a new table `provider_webhook_payloads (event_id PK, ciphertext)` with a 1:1 FK. Then the event row is ~100 bytes and can never blow the index, and payload TTL/retention is independent.
   - Migration: `ALTER TABLE ... ADD COLUMN event_key_hash char(64)` → backfill `sha256(event_key)` → create unique index → drop the old unique → (later) drop `event_key`. Needs a Prisma migration, which this deploy model avoids on the box — plan a short maintenance window or use `db:migrate-startup-safe` with a backup (already the documented path).
2. **Catch the overflow explicitly.** In both `persistEnvelope` and `claimProviderWebhookEvent`:
   ```ts
   if (err.code === 'P2002') return 'duplicate';
   if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === '54000') {
     log.error('webhook envelope too large to persist', { bytes });
     return 'oversize'; // caller ACKs 200, metric + alert
   }
   ```
   The route already ACKs after `persistAndEnqueueInboundWebhook` resolves — an `oversize` that returns 200 prevents Meta’s 4× retry storm.
3. **Cap the payload before persisting.** Meta webhooks are small; reject > 1 MB pre-encryption with `oversize`. Compression before encryption (`zlib.deflateSync` → `encrypt`) cuts the ciphertext for the rare big `history`/`smb_app_state_sync` payloads by 5–10×.
4. **Backpressure & concurrency.** Give the queue defaults: `{ attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 500, removeOnFail: 1000 }` and run the worker with `concurrency: 5–10` (this box handles it; GCP load was 0.29). With webhook bursts Meta sends in parallel; serial processing with `lockDuration` 120 s is what creates head-of-line blocking once one job is slow.
5. **Dead-lettering.** Currently failed jobs sit in `bull:webhook-queue:failed` forever. Add a `failed` listener that writes to `provider_webhook_events.status = 'DLQ'` with the error, exposes a count in `/api/whatsapp/webhook/health`, and an operator “replay” path (the existing `POST /api/whatsapp/webhook-replay` takes an `eventKey` — reuse it).
6. **Stale-claim cleanup.** A small worker (or the existing `compliance-purge` tick) marks `RECEIVED|PROCESSING` older than 1 h as `ABANDONED`, so `oldestWebhookWaitingMs()` (`webhook-accept.ts:227`) stops lying and the public health payload stops paging.
7. **Immediate ops:** clear today’s 2 rows + 2 jobs.
   ```sql
   UPDATE provider_webhook_events SET status='COMPLETED', processed_at=now()
   WHERE status='RECEIVED' AND field='envelope';
   ```
   ```bash
   redis-cli -n 0 DEL "bull:webhook-queue:failed" "bull:webhook-queue:envelope_fedc96…" "bull:webhook-queue:envelope_ea489…"
   ```
   (or `queue.clean(0, 1000, 'failed')` through a one-off script) — only after confirming both rows are `account_update` with `messageCount: 0`.

### P2-1 — `pm2-samyoj.service` is inactive
- PM2 keeps the app alive, but on reboot the app will not come back.
- Re-check `systemctl status pm2-samyoj` and restore the unit (`pm2 startup` + dump re-save).

#### Code / config where it lives
- Unit: `/etc/systemd/system/pm2-samyoj.service` (product `pm2 startup` output), `systemctl is-enabled pm2-samyoj` → **enabled**, `is-active` → **inactive**. That combination means systemd tried to start it and it exited — usually `Environment=PM2_HOME=…` mismatch (the app runs as `samyoj`, the unit may point at `/root/.pm2`), or `ExecStart=pm2 resurrect` ran before the dump existed and exited 0, or `Restart=on-failure` with a failing `Type=forking` PID file.
- PM2 state that survives: `/home/samyoj/.pm2/dump.pm2` (saved 15 Oct) and `pm2-samyoj.service` enabled.

#### Proper solution
1. Inspect, don’t re-install: `journalctl -u pm2-samyoj -n 100 --no-pager` and `systemctl cat pm2-samyoj`.
2. Recreate the unit correctly **as the app user**: `sudo -u samyoj pm2 startup systemd -u samyoj --hp /home/samyoj` (writes `Environment=PM2_HOME=/home/samyoj/.pm2`, `User=samyoj`, `ExecStart=/usr/lib/node_modules/pm2/bin/pm2 resurrect`). Then `sudo systemctl daemon-reload && sudo systemctl enable --now pm2-samyoj`.
3. Prove it: `sudo -u samyoj pm2 save`, `sudo systemctl restart pm2-samyoj`, then `curl -sf https://app.samyoj.com/health` and confirm `pm2 list` shows `whatsapp-api online`.
4. Add a reboot drill on a maintenance window (or a fresh second instance later): `sudo reboot`, wait, check health — this is the only way to know the unit actually works.
5. `Restart=always` + `RestartSec=10` on the unit so a PM2 daemon crash also recovers. Keep `pm2 save` in the deploy routine so the dump matches the running process list.

### P2-2 — No rate limiting / bot mitigation
- Nginx has no `limit_req`/`limit_conn`. App limiter = 20,000 req / 15 min / IP — effectively none.
- 15–16 Oct a **single scanner IP `5.189.162.28` made 69,326 requests** (51,586 on 16 Oct, 9 req/s peak), probing `/.env`, `/debug`, `/wp-json`, `/iams/...`.
- Volume was absorbed without impact (0 5xx), but Cloudflare or an nginx `limit_req` zone is cheap insurance.

#### Code / config where it lives
- Nginx: `/etc/nginx/nginx.conf` has **no `limit_req_zone`**; `/etc/nginx/sites-available/samyoj` proxies everything to `127.0.0.1:8000` with no `limit_req`, no `limit_conn`, no bot filter.
- App: `server/src/index.ts:172` → `rateLimit({ windowMs: 15 * 60 * 1000, max: 20_000 })` (express-rate-limit, in-memory). `skipGlobalHttpRateLimit()` (`server/src/middleware/http-rate-limit.js`) exempts all non-`/api` paths and the webhook. `app.set('trust proxy', 1)` (`index.ts:87`) is required for the limiter to see the client IP behind nginx.
- 69,326 requests from `5.189.162.28` in 2 days; a 9 req/s peak. Also `/iams/api/v1/forgot-password/verify` 19×, `/.env` prefixed 7 variants, `/dns-query`, `/resolve`, `/sdk`, `/api/mcp`.

#### Proper solution
1. **Nginx first (cheapest, no code):**
   ```nginx
   limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
   limit_req_zone $binary_remote_addr zone=webhook:10m rate=50r/s;
   # inside server{}:
   location /api/whatsapp/webhook { limit_req zone=webhook burst=100 nodelay; proxy_pass …; }
   location /api/                { limit_req zone=api burst=40 nodelay; limit_req_status 429; proxy_pass …; }
   location /                   { proxy_pass …; }  # static SPA: static_files + `try_files`
   ```
   Add `limit_conn_zone` for uploads and `server_tokens off`. Deny known scanner UAs only if you accept the false-positive risk — rates are safer.
2. **Cloudflare in front (optional, later):** moves bot filtering off the box, but then `trust proxy` must become `2` (or `loopback` + Cloudflare ranges) or the limiter keys on the Cloudflare IP; update `TRUST_PROXY`/`app.set` together.
3. **App limiter**: raise specificity — per-route limiters already exist for auth (`authRegisterLimiter`); keep the global limiter as a blunt backstop but move its store to Redis once there is more than one API process (in-memory resets on restart).
4. **Log hygiene**: `map $uri $loggable` + `access_log … if=$loggable` so scanner 404s don’t fill the log; and rotate `pm2` logs (P3-3).

### P2-3 — Exposed ports / SSH
- SG: 80 and 443 open to 0.0.0.0/0 (correct), 22 open to a single `/32` that no longer matches the Codespace (`20.192.21.52/32`).
- SSH access is now via a temporary key + temporary rule added for this audit — remove both after.
- 8000 not reachable from the internet (verified).

#### Code / config where it lives
- Temporary audit key added to `/home/admin/.ssh/authorized_keys` (`ssh-ed25519 … samyoj-audit-2026-10-21`); SG `sg-053a33215e0d0477a` currently has TCP 22 only from `20.192.21.52/32` (stale Codespace) — the working rule for this audit was added and must be removed.
- `PasswordAuthentication no` (confirmed), root login not permitted by password; SSH is key-only.
- SSM agent 3.3.5390.0 is **Online** — Session Manager is a working alternative that needs **no** inbound 22 at all.

#### Proper solution
1. Remove the temporary key: `sudo sed -i '/samyoj-audit-2026-10-21/d' /home/admin/.ssh/authorized_keys`, then delete the temporary SG rule and the local `/tmp/samyoj-audit.pem`.
2. Move day-to-day shell access to **Session Manager** (`aws ssm start-session --target i-085ca1949bb94e621`); the instance role already has `AmazonSSMManagedInstanceCore`. Then **close port 22 entirely** (`RevokeSecurityGroupIngress` on 22) — the strongest fix, zero public SSH exposure.
3. If interactive SSH must stay: keep port 22 bound to a per-admin `/32` that is updated, or to a bastion; never open 22 to `0.0.0.0/0`.
4. `fail2ban` for sshd is optional once 22 is closed; keep it if the rule stays.
5. Keep `HttpTokens: required` (IMDSv2) and the existing session-manager logging; add `ssm` port-forward for DB access instead of exposing 5432 (it is not exposed today — correct).

### P2-4 — Server processes respond to HEAD with 404
- `HEAD /login` → 404 while `GET /login` → 200. Only HEAD; browsers and users unaffected. SPA static + `app.get('*')` handles GET only.

#### Code / config where it lives
- `server/src/index.ts:345` → `app.get('*', (req,res,next) => { if (req.method !== 'GET') return next(); … res.sendFile(index.html) })`. `express.static` also handles GET/HEAD, but `.env`-style paths do not match a file, so HEAD falls to `next()` and the final 404 handler (`index.ts:363 errorHandler` path). In practice `HEAD /login` hit the API 404, hence the `enhanced 404` with a tight `Content-Security-Policy: default-src 'none'`.
- Main SPA routes are GET-only and return 200 (verified list in §3).

#### Proper solution
- Use `app.get(['*', '/'], …)` → `app.use((req,res,next) => { if (req.method !== 'GET' && req.method !== 'HEAD') return next(); … })` so HEAD gets the same shell + headers.
- Leave `/api/*` 404s as JSON (HEAD on `/api/*` should stay JSON, not HTML).
- One regression test: `HEAD /login` returns 200 with the same CSP as GET.
- This is also what uptime monitors (UptimeRobot, CloudWatch Synthetics) probe by default — fixing it avoids a fake “site down” alert.

### P3 — Cosmetic / low value

#### P3-1 — Malformed JSON body returns HTTP 500 (new)
- **Where:** routes / logs — global `express.json()` body parser.
- **What:** 19 Oct 02:58:04 UTC a bot `POST /.env` sent `0x%5B%5D=DTAB`; the parser threw `SyntaxError: Unexpected token '0', "0x%5B%5D=DTAB" is not valid JSON`, `isOperational: false` / `statusCode: 500`, logged with a full stack. Any client can trigger this class of 500 and every one writes a stack trace.
- **Code:** `server/src/index.ts:224` `app.use(express.json({ limit: '10mb' }))`; `server/src/errors/index.ts:212` `errorHandler()` turns any non-operational error into 500 + `logError` stack.
- **Proper solution:** add a parser-error handler **between** `express.json()` and `requireTenantCsrf`:
  ```ts
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: { message: 'Malformed JSON body', code: 'INVALID_JSON' } });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ success: false, error: { message: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' } });
    }
    next(err);
  });
  ```
  Log one `warn` line without the body/stack for bot traffic. Regression test: that exact body returns 400, not 500. **Note:** this also corrects the earlier “no 5xx outside 17 Oct” claim — 19 Oct had one.

#### P3-2 — Expired signed media URLs return 401
- `/api/media/public/...` signed URLs expired → 8× 401 (the same studio-pack signature retried 8×, so the client caches the URL and never refreshes it).
- **Code:** `server/src/modules/ai-studio/studio-image-pipeline.ts:15` `studioPublicMediaUrl()` embeds `exp`/`sig`; the public media route rejects expired signatures.
- **Proper solution:** on 401 refetch the pack’s fresh URLs (add `GET /api/ai-studio/packs/:id/media-urls`) and replace `src` in the image component; return `403 { code: 'MEDIA_URL_EXPIRED' }` so the client can tell “expired” from “forbidden”. Don’t shorten TTL to hide it.

#### P3-3 — 2.9 MB bundle, no gzip / HTTP2 / asset caching
- `Content-Length: 2,971,180`, `Cache-Control: max-age=0`, HTTP/1.1; nginx `gzip on` exists but `gzip_types` is commented out, so JS/CSS are **not** compressed.
- **Code:** SPA served by Express (`index.ts:342-343` `express.static`), no `compression()` middleware, no `setHeaders` immutable cache.
- **Proper solution:** either `app.use(compression())` + `express.static(clientDist, { setHeaders: (res, p) => p.includes('/assets/') && res.setHeader('Cache-Control','public, max-age=31536000, immutable') })` (index.html stays `no-cache`), or serve `client/dist` from nginx with `gzip_static on`, `gzip_types application/javascript text/css application/json`, and `listen 443 ssl http2;`. Vite already reports ~818 kB gzip for the bundle.

#### P3-4 — No swap and no PM2 log rotation
- `whatsapp-api-out-0.log` 1.9 MB / 7,915 lines and growing; `pm2-logrotate` not installed; AMI has no swap.
- **Proper solution:** `pm2 install pm2-logrotate` + `pm2 set pm2-logrotate:max_size 50M`, `retain 14`, `compress true`; add a 2 GB swapfile + `/etc/fstab`. Without swap, a payload burst in the worker can OOM-kill `node`, and with `pm2-samyoj` inactive (P2-1) the site then stays down.

#### P3-5 — Bot 404 noise
- `POST /` 126×, `/.env` variants, `/iams/api/v1/forgot-password/verify` 19×, `/dns-query`, `/resolve`, `/sdk`, `/api/mcp`.
- **Proper solution:** covered by P2-2 (rate limit + `map $uri $loggable` access_log filter). Nothing to fix in app code.

#### P3-6 — Startup config warnings (SMTP, GST)
- `SMTP_HOST` unset → `email.service.ts:14-22` logs the email and returns `false`; forgot-password/verification “succeed” but never arrive. GST supplier fields unset → `invoice.service.ts:144-168` can issue invoices missing supplier GSTIN/address/state.
- **Proper solution:** surface it in the UI (“email is not configured”) instead of “check your inbox”; make `validateConfig()` **fail startup in production** once email/GST billing is declared live (`BILLING_ENABLED`/`EMAIL_REQUIRED` flags), not just warn.

#### P3-7 — Server timezone is UTC
- Only affects server-side daily rollovers (`quota.ts` `startOfDay`, analytics buckets, campaign quota); UI converts to IST.
- **Proper solution:** keep UTC storage; derive the business day from one `BUSINESS_TZ=Asia/Kolkata` constant via `Intl.DateTimeFormat(..., { timeZone })`. Never read the host clock for “today”. Add a 00:00 IST boundary test.

#### P3-8 — Build provenance not recorded on the box
- `server/dist` 15 Oct 11:26, `client/dist` 15 Oct 10:51; two rollback dirs (42 MB + 40 MB); nothing says which commit is live.
- **Proper solution:** write `BUILD_INFO` (SHA/branch/time) during deploy and expose `commit` in `/health`; prune rollbacks to the last 2. Makes “what is running?” answerable without SSH.


---

## 7. Things that were checked and are correct

- Tenant isolation: `whatsapp_numbers`, conversations, campaigns all scoped by org/number (`active-number.ts` `EMPTY_ID_FILTER` prevents org-wide leakage).
- `.env` mode `600 samyoj:samyoj`; no `.git` and no `server/src` on the box.
- `/.env`, `/server/.env`, `/.git/config` return the SPA shell (4,710 bytes HTML), **no secrets leaked** — Express `app.get('*')` sends `index.html` for any non-API GET.
- **`/api/.env`-style probes return 404** (`/api` prefix is excluded from the SPA fallback), so the fallback cannot mask an API path.
- **`POST /.env` never reached CSRF or auth** — it died in `express.json()` before `requireTenantCsrf`; nothing was written or parsed.
- Socket.IO auth path `/api/socket.io` responds; cookie auth in place.
- Certbot timer active, certificate 82 days left, HSTS + full CSP on GET.
- **TLS handshake `bad key share` errors (~10, `[crit]`) are bot-probe noise**, not a cert or protocol problem; the cert has the SANs, and `/etc/letsencrypt/options-ssl-nginx.conf` sets `ssl_protocols TLSv1.2 TLSv1.3`.
- Redis `bind 127.0.0.1 -::1`, `appendonly no`, `maxmemory 0`/`noeviction` (fine at 2.86 MB / 91 keys, but add `maxmemory` before large growth); Postgres localhost only.
- All 10 BullMQ queues empty (except the 2 known failed jobs in `webhook-queue`).
- Meta callback pinned to `https://app.samyoj.com/api/whatsapp/webhook`; WABA override also pinned.
- Channel rows: channels table empty (Instagram/Page not connected at channel level), consistent with `byChannel.page = 0`.
- Media: 12 MB uploads, 13 files, local disk storage — fine at this scale, S3 needed before multi-instance.
- **`whatsapp_numbers` wiring:** the dead row is `0e1c995d-…` (`918839888531`, WABA `1593…`); the healthy row is `f18b740f-…` (`919303618219`, WABA `1096978842799680`); `250acfc4-…` (`15559747503`) is already inactive. Do not touch the last one.
- **No inbound traffic after 15 Oct** by design — this is still internal testing; that is why `webhook_stale = true` and the per-day message counts are zero.

---

## 8. Recommended next actions (in order)

1. **P0-1** Nightly `pg_dump -Fc` + S3 (instance role) + 7-day local retention, then a **restore drill** into a scratch DB (counts must match) before calling it done.
2. **P1-1** Deactivate the dead number via `DELETE /api/whatsapp/numbers/0e1c995d-…` (soft-delete, history kept) → removes ~50% of errors and the `/api/templates` 500s. Then the `graphGet` → `MetaApiError` mapping + per-WABA isolation.
3. **P1-2** Clear the 2 stuck rows + 2 failed jobs; then hash-only event key + `54000` guard + queue defaults (attempts/backoff/concurrency/DLQ).
4. **P2-1** Fix and prove the `pm2-samyoj` unit (it is enabled but inactive; `journalctl -u pm2-samyoj` first).
5. **P2-2/P2-3** Nginx `limit_req` + `server_tokens off`; move SSH to Session Manager, then close port 22 and remove the temporary key/rule.
6. **P2-4 / P3-1** `HEAD` → serve the SPA shell; JSON parse error → 400. Both one-file changes, both remove false alarms.
7. **P3-2 … P3-8** Media URL refresh, gzip/immutable cache, logrotate + swap, bot-log filter, SMTP/GST honesty, IST business-day constant, `BUILD_INFO` in `/health`.

No customer-visible issue is open right now; the risks above are about durability, noise, and failure modes.
