# 📦 Samyoj — Deployment Folder

**Sara deployment-related research aur guides ek hi jagah.**

| File | Kya hai |
|------|---------|
| **[AWS_LEARNING.md](./AWS_LEARNING.md)** | Padho pehle. Is move ke words aur decisions, Hinglish. |
| **[AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md)** | **Aage ka deploy doc.** AWS box, SSH, redeploy, certificate after DNS. |
| **[AWS_POC_STEPS.md](./AWS_POC_STEPS.md)** | POC checklist jo follow hua. DNS abhi last step hai. |
| **[AWS_MIGRATION_GUIDE.md](./AWS_MIGRATION_GUIDE.md)** | Data matrix, security, cost, GitHub model. |
| **[AWS_MCP_CURSOR_SETUP.md](./AWS_MCP_CURSOR_SETUP.md)** | Official AWS MCP + Cursor. |
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Purana GCP VM. Sirf jab tak domain us IP par hai. |
| **[SERVER_INVENTORY.md](./SERVER_INVENTORY.md)** | GCP inventory, August 2026 audit. |

---

## Quick Start — Google Cloud only (until DNS moves)

AWS redeploy is in [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md). The lines below still hit `samyoj-server`.

```bash
gcloud compute ssh samyoj-server --zone=asia-south1-c

# 1. Free disk space (CRITICAL — 84% full)
sudo journalctl --vacuum-size=200M && sudo apt clean

# 2. Fix .env (BASE_URL, META_APP_ID, META_APP_SECRET, META_WEBHOOK_URL, NODE_ENV)
sudo -u samyoj nano /home/samyoj/Samyoj/server/.env

# 3. Pull + install + migrate + build
cd /home/samyoj/Samyoj
sudo -u samyoj git pull origin <BRANCH>
sudo -u samyoj bash -c 'cd server && npm ci && npx prisma generate && npm run db:migrate-startup-safe && npm run build'
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
    └── Node Express (PM2: whatsapp-api; BullMQ workers embedded — do not run whatsapp-worker)
        ├── PostgreSQL 17.10 @ localhost:5432 (whatsapp_platform)
        └── Redis 7 @ localhost:6379
```

- **VM:** `samyoj-server` | zone `asia-south1-c` | project `project-cf2ff302-9e0b-42b0-a1b`
- **App path:** `/home/samyoj/Samyoj`
- **Runs as user:** `samyoj`
- **Server code branch on VM:** `release/7July26` (Jul 9) — ⚠️ outdated vs dev
- **Current live status:** ✅ Healthy (`api/db/redis all ok`)
- **Workers:** embedded in `whatsapp-api` (`startWorkers()`). `npm run start:worker` / PM2 `whatsapp-worker` is **unsupported** (duplicate BullMQ consumers).
