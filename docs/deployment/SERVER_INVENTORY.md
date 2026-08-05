# Samyoj — GCE VM Production Deployment Inventory

> **Generated:** 2026-08-06 (from live VM inspection)
> **Author:** Deployment audit agent (read-only inspection — no changes made)
> **VM:** `samyoj-server` | **Zone:** `asia-south1-c` | **Project:** `project-cf2ff302-9e0b-42b0-a1b`

---

## 1. Google Cloud Infrastructure

| Item | Value |
|------|-------|
| Project ID | `project-cf2ff302-9e0b-42b0-a1b` |
| VM name | `samyoj-server` |
| Zone | `asia-south1-c` (Mumbai) |
| Machine type | `e2-medium` (2 vCPU / 4 GB) |
| External IP | `34.47.220.76` (ephemeral, PREMIUM tier) |
| Internal IP | `10.160.0.2` |
| Network | default, IPv4-only |
| Boot disk | 10 GB, Debian 13 (trixie), type PERSISTENT |
| Status | RUNNING |
| Created | 2026-07-06 |
| Last start | 2026-07-07 |
| Uptime (at audit) | 28 days, 23:00 |
| Service account | `289270018588-compute@developer.gserviceaccount.com` |
| Firewall tags | `http-server`, `https-server` |
| Labels | `goog-ops-agent-policy: v2-template-1-7-0` |
| Deletion protection | `false` |
| Preemptible | `false` (STANDARD) |

### Service Account Scopes (limited)
- `devstorage.read_only`, `logging.write`, `monitoring.write`
- `service.management.readonly`, `servicecontrol`, `trace.append`
- ⚠️ **No SQL access scope** — VM cannot reach Cloud SQL via the default service account. DB runs on the VM itself (localhost).

---

## 2. Operating System

```
Debian GNU/Linux 13 (trixie)
Kernel: x86_64 (64-bit)
```

---

## 3. Resources

| Resource | Value | Notes |
|----------|-------|-------|
| vCPUs | 2 | e2-medium |
| RAM | 3.8 GB total / 3.0 GB available | ~20% used |
| Disk | 9.7 GB total, **7.7 GB used (84%)** | ⚠️ CRITICAL — low on space |

### Disk Space Breakdown
| Path | Size |
|------|------|
| `/var/log/syslog` + rotations | ~2.7 GB |
| `/var/log/journal` | ~951 MB |
| `/var/log/google-cloud-ops-agent` | ~755 MB |
| `/home/samyoj` | ~1.1 GB |
| `/usr` | ~2.3 GB |
| `/opt/google-cloud-ops-agent` | ~535 MB |

**⚠️ CRITICAL:** Disk is 84% full. `/var/log/syslog` is the main culprit. **MUST be cleaned before redeploy** (builds need ~1GB+).

---

## 4. Services & Processes

### systemd services
| Service | Status |
|---------|--------|
| `nginx` | **active** (ports 80/443) |
| `postgresql` | **active** (PostgreSQL 17.10, port 5432) |
| `redis` | **active** (Redis, port 6379) |
| `pm2-samyoj` | **enabled but INACTIVE** ⚠️ |
| `certbot.timer` | active (SSL auto-renew) |
| `exim4` | active (SMTP on port 25 — local only) |

### ⚠️ Critical: `pm2-samyoj` is enabled but **inactive**
The PM2 systemd unit exists and is enabled for boot, but it's currently inactive. The PM2 daemon is running under the `samyoj` user, but the systemd service (which runs `pm2 resurrect` on boot) is NOT active. **This means the app will NOT auto-start on reboot** unless this is fixed.

### Listening ports
| Port | Process |
|------|---------|
| 22 | sshd |
| 80, 443 | nginx |
| 5432 | postgres (127.0.0.1 only) |
| 6379 | redis (127.0.0.1 only) |
| 8000 | node API (`/home/samyoj/Samyoj/server/dist/index.js`) |
| 20201 | otelopscol |
| 20202 | fluent-bit |
| 5355 | systemd-resolve |
| 53 | systemd-resolve |
| 25 | exim4 |

---

## 5. Application — PM2

### Processes running (user: `samyoj`)
| Name | Script | PID | Uptime | Restarts | Mem | Status |
|------|--------|-----|--------|----------|-----|--------|
| `whatsapp-api` | `/home/samyoj/Samyoj/server/dist/index.js` | 899332 | 8D | 5 | 90.9 MB | online |
| `whatsapp-worker` | `/home/samyoj/Samyoj/server/dist/workers/index.js` | 899340 | 8D | 5 | 75.7 MB | online |

### PM2 config (`/home/samyoj/Samyoj/config/ecosystem.config.js`)
```js
module.exports = {
  apps: [
    {
      name: 'whatsapp-api',
      cwd: './server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 8000 },
    },
    {
      name: 'whatsapp-worker',
      cwd: './server',
      script: 'dist/workers/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
    },
  ],
};
```

### PM2 systemd unit (`/etc/systemd/system/pm2-samyoj.service`)
```
[Unit]
Description=PM2 process manager
After=network.target

[Service]
Type=forking
User=samyoj
Environment=PATH=/usr/local/bin:/usr/bin:/bin:...
Environment=PM2_HOME=/home/samyoj/.pm2
PIDFile=/home/samyoj/.pm2/pm2.pid
Restart=on-failure
ExecStart=/usr/lib/node_modules/pm2/bin/pm2 resurrect
ExecReload=/usr/lib/node_modules/pm2/bin/pm2 reload all
ExecStop=/usr/lib/node_modules/pm2/bin/pm2 kill
```

### PM2 log files (`/home/samyoj/.pm2/logs/`)
| File | Size | Notes |
|------|------|-------|
| `whatsapp-api-out-0.log` | 7.2 MB | growing |
| `whatsapp-api-error-0.log` | 0 | no errors |
| `whatsapp-worker-out-1.log` | 2.4 KB | workers started (10 queues) |
| `whatsapp-worker-error-1.log` | 0 | no errors |

### Workers / Queues (10 BullMQ queues)
```
webhook-queue, message-queue, broadcast-queue, automation-queue,
flow-queue, webhook-dispatch, compliance-purge, content-image,
content, content-video
```

---

## 6. Application Code State

| Item | Value |
|------|-------|
| Project path | `/home/samyoj/Samyoj` |
| Git remote | `git@github.com:teamwebstarts-cmyk/Samyoj.git` |
| Git branch | `release/7July26` |
| Last commit | `45b5089` — "dark -> light mode by default" (2026-07-09) |
| Uncommitted | `sites-enabled` (broken symlink, untracked) |
| Server build | `server/dist/index.js` built 2026-07-09 |
| Client build | `client/dist/index.html` built 2026-07-09 |
| Tracked files | 479 |

### ⚠️ Code is OUTDATED
The VM code is from **July 9** on branch `release/7July26`. The current workspace has branch `call-ui-improvemnet` which is **100 commits ahead** of `release/7July26`. A redeploy must decide:
- Which branch to deploy (`call-ui-improvemnet`, `master`, or the release branch)
- Whether the DB schema changed between branches (Prisma migrations)

### ⚠️ Broken symlink
`/home/samyoj/Samyoj/sites-enabled -> /etc/nginx/sites-available/samyoj/etc/nginx/sites-enabled/` — this is a **broken symlink** pointing to a non-existent path. It's untracked in git and serves no purpose.

---

## 7. Nginx Configuration

### Domain: `https://app.samyoj.com` ✅ LIVE (HTTP 200)

### `/etc/nginx/conf.d/samyoj.conf`
```nginx
upstream samyoj_upstream {
        server 127.0.0.1:8000;
        keepalive 64;
}
server {
        server_name   app.samyoj.com;
        root        /usr/share/nginx/html;
        client_max_body_size 60M;
        include /etc/nginx/default.d/*.conf;
        client_body_timeout 5s;
        client_header_timeout 5s;

        location / {
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header Host $http_host;
                proxy_set_header X-NginX-Proxy true;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection "upgrade";
                proxy_max_temp_file_size 0;
                proxy_pass http://samyoj_upstream/;
                proxy_redirect off;
                proxy_read_timeout 240s;
        }

        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/app.samyoj.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.samyoj.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# HTTP → HTTPS redirect
server {
        listen 80;
        listen [::]:80;
        server_name  app.samyoj.com;
        return 301 https://app.samyoj.com;
}

server {
    if ($host = app.samyoj.com) {
        return 301 https://$host$request_uri;
    }
    server_name   app.samyoj.com;
    listen 80;
    return 404; # managed by Certbot
}
```

### Nginx notes
- **ALL traffic** (including `/api/`, `/socket.io/`, and static) goes through the proxy to `127.0.0.1:8000` — the Express server serves everything.
- `client_max_body_size 60M` — supports media uploads.
- WebSocket upgrade headers present (`Upgrade`, `Connection: upgrade`) — Socket.IO works.
- SSL cert: `app.samyoj.com` — **expires 2026-10-16** (Let's Encrypt, certbot.timer active for auto-renew).
- ⚠️ `sites-enabled/` is EMPTY — the active config lives in `conf.d/samyoj.conf`, which is not managed by certbot directly (certbot may have edited it in place).

---

## 8. Environment Variables (server/.env)

**File:** `/home/samyoj/Samyoj/server/.env` (57 lines) — **values redacted here for security.**

### Present keys (names only)
```
PORT, NODE_ENV, LOG_LEVEL, CLIENT_URL, BASE_URL,
DATABASE_URL, REDIS_URL,
JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN,
ENCRYPTION_KEY,
META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN, META_API_VERSION,
META_REDIRECT_URI, META_WEBHOOK_URL,
AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT,
AZURE_OPENAI_API_VERSION,
SERVER_URL,
DEEPGRAM_API_KEY, GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_TTS_VOICE,
GOOGLE_TTS_LANGUAGE, CALLING_AI_AUTO_ANSWER, CALLING_AI_GREETING
```

### ⚠️ Non-secret values found (revealed during audit)
| Key | Value | Issue |
|-----|-------|-------|
| `PORT` | `8000` | ✅ matches nginx upstream |
| `NODE_ENV` | `development` | ⚠️ PM2 sets `production` at process level, but .env says `development` — inconsistent |
| `LOG_LEVEL` | `debug` | ⚠️ debug logging in production (noisy, fills disk) |
| `CLIENT_URL` | `http://34.47.220.76` | ⚠️ raw IP, not `https://app.samyoj.com` |
| `BASE_URL` | `http://34.47.220.76` | ⚠️ raw IP — this is used for webhook URLs, links, redirects |
| `SERVER_URL` | `http://34.47.220.76` | ⚠️ raw IP |
| `DATABASE_URL` | `postgresql://<redacted>@localhost:5432/whatsapp_platform` | ✅ local Postgres |
| `REDIS_URL` | `redis://localhost:6379` | ✅ local Redis |
| `META_APP_ID` | *(empty / very short)* | ⚠️ **EMPTY** — Meta App ID not configured |
| `META_APP_SECRET` | *(not present in grep output)* | ⚠️ **MISSING** |
| `META_API_VERSION` | `v21.0` | older version |
| `META_REDIRECT_URI` | `https://app.samyoj.com/settings/whatsapp/callback` | ✅ correct domain |
| `META_WEBHOOK_URL` | *(empty)* | ⚠️ **EMPTY** — webhook not configured |
| `AZURE_OPENAI_ENDPOINT` | `https://skillrai.openai.azure.com/` | ✅ |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-35-turbo` | ✅ |
| `GOOGLE_APPLICATION_CREDENTIALS` | `key.json` | ⚠️ **file missing** (`/home/samyoj/Samyoj/server/key.json` does not exist) |
| `GOOGLE_TTS_VOICE` | `en-IN-Neural2-A` | ✅ |
| `GOOGLE_TTS_LANGUAGE` | `en-IN` | ✅ |
| `CALLING_AI_AUTO_ANSWER` | `true` | ✅ |

### ⚠️ Critical env issues (must fix before/at redeploy)
1. **`BASE_URL` / `SERVER_URL` = `http://34.47.220.76`** — should be `https://app.samyoj.com`. This breaks:
   - Webhook URLs sent to Meta
   - Email links
   - OAuth redirect URIs
   - Absolute URLs in API responses
2. **`META_APP_ID` empty + `META_APP_SECRET` missing** — WhatsApp Connect cannot work.
3. **`META_WEBHOOK_URL` empty** — inbound messages will not be delivered to the app.
4. **`NODE_ENV=development`** in .env but PM2 env sets `production` — the `config/index.ts` uses `process.env.NODE_ENV`; PM2's env var takes precedence at runtime, but the .env is confusing.
5. **`GOOGLE_APPLICATION_CREDENTIALS=key.json`** — file doesn't exist on disk. Google TTS for calling will fail.
6. **`LOG_LEVEL=debug`** in production — produces verbose logs that fill disk.

---

## 9. Database

| Item | Value |
|------|-------|
| Engine | PostgreSQL **17.10** (Debian package, not Docker) |
| Host | `127.0.0.1:5432` (localhost only) |
| Database | `whatsapp_platform` |
| Systemd | `postgresql` — active |
| Prisma migrations | `20250617000000_init` only (+ `migration_lock.toml`) |
| Prisma schema | 44 KB, at `/home/samyoj/Samyoj/server/prisma/schema.prisma` |

### ⚠️ Migration concern
The VM only has **one** migration (`20250617000000_init`). The local repo's `server/prisma/migrations/` has `20260803073814_add_conversation_favorite` as well. If redeploying from `call-ui-improvemnet` or `master`, the new code will need its migrations applied.

---

## 10. Redis

| Item | Value |
|------|-------|
| Engine | Redis (systemd service, NOT Docker) |
| Host | `127.0.0.1:6379` (localhost only) |
| Status | active |

---

## 11. Backups / Cron / Security

| Item | Status |
|------|--------|
| DB backups | ❌ **NONE configured** (no pg_dump cron, no `/backups` dir) |
| samyoj crontab | ❌ none |
| root crontab | ❌ none |
| System crons | certbot, e2scrub_all, sysstat (normal) |
| Firewall (ufw) | not present — relies on GCP network firewall |
| GCP firewall tags | `http-server`, `https-server` |
| SSH keys | `dadulabham` (RSA + ECDSA), `codespace` (added during audit) |

### ⚠️ Security observations
1. **No backups** — if the disk dies or DB corrupts, all data is lost.
2. **Security scanners hitting the server** — PM2 log shows probes like `/.git/HEAD`, `/owncloud/status.php`, `/status.php` (all returned 200 due to SPA fallback — worth monitoring/blocking).
3. **`/.git/HEAD` returns 200** — the SPA catch-all returns the index.html for any path. This can confuse scanners but isn't a direct data leak (git dir is not exposed in the project root since node serves client/dist).

---

## 12. Live Status Checks (2026-08-05)

| Check | Result |
|-------|--------|
| `https://app.samyoj.com/` | HTTP **200** — Samyoj login page loads |
| `https://app.samyoj.com/health` | `{"status":"ok","checks":{"api":"ok","database":"ok","redis":"ok"}}` |
| `http://34.47.220.76/` | 301 redirect → https |
| `https://app.samyoj.com/login` | 200, Vite SPA loads |
| `/api/whatsapp/webhook?hub.challenge=ping` | 403 (wrong verify token — expected) |
| `/api/whatsapp/webhook/health` | 404 (endpoint not in old code) |
| `/api/whatsapp/*` | 401 (auth required — expected) |

---

## 13. Deployment Summary & Gaps

### What's working
- ✅ App is live at `https://app.samyoj.com`
- ✅ API + DB + Redis all healthy
- ✅ SSL valid until 2026-10-16
- ✅ Nginx reverse proxy + WebSocket upgrade working
- ✅ PM2 managing API + Worker (online, 8 days)
- ✅ HTTP→HTTPS redirect

### What needs fixing (priority order)
| # | Issue | Priority |
|---|-------|----------|
| 1 | **Disk 84% full** — `/var/log/syslog*` ~2.7GB + journal ~1GB | 🔴 Critical (blocks deploy) |
| 2 | **`BASE_URL`/`SERVER_URL`/`CLIENT_URL` = raw IP** — must be `https://app.samyoj.com` | 🔴 Critical (breaks links/webhooks/OAuth) |
| 3 | **`META_APP_ID` empty, `META_APP_SECRET` missing** | 🔴 Critical (WhatsApp Connect broken) |
| 4 | **`META_WEBHOOK_URL` empty** | 🔴 Critical (inbound messages broken) |
| 5 | **PM2 systemd inactive** — no auto-start on reboot | 🟠 High |
| 6 | **`NODE_ENV=development`** inconsistency | 🟠 High |
| 7 | **`key.json` missing** (Google TTS) | 🟠 Medium |
| 8 | **No DB backups** | 🟠 High |
| 9 | **Code outdated** — VM on `release/7July26` (Jul 9), workspace 100 commits ahead | 🟠 High (redeploy decision) |
| 10 | **Broken symlink** `sites-enabled` in project dir | 🟡 Low |
| 11 | **`LOG_LEVEL=debug`** in production | 🟡 Low (disk/CPU) |

### How to connect (for future access)
```bash
# From a machine with gcloud auth
gcloud compute ssh samyoj-server --zone=asia-south1-c

# SSH as samyoj user
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && ...'
```

---

## 14. Verified Commands (run inside VM)

```bash
# Health check
curl -s http://localhost:8000/health

# PM2 status
sudo -u samyoj pm2 list

# View API logs
sudo tail -50 /home/samyoj/.pm2/logs/whatsapp-api-out-0.log

# Nginx config test
sudo nginx -t

# Check disk
df -h /

# Check SSL expiry
sudo openssl x509 -enddate -noout -in /etc/letsencrypt/live/app.samyoj.com/fullchain.pem
```

---

## 15. Recommended Redeploy Path (after user approval)

1. **Free up disk** — rotate/clear `/var/log/syslog*`, trim journal (`journalctl --vacuum-size=200M`)
2. **Fix `.env`** — update `BASE_URL`, `SERVER_URL`, `CLIENT_URL` → `https://app.samyoj.com`; add `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_URL`; set `NODE_ENV=production`; set `LOG_LEVEL=info`
3. **Decide branch** — `call-ui-improvemnet` (current work) vs `master` vs `release/7July26`
4. **Pull new code** on VM, `npm ci`, `prisma generate`, run migrations
5. **Build** client + server
6. **Restart PM2** (`pm2 restart config/ecosystem.config.js`)
7. **Fix PM2 auto-start** (`sudo systemctl enable --now pm2-samyoj`)
8. **Verify** — health, login, WhatsApp webhook, media upload
9. **Optional** — set up nightly pg_dump backups, add security headers / block scanners
