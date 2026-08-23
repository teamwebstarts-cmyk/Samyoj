# Samyoj — Production Deployment Guide (GCE VM)

> **Purpose:** Complete, developer-friendly guide for deploying/redeploying Samyoj to the Google Compute Engine VM.
> **Last verified:** 2026-08-06 (live VM inspection)
> **App is currently LIVE at:** `https://app.samyoj.com` ✅

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Server Inventory (Current State)](#2-server-inventory-current-state)
3. [Accessing the Server](#3-accessing-the-server)
4. [Environment Variables](#4-environment-variables)
5. [How to Deploy / Redeploy (Step-by-Step)](#5-how-to-deploy--redeploy-step-by-step)
6. [Post-Deploy Verification](#6-post-deploy-verification)
7. [Known Issues & Fixes](#7-known-issues--fixes)
8. [Troubleshooting](#8-troubleshooting)
9. [Security & Backups](#9-security--backups)
10. [Quick Reference Cheatsheet](#10-quick-reference-cheatsheet)

---

## 1. Architecture Overview

```
                        ┌────────────────────────────────────────────┐
   User Browser ──────► │  NGINX (app.samyoj.com, SSL via Certbot)   │
                        │   :80  ──►  301  ──►  :443                   │
                        │   :443 ──► proxy ──►  127.0.0.1:8000        │
                        └───────────────────────┬────────────────────┘
                                                │ (reverse proxy + WebSocket)
                        ┌───────────────────────▼────────────────────┐
                        │  NODE APP (Express, port 8000)             │
                        │  PM2: whatsapp-api (dist/index.js)         │
                        │  BullMQ workers: embedded (startWorkers)   │
                        │  Serves API + client/dist (SPA)            │
                        └───────┬────────────────────┬───────────────┘
                                │                    │
                    ┌───────────▼───────┐   ┌───────▼───────────┐
                    │  PostgreSQL 17    │   │  Redis 7          │
                    │  localhost:5432   │   │  localhost:6379   │
                    │  whatsapp_platform│   │  BullMQ queues    │
                    └───────────────────┘   └───────────────────┘
```

**Key facts:**
- **Everything runs on ONE VM** (`samyoj-server`) — Node, Postgres, Redis, Nginx
- **Nginx** terminates SSL and proxies to the Node app on port 8000
- **Node app serves BOTH** the API (`/api/*`) and the built React frontend (`client/dist/`)
- **PM2** runs **one** process: `whatsapp-api` (`dist/index.js`). BullMQ workers are **embedded** via `startWorkers()` in the API.
- Do **not** also run `whatsapp-worker`, `npm run start:worker`, or `npm run dev:worker` — a second consumer duplicates jobs and can drop Inbox realtime (Socket.IO lives only on the API process).
- Existing hosts with a leftover `whatsapp-worker`: `pm2 delete whatsapp-worker && pm2 start config/ecosystem.config.js && pm2 save`
- WebSocket (Socket.IO) works through Nginx via `Upgrade` headers

---

## 2. Server Inventory (Current State)

### GCE VM

| Item | Value |
|------|-------|
| Project | `project-cf2ff302-9e0b-42b0-a1b` |
| VM name | `samyoj-server` |
| Zone | `asia-south1-c` (Mumbai) |
| Machine type | `e2-medium` (2 vCPU / 3.8 GB RAM) |
| External IP | `34.47.220.76` |
| OS | Debian 13 (trixie) |
| Boot disk | 10 GB |
| **Disk usage** | ⚠️ **84% full (7.7G/9.7G)** — needs cleanup before redeploy |

### Services running

| Service | Status | Details |
|---------|--------|---------|
| Nginx | ✅ active | `app.samyoj.com`, SSL valid until **2026-10-16** |
| PostgreSQL 17.10 | ✅ active | `localhost:5432`, DB `whatsapp_platform` |
| Redis | ✅ active | `localhost:6379` |
| PM2 `whatsapp-api` | ✅ online | 8 days uptime, 5 restarts |
| PM2 `whatsapp-worker` | ⚠️ **do not run** | Legacy second consumer. Delete if present: `pm2 delete whatsapp-worker`. Workers now run inside `whatsapp-api`. |
| PM2 systemd (`pm2-samyoj`) | ⚠️ **enabled but inactive** | won't auto-start on reboot |

### Code on server

| Item | Value |
|------|-------|
| Path | `/home/samyoj/Samyoj` |
| Branch | `release/7July26` |
| Last commit | `45b5089` (2026-07-09) |
| Git remote | `git@github.com:teamwebstarts-cmyk/Samyoj.git` |
| **Note** | ⚠️ Server code is **~1 month old**; current dev work (`call-ui-improvemnet`) is 100+ commits ahead |

### Live health (verified)

```json
{"status":"ok","checks":{"api":"ok","database":"ok","redis":"ok"},"version":"1.0.0"}
```

---

## 3. Accessing the Server

### From anywhere with gcloud installed

```bash
gcloud auth login                    # one-time
gcloud config set project project-cf2ff302-9e0b-42b0-a1b

# SSH into the VM
gcloud compute ssh samyoj-server --zone=asia-south1-c

# The app runs under user "samyoj"
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && ...'
```

### Alternative: access token (works from codespaces / CI)

```bash
# On any authenticated gcloud machine, print a short-lived token:
gcloud auth print-access-token

# Then use it in a non-interactive environment:
export CLOUDSDK_AUTH_ACCESS_TOKEN="<token>"
gcloud compute ssh samyoj-server --zone=asia-south1-c --command="whoami"
```

> Token is valid ~1 hour. It grants access to the GCP project.

---

## 4. Environment Variables

### Server `.env` — `/home/samyoj/Samyoj/server/.env` (NOT in git)

**All keys that must exist** (values are production secrets — do not commit):

| Group | Keys |
|-------|------|
| Server | `PORT=8000`, `NODE_ENV`, `LOG_LEVEL`, `CLIENT_URL`, `BASE_URL`, `SERVER_URL` |
| DB | `DATABASE_URL=postgresql://...@localhost:5432/whatsapp_platform` |
| Redis | `REDIS_URL=redis://localhost:6379` |
| JWT | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` |
| Encryption | `ENCRYPTION_KEY` (must be 64-char hex — server fails fast in production) |
| Meta WhatsApp | `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_API_VERSION`, `META_REDIRECT_URI`, `META_WEBHOOK_URL` |
| Azure OpenAI | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` |
| Calling (Google TTS) | `GOOGLE_APPLICATION_CREDENTIALS=key.json`, `GOOGLE_TTS_VOICE`, `GOOGLE_TTS_LANGUAGE` |
| Calling (Deepgram) | `DEEPGRAM_API_KEY`, `DEEPGRAM_LANGUAGE`, `CALLING_AI_AUTO_ANSWER`, `CALLING_AI_GREETING` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM` |
| Storage | `STORAGE_DRIVER` (local/s3), `S3_*` |
| Billing | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Monitoring | `SENTRY_DSN` (optional) |

### ⚠️ Critical issues found in the live `.env` (must fix)

| Key | Current (broken) | Should be |
|-----|-----------------|-----------|
| `BASE_URL` | `http://34.47.220.76` | `https://app.samyoj.com` |
| `SERVER_URL` | `http://34.47.220.76` | `https://app.samyoj.com` |
| `CLIENT_URL` | `http://34.47.220.76` | `https://app.samyoj.com` |
| `META_APP_ID` | *(empty)* | your Meta App ID |
| `META_APP_SECRET` | *(missing)* | your Meta App Secret |
| `META_WEBHOOK_URL` | *(empty)* | `https://app.samyoj.com/api/whatsapp/webhook` |
| `NODE_ENV` | `development` | `production` |
| `LOG_LEVEL` | `debug` | `info` |
| `META_API_VERSION` | `v21.0` | latest stable (e.g. `v25.0`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | `key.json` (file missing) | place `key.json` at `/home/samyoj/Samyoj/server/key.json` |

> ⚠️ **Production validation:** `server/src/config/validate.ts` fails fast (exits) if in `NODE_ENV=production` and: `JWT_SECRET` weak, `ENCRYPTION_KEY` not 64-hex, or `META_VERIFY_TOKEN` is default. Fix these before switching to production mode.

### Client build-time env (optional)
- `VITE_API_ORIGIN` — only if API is on a different origin than the frontend. When served by the same Express app, leave unset (same-origin works automatically).

---

## 5. How to Deploy / Redeploy (Step-by-Step)

Preferred path on `samyoj-server` (as user `samyoj`): `bash /home/samyoj/Samyoj/scripts/vps-deploy.sh`. That script pulls `phase-5-billing`, builds server/client/admin, pins `META_WEBHOOK_URL` to `https://app.samyoj.com/api/whatsapp/webhook`, re-registers the Meta app callback, then restarts `whatsapp-api` only.

> ⚠️ **Do these in order** if you are not using `vps-deploy.sh`. Steps 1–3 are critical and must happen before a build.

### Step 1 — Free up disk space (CRITICAL: disk is 84% full)

```bash
gcloud compute ssh samyoj-server --zone=asia-south1-c

# 1a. See what's big
sudo du -sh /var/log/* | sort -rh | head -10

# 1b. Rotate & compress syslog (safe)
sudo logrotate -f /etc/logrotate.d/rsyslog
sudo journalctl --vacuum-size=200M

# 1c. Clean apt cache (safe)
sudo apt clean

# 1d. Verify — must show > 3GB free before building
df -h /
```

### Step 2 — Fix `.env` (critical for webhooks/OAuth)

```bash
sudo -u samyoj bash
cd /home/samyoj/Samyoj/server
nano .env
```

Update these values (see table above):
```
BASE_URL=https://app.samyoj.com
SERVER_URL=https://app.samyoj.com
CLIENT_URL=https://app.samyoj.com
NODE_ENV=production
LOG_LEVEL=info
META_APP_ID=<your-app-id>
META_APP_SECRET=<your-app-secret>
META_WEBHOOK_URL=https://app.samyoj.com/api/whatsapp/webhook
META_REDIRECT_URI=https://app.samyoj.com/settings/whatsapp/callback
META_API_VERSION=v25.0
```

> Also verify: `JWT_SECRET` (32+ chars), `ENCRYPTION_KEY` (64-hex), `META_VERIFY_TOKEN` (not default).

### Step 3 — Restore Google TTS service key (if calling is used)

```bash
# key.json must exist at server/key.json
# If you have it locally, upload it:
gcloud compute scp ./server/key.json samyoj-server:/tmp/key.json --zone=asia-south1-c
gcloud compute ssh samyoj-server --zone=asia-south1-c -- \
  "sudo cp /tmp/key.json /home/samyoj/Samyoj/server/key.json && sudo chown samyoj:samyoj /home/samyoj/Samyoj/server/key.json && sudo chmod 600 /home/samyoj/Samyoj/server/key.json"
```

### Step 4 — Choose branch & pull new code

```bash
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && git fetch origin --all'
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && git checkout <BRANCH>   # e.g. master / release/7July26 / call-ui-improvemnet'
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && git pull origin <BRANCH>'
```

### Step 5 — Install dependencies & apply DB migrations

```bash
# Server deps + generate Prisma client
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj/server && npm ci && npx prisma generate'

# Apply new migrations (⚠️ backup DB first if this is a big change)
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj/server && npx prisma migrate deploy'

# Client deps
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj/client && npm ci'
```

> 💡 If `prisma migrate deploy` fails due to drift, use `npx prisma migrate dev` (interactive) or inspect `prisma migrate diff`.

### Step 6 — Build both apps

```bash
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj/client && npm run build'   # → client/dist
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj/server && npm run build'   # → server/dist
```

> Check disk space again if the build fails: `df -h /`

### Step 7 — Restart PM2

```bash
# If a leftover whatsapp-worker exists from older deploys, delete it first
# (workers are embedded in the API — a second process duplicates BullMQ consumers).
sudo -u samyoj pm2 delete whatsapp-worker 2>/dev/null || true
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && pm2 restart config/ecosystem.config.js'
sudo -u samyoj pm2 save
```

### Step 8 — Fix PM2 auto-start (IMPORTANT)

```bash
# The systemd unit exists but is inactive. Enable it so the app survives reboots:
sudo systemctl enable --now pm2-samyoj
sudo systemctl status pm2-samyoj   # verify "active"
```

---

## 6. Post-Deploy Verification

```bash
# 1. Health endpoint (all three checks must be "ok")
curl -s http://localhost:8000/health

# 2. Public site
curl -s -o /dev/null -w "%{http_code}\n" https://app.samyoj.com/        # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://app.samyoj.com/login   # expect 200

# 3. Webhook verify endpoint (use your real META_VERIFY_TOKEN)
curl -s "https://app.samyoj.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<YOUR_TOKEN>&hub.challenge=ping"

# 4. PM2 status
sudo -u samyoj pm2 list

# 5. Logs (check for errors)
sudo -u samyoj pm2 logs whatsapp-api --lines 30 --nostream

# 6. API responding
curl -s https://app.samyoj.com/health
```

### Webhook setup (required after every deploy)

`.env` can say `https://app.samyoj.com/api/whatsapp/webhook` while Meta still points at an old **ngrok** URL. Inbound messages and calls then never reach the VPS (outbound still works). Always re-register:

```bash
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj/server && npx tsx scripts/setup-webhook.ts'
```

`scripts/vps-deploy.sh` does this automatically after the build.

---

## 7. Known Issues & Fixes

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | Disk 84% full | 🔴 | Clean syslog/journal/apt cache (Step 1) |
| 2 | `BASE_URL`/`SERVER_URL` = raw IP | 🔴 | Set to `https://app.samyoj.com` |
| 3 | `META_APP_ID` empty / `META_APP_SECRET` missing | 🔴 | Add to `.env` |
| 4 | `META_WEBHOOK_URL` empty | 🔴 | Set to `https://app.samyoj.com/api/whatsapp/webhook` |
| 5 | PM2 systemd inactive (no auto-start) | 🟠 | `sudo systemctl enable --now pm2-samyoj` |
| 6 | `NODE_ENV=development` inconsistency | 🟠 | Set `production` in `.env` |
| 7 | `key.json` missing (Google TTS) | 🟠 | Upload service key |
| 8 | No DB backups | 🟠 | See Security section below |
| 9 | Code outdated (Jul 9) vs dev (100+ commits) | 🟠 | Pull latest branch |
| 10 | Broken symlink `sites-enabled` in repo | 🟡 | `rm /home/samyoj/Samyoj/sites-enabled` (untracked, safe) |
| 11 | `LOG_LEVEL=debug` in production | 🟡 | Set `info` |
| 12 | Leftover PM2 `whatsapp-worker` | 🔴 | `pm2 delete whatsapp-worker` — workers are embedded in `whatsapp-api`. `npm run start:worker` is unsupported (`SAMYOJ_EMBEDDED_WORKERS=1` refuses a second consumer). |

---

## 8. Troubleshooting

### "Server won't start / process exits immediately"
```bash
sudo -u samyoj pm2 logs whatsapp-api --lines 50 --nostream
```
Likely cause: config validation failure (weak secrets, missing ENCRYPTION_KEY, default META_VERIFY_TOKEN) in production mode. See `server/src/config/validate.ts`.

### "502 Bad Gateway" from Nginx
```bash
sudo systemctl status nginx
sudo tail -20 /var/log/nginx/error.log
# Check if API is actually listening:
curl -s http://localhost:8000/health
```

### "Messages not arriving in Inbox" (inbound webhook)
1. `META_WEBHOOK_URL` must be `https://app.samyoj.com/api/whatsapp/webhook`
2. Re-run `setup-webhook.ts`
3. Verify token matches Meta console
4. Test: `curl "https://app.samyoj.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=ping"`

### "SSL expired"
```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
```

### "Disk full during build"
```bash
sudo journalctl --vacuum-size=200M
sudo rm -rf /var/log/syslog.*
sudo apt clean
df -h /
```

### "Database connection refused"
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

---

## 9. Security & Backups

### 🔴 CRITICAL: No backups exist
The VM has NO database backups configured. A disk failure = total data loss. Set up nightly backups:

```bash
# Install as root
sudo mkdir -p /var/backups/whatsapp
sudo crontab -e
```

Add (runs nightly at 2 AM):
```
0 2 * * * pg_dump "postgresql://USER:PASS@localhost:5432/whatsapp_platform" | gzip > /var/backups/whatsapp/db-$(date +\%Y\%m\%d).sql.gz && find /var/backups/whatsapp -name "*.gz" -mtime +14 -delete
```

### Security notes
- `.env` contains live secrets — **never commit it** (already in `.gitignore`)
- Server is being probed by scanners (`/.git/HEAD`, `/owncloud/status.php`, etc.) — all currently return 200 due to SPA fallback. Consider blocking with Nginx:
  ```nginx
  location ~ /\.git { deny all; }
  location ~ /(owncloud|status\.php) { deny all; }
  ```
- Only ports 80/443/22 exposed to the internet (Postgres/Redis are localhost-only) — good.

---

## 10. Quick Reference Cheatsheet

```bash
# === ACCESS ===
gcloud compute ssh samyoj-server --zone=asia-south1-c

# === STATUS ===
sudo -u samyoj pm2 list                        # app processes
curl -s http://localhost:8000/health           # health check
sudo systemctl status nginx postgresql redis   # infra services
df -h /                                        # disk space

# === REDEPLOY (in order) ===
sudo journalctl --vacuum-size=200M && sudo apt clean        # 1. free disk
# 2. edit .env (fix BASE_URL, META_APP_ID/SECRET/WEBHOOK_URL, NODE_ENV=production)
cd /home/samyoj/Samyoj && sudo -u samyoj git pull origin <BRANCH>
sudo -u samyoj bash -c 'cd server && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build'
sudo -u samyoj bash -c 'cd client && npm ci && npm run build'
sudo -u samyoj bash -c 'pm2 restart config/ecosystem.config.js && pm2 save'
sudo systemctl enable --now pm2-samyoj

# === VERIFY ===
curl -s https://app.samyoj.com/health
sudo -u samyoj pm2 logs whatsapp-api --lines 30 --nostream

# === LOGS ===
sudo tail -50 /home/samyoj/.pm2/logs/whatsapp-api-out-0.log
# There is no whatsapp-worker process. `npm run start:worker` is unsupported
# (SAMYOJ_EMBEDDED_WORKERS=1 after API startWorkers(); a second consumer is refused).

# === SSL ===
sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/app.samyoj.com/fullchain.pem
sudo certbot renew --dry-run
```
