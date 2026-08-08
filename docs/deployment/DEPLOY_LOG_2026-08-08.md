# Samyoj Deployment Log — 2026-08-08

> Deploying branch `call-ui-improvemnet` to production VM `samyoj-server` (GCE, zone `asia-south1-c`).
> Live URL: `https://app.samyoj.com`. Access via `gcloud compute ssh samyoj-server --zone=asia-south1-c` (login user `codespace`, passwordless sudo; app user `samyoj`).
> This document records every phase, command result, error, and fix.

---

## Pre-deploy baseline snapshot (captured before any change)

| Item | Value |
|------|-------|
| VM login user | `codespace` (sudo -> root OK, passwordless) |
| App user / path | `samyoj` @ `/home/samyoj/Samyoj` |
| Node / npm | v20.20.2 / 10.8.2 |
| Git branch on VM | `release/7July26` |
| Git HEAD | `45b5089` ("dark -> light mode by default") |
| Working tree | untracked `sites-enabled` (broken symlink) only |
| PM2 | `whatsapp-api` online (10D), `whatsapp-worker` online (10D), 5 restarts each |
| PM2 systemd `pm2-samyoj` | enabled but **inactive** (won't auto-start on reboot) |
| Nginx | config OK (warning: conflicting server_name `app.samyoj.com` on :80) |
| SSL cert | valid until **Oct 16 2026** |
| Disk | **~88% full** (journal 983M, syslog 949M, ops-agent 729M) |
| Prisma migrations applied | only `20250617000000_init` |

### `.env` issues found (server/.env)
| Key | Current | Target |
|-----|---------|--------|
| `NODE_ENV` | `development` | `production` |
| `LOG_LEVEL` | `debug` | `info` |
| `BASE_URL` | `http://34.47.220.76` | `https://app.samyoj.com` |
| `SERVER_URL` | `http://34.47.220.76` | `https://app.samyoj.com` |
| `CLIENT_URL` | `http://34.47.220.76` | `https://app.samyoj.com` |
| `META_API_VERSION` | `v21.0` | `v23.0` (current stable) |
| `META_WEBHOOK_URL` | *(empty)* | `https://app.samyoj.com/api/whatsapp/webhook` |
| `META_REDIRECT_URI` | `https://app.samyoj.com/settings/whatsapp/callback` | (already correct) |
| `META_APP_ID` | *(empty)* | provided by user |
| `META_APP_SECRET` | *(empty)* | provided by user |

Target branch `call-ui-improvemnet` ships 3 migrations (init + `auth_email_verified` + `add_conversation_favorite`), so `prisma migrate deploy` will apply **2 new** migrations.

---

## Phase log

### Phase 0 — Snapshot
- Status: DONE. Baseline captured above.

### Phase 1 — Disk cleanup
- Status: DONE. `journalctl --vacuum-size=200M` (freed ~855M), `apt clean`, deleted rotated `*.gz` + numbered logs, truncated syslog/auth.log.
- Result: disk **89% -> 55%** (from 1.1G free to 4.2G free). Post-build settled at 58% (3.9G free).

### Phase 2 — DB backup
- Status: DONE. `pg_dump` of `whatsapp_platform` -> `/home/samyoj/backups/whatsapp_platform-20260808-144221.sql.gz` (18K; small DB).

### Phase 3 — .env config fixes
- Status: DONE. Backed up to `.env.bak-<ts>`. Applied:
  - `NODE_ENV=production`, `LOG_LEVEL=info`
  - `BASE_URL`/`SERVER_URL`/`CLIENT_URL` = `https://app.samyoj.com`
  - `META_WEBHOOK_URL=https://app.samyoj.com/api/whatsapp/webhook`
  - `META_REDIRECT_URI=https://app.samyoj.com/settings/whatsapp/callback`
  - `META_API_VERSION=v23.0`
- Fail-fast checks PASS: `ENCRYPTION_KEY` 64-hex OK, `JWT_SECRET`=128, `JWT_REFRESH_SECRET`=128, `META_VERIFY_TOKEN`=25 (non-default).
- PENDING (needs user): `META_APP_ID`, `META_APP_SECRET` still empty (global platform Connect creds).

### Phase 4 — Checkout branch
- Status: DONE. Removed untracked broken `sites-enabled` symlink. `git fetch`, `checkout call-ui-improvemnet`, `reset --hard origin/call-ui-improvemnet`.
- Now: branch `call-ui-improvemnet`, HEAD **`fa0cb5b`** ("Add onContextMenu prop to CallListItem...").
- Note: remote branch has 4 migrations (one more than local workspace: `20260808120000_unique_whatsapp_phone_number_id`).

### Phase 5 — Install + migrate
- Status: DONE. `npm ci` (server) OK, `prisma generate` v6.19.3 OK.
- `prisma migrate deploy` applied **3 new** migrations: `auth_email_verified`, `add_conversation_favorite`, `unique_whatsapp_phone_number_id`. All succeeded (no duplicate-data failure on the unique constraint).

### Phase 6 — Build
- Status: DONE. Client `npm ci` + `vite build` OK (`client/dist/index.html` + assets; 2 benign VITE_PUBLIC_ASSET runtime-resolve warnings; main JS 1.84MB/519KB gzip). Server `tsc` OK (`dist/index.js` + `dist/workers/index.js` present).

### Phase 7 — Restart + auto-start
- Status: DONE. `pm2 restart config/ecosystem.config.js --update-env` + `pm2 save`.
- App boots in `production`/`logLevel=info`; 10 worker queues started; WebSocket ready; health ok.
- systemd `pm2-samyoj`: initially FAILED (`Result: protocol`) because a manually-started PM2 daemon conflicts with the `Type=forking` unit. FIXED by `pm2 save` -> `pm2 kill` -> `systemctl start pm2-samyoj` (systemd now owns the daemon). Now **enabled + active** -> survives reboot.

### Phase 8 — Domain + TLS verify
- Status: DONE.
  - External: `https://app.samyoj.com/` = 200, `/login` = 200, `/health` = 200 (`api/db/redis all ok`).
  - HTTP -> **301** -> `https://app.samyoj.com/`.
  - TLS: `CN=app.samyoj.com`, Let's Encrypt, valid Jul 18 -> **Oct 16 2026**.
  - `certbot renew --dry-run`: all simulated renewals succeeded; `certbot.timer` active (auto-renew works).
  - `nginx -t`: OK (harmless warning: conflicting `server_name app.samyoj.com` on :80 — duplicate server block, ignored by nginx).

### Phase 9 — WhatsApp webhook + connect users
- Status: DONE (platform-side). Live end-user connect is a manual user action (see below).
- Meta credentials added to prod `.env` (user-provided): `META_APP_ID=4533435916937282`, `META_APP_SECRET` set, `META_VERIFY_TOKEN` set (`wa_ce10...`), `META_API_VERSION=v25.0`. Kept PRODUCTION `META_REDIRECT_URI`/`META_WEBHOOK_URL` (did NOT import dev localhost/ngrok values; did NOT add `NGROK_AUTHTOKEN`). API restarted.
- `webhook/health`: `verifyTokenConfigured: true`, **`appSecretConfigured: true`**. Startup no longer warns about missing global secret.
- App-level webhook registered with Meta via `registerAppWebhook` (POST `/{appId}/subscriptions`). Confirmed by Graph API:
  `{"object":"whatsapp_business_account","callback_url":"https://app.samyoj.com/api/whatsapp/webhook","active":true,"fields":["messages","calls"]}`
- Challenge re-verified with the new token: local + public both echo the challenge.
- Connect OAuth is standard Facebook OAuth (scopes `whatsapp_business_management,whatsapp_business_messaging`, no `config_id` needed). Server allowlist accepts `https://app.samyoj.com/settings/whatsapp/callback`.

#### Meta Developer Console settings the org owner must set (one-time)
- App Settings -> Basic: App Domains = `app.samyoj.com`; Site URL / Privacy (`https://app.samyoj.com/privacy.html`) + Terms (`https://app.samyoj.com/terms.html`).
- Facebook Login -> Settings -> Valid OAuth Redirect URIs: add `https://app.samyoj.com/settings/whatsapp/callback`.
- WhatsApp -> Configuration: webhook already points to `https://app.samyoj.com/api/whatsapp/webhook` (registered via API); verify token = the `META_VERIFY_TOKEN` in `.env`. Subscribed fields: `messages`, `calls`.

#### Live connect test (manual — needs a real WhatsApp number)
1. Open `https://app.samyoj.com`, log in.
2. Settings -> Connect WhatsApp -> Facebook OAuth -> pick number (auto-subscribes the WABA to the app).
3. Send an outbound test message; then reply from the phone.
4. Confirm the reply appears in the Inbox and `webhook/health` `totalReceived` increments.
5. If a number was connected but events don't arrive, run on the VM: `cd server && npx tsx scripts/setup-webhook.ts` (subscribes each connected WABA).

---

## FINAL STATUS (2026-08-08)

- Branch deployed: `call-ui-improvemnet` @ `fa0cb5b`.
- `GET /health` -> `{"status":"ok","checks":{"api":"ok","database":"ok","redis":"ok"}}`.
- `webhook/health` -> `verifyTokenConfigured: true`, `appSecretConfigured: true`.
- PM2 `whatsapp-api` + `whatsapp-worker`: online. `pm2-samyoj` systemd: **enabled + active** (reboot-safe).
- Domain `https://app.samyoj.com` 200; HTTP->HTTPS 301; TLS valid to Oct 16 2026; certbot auto-renew OK.
- Disk: 59% used (3.8G free). DB backup: `/home/samyoj/backups/whatsapp_platform-20260808-144221.sql.gz`.
- Meta app webhook active (messages, calls); Connect OAuth ready pending the one-time Meta dashboard redirect-URI whitelist.

---

## Follow-up change (2026-08-08) — Email verification removed

User request: allow simple email + password login/registration; the "Email not verified" gate was blocking sign-in.

Code changes (identical files scp'd to VM `fa0cb5b`, rebuilt, restarted):
- `server/src/modules/auth/routes.ts`:
  - Register now sets `emailVerifiedAt: new Date()` and issues a session immediately (`accessToken`/`refreshToken`), returns `emailVerificationRequired: false` -> user is auto signed-in on registration.
  - Login: removed the `!emailVerifiedAt` block that returned `requiresEmailVerification` -> login proceeds with email + password only.
- `client/src/pages/RegisterPage.tsx`: after successful register, `navigate('/')` (auto-login lands in the app).
- (Verification endpoints `/verify-email`, `/resend-verification` left intact but no longer gate anything; the login banner is now unreachable.)

Data changes on prod DB:
- `user.updateMany({ emailVerifiedAt: null } -> new Date())`: 1 existing user marked verified.
- Reset password for `nirbhayhiwse37@gmail.com` to the user-provided value (stored hash didn't match) + marked verified. 1 org membership ("Student").

Verification:
- `POST /api/auth/login` (nirbhayhiwse37@gmail.com): `success:true`, accessToken issued, `emailVerified:true`.
- `POST /api/auth/register` (throwaway): `201`, accessToken issued, `emailVerificationRequired:false`; test user+org deleted after.
- Client rebuilt: new bundle `index-D82blPtG.js` (old `index-CgEXm8z1.js` replaced -> users should hard-refresh).

WARNING — git drift: these edits live on the VM working tree only (not committed/pushed). A future `git reset --hard origin/call-ui-improvemnet` will revert them. Commit + push `routes.ts` + `RegisterPage.tsx` to persist.

### Recommended follow-ups (not done — flag only)
- Add nightly `pg_dump` cron (still no automated backups beyond the manual one taken here).
- Optionally clean the duplicate nginx `:80` server block (harmless warning) and block scanner paths.
- `META_APP_SECRET` was shared in chat during setup — rotate in the Meta console if desired (update `.env` + restart afterwards).

### Errors encountered
1. `pm2-samyoj` systemd unit failed (`Result: protocol`, restart-limited). Cause: manual PM2 daemon vs `Type=forking`. Fix: kill manual daemon, start via systemd. Resolved.
2. First restart script aborted early due to `set -e` + `systemctl is-active` returning "activating" (non-zero). Cosmetic (script control-flow), no impact on app. Handled in follow-up.

### Rollback notes
- Pre-deploy git HEAD to roll back to: `45b5089` on branch `release/7July26`.
- Rollback = `git checkout 45b5089` + `npm ci` + `npm run build` (client+server) + `pm2 restart config/ecosystem.config.js`.
- DB backup for restore: `/home/samyoj/backups/whatsapp_platform-20260808-144221.sql.gz` (restore: `gunzip -c <file> | psql "$DATABASE_URL"`).
- Note: rolling back code across the 3 applied migrations may require DB restore if the old code is incompatible with the new schema.

---

## Production investigation (2026-08-08 evening) — Inbound calls + Inbox realtime

### Symptoms
1. Outbound calls OK; inbound calls — AI not responding
2. Inbox chat sometimes needs refresh; realtime intermittent

### Log evidence
Inbound call at 17:53:56 UTC:
- `Processing call webhook event=connect`
- **`Calling pipeline not configured`** → call missed + terminated immediately
- Meta `calls` webhooks ARE arriving (not a tunnel issue)

Production was missing `SARVAM_API_KEY` and all Sarvam STT/TTS vars. Outbound agent calls skip Sarvam entirely (browser WebRTC only).

### Inbox realtime root cause
PM2 runs `whatsapp-api` (has Socket.IO) AND `whatsapp-worker` (no Socket.IO). Both consume BullMQ. When `whatsapp-worker` processes inbound webhooks, `emitToOrg()` was a no-op — DB updated but browser not notified. Intermittent depending on which process got the job.

### Fixes deployed
1. Added full Sarvam voice config to prod `.env` (`SARVAM_API_KEY` verified set after restart)
2. `server/src/realtime.ts` — Redis pub/sub bridge so worker publishes, API delivers to Socket.IO

### Verify
- **Inbound call:** call business number → AI should greet
- **Inbox:** hard-refresh, send WhatsApp from phone → message appears without refresh
- Console should show `[socket] Connected` (JWT expiry can cause `Invalid or expired token` + socket disconnect — re-login if needed)
