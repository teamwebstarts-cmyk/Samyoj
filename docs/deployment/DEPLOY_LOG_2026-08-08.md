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
- Status: pending

### Phase 2 — DB backup
- Status: pending

### Phase 3 — .env config fixes
- Status: pending

### Phase 4 — Checkout branch
- Status: pending

### Phase 5 — Install + migrate
- Status: pending

### Phase 6 — Build
- Status: pending

### Phase 7 — Restart + auto-start
- Status: pending

### Phase 8 — Domain + TLS verify
- Status: pending

### Phase 9 — WhatsApp webhook + connect users
- Status: pending

### Errors encountered
- (none yet)

### Rollback notes
- Pre-deploy git HEAD to roll back to: `45b5089` on branch `release/7July26`.
- Rollback = `git checkout 45b5089` + rebuild + `pm2 restart config/ecosystem.config.js`.
- DB backup file path recorded in Phase 2.
