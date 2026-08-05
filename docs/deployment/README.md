# 📦 Samyoj — Deployment Folder

**Sara deployment-related research aur guides ek hi jagah.**

| File | Kya hai |
|------|---------|
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | ✅ **Main guide** — step-by-step redeploy instructions, cheatsheet, troubleshooting. **Yahi pehle padho.** |
| **[SERVER_INVENTORY.md](./SERVER_INVENTORY.md)** | 📋 Detailed VM inventory — sab kuch jo live server pe mila (services, ports, .env keys, nginx, git state). Deep-dive reference. |

---

## Quick Start (Redeploy in 5 lines)

```bash
gcloud compute ssh samyoj-server --zone=asia-south1-c

# 1. Free disk space (CRITICAL — 84% full)
sudo journalctl --vacuum-size=200M && sudo apt clean

# 2. Fix .env (BASE_URL, META_APP_ID, META_APP_SECRET, META_WEBHOOK_URL, NODE_ENV)
sudo -u samyoj nano /home/samyoj/Samyoj/server/.env

# 3. Pull + install + migrate + build
cd /home/samyoj/Samyoj
sudo -u samyoj git pull origin <BRANCH>
sudo -u samyoj bash -c 'cd server && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build'
sudo -u samyoj bash -c 'cd client && npm ci && npm run build'

# 4. Restart + enable auto-start
sudo -u samyoj bash -c 'pm2 restart config/ecosystem.config.js && pm2 save'
sudo systemctl enable --now pm2-samyoj

# 5. Verify
curl -s https://app.samyoj.com/health
```

> ⚠️ **Pehle poora [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) padho** — isme saare warnings aur details hain. Ye shortcut sirf tab jab aap sab kuch jante ho.

---

## ⚠️ 5 Critical Issues (fix before deploy)

1. **Disk 84% full** — `/var/log/syslog` ne 2.7 GB kha liya → clean karo
2. **`BASE_URL` = `http://34.47.220.76`** → `https://app.samyoj.com` karo
3. **`META_APP_ID` empty + `META_APP_SECRET` missing** → add karo
4. **`META_WEBHOOK_URL` empty** → inbound messages nahi aayenge
5. **PM2 auto-start inactive** → reboot pe app nahi chalega

Full details: [KNOWN ISSUES in DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#7-known-issues--fixes)

---

## Infrastructure Summary

```
app.samyoj.com (SSL: Certbot, valid till 2026-10-16)
└── Nginx (:80 → 301 → :443) → proxy → 127.0.0.1:8000
    └── Node Express (PM2: whatsapp-api + whatsapp-worker)
        ├── PostgreSQL 17.10 @ localhost:5432 (whatsapp_platform)
        └── Redis 7 @ localhost:6379
```

- **VM:** `samyoj-server` | zone `asia-south1-c` | project `project-cf2ff302-9e0b-42b0-a1b`
- **App path:** `/home/samyoj/Samyoj`
- **Runs as user:** `samyoj`
- **Server code branch on VM:** `release/7July26` (Jul 9) — ⚠️ outdated vs dev
- **Current live status:** ✅ Healthy (`api/db/redis all ok`)
