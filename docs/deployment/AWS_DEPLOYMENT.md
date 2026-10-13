# Samyoj — AWS deployment (current host going forward)

> **Use this for the AWS box.** The old Google Cloud steps stay in [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) until DNS cutover is finished and that VM is stopped.  
> **Learning note:** [AWS_LEARNING.md](./AWS_LEARNING.md)  
> **Last updated:** 2026-10-13

DNS cutover is **done** (13 Oct 2026). `app.samyoj.com` and `admin.samyoj.com` resolve to `3.108.25.94`. HTTPS certificate is valid until **11 Jan 2027**. GCP VM is still running until you confirm login and one WhatsApp reply.

---

## 1. Box

| Item | Value |
|------|--------|
| Account | `157328692150` |
| Region | `ap-south-1` (Mumbai), AZ `ap-south-1c` |
| Name | `samyoj-poc` |
| Instance | `i-085ca1949bb94e621` |
| Type | `t3.medium` (2 vCPU, 4 GB) |
| Disk | 30 GB gp3, encrypted |
| Elastic IP | `3.108.25.94` |
| OS | Debian 12 |
| Key pair | `samyoj-poc-bootstrap` (private key is not in git) |
| Security group | `sg-053a33215e0d0477a` — public **80** and **443**; **22** only from the Codespace IP used for setup |
| App user | `samyoj` |
| App path | `/home/samyoj/Samyoj` |
| Process | PM2 `whatsapp-api` only. Workers are inside the API. Do not start `whatsapp-worker`. |
| Boot | `pm2-samyoj.service` enabled |
| Data | PostgreSQL **17** and Redis **7** on localhost |
| Database | `whatsapp_platform` |
| TLS tool | `certbot` 2.1.0 installed. Certificate is **not** issued until DNS points here. |

There is no `.git` and no `server/src` on this box. The running files are `server/dist`, `client/dist`, `admin/dist`, `server/node_modules`, and `server/prisma`.

---

## 2. How a request moves

```text
Browser  →  nginx :80 (later :443)
         →  Node 127.0.0.1:8000  (PM2 whatsapp-api)
              ├── Postgres 127.0.0.1:5432
              └── Redis    127.0.0.1:6379
```

Public URLs in `.env` are already:

- `https://app.samyoj.com`
- `https://admin.samyoj.com`
- webhook `https://app.samyoj.com/api/whatsapp/webhook`

Do not point those at the raw IP.

---

## 3. SSH (until Session Manager is on)

```bash
ssh -i /path/to/samyoj-poc.pem admin@3.108.25.94
sudo -u samyoj pm2 status
curl -fsS http://127.0.0.1:8000/health
```

The PEM is not in the repo. Port 22 is not open to the world.

SSM agent is **active** (`amazon-ssm-agent` 3.3.5390.0). Port 22 can be removed from the security group after you confirm Session Manager opens a shell. Until then, leave the single-IP SSH rule.

---

## 4. Redeploy a new build

Do not `git pull` on this server.

1. Build `server`, `client`, and `admin` on a trusted machine at the commit you want.
2. Copy only `server/dist`, `client/dist`, `admin/dist`, production `server/node_modules`, and `server/prisma`.
3. Leave `server/.env` in place (`chmod 600`).
4. Restart one process:

```bash
sudo -u samyoj bash -lc 'cd /home/samyoj/Samyoj && pm2 restart whatsapp-api --update-env && pm2 save'
curl -fsS http://127.0.0.1:8000/health
```

Database changes: `npm run db:backup` then `npm run db:migrate-startup-safe` from `server/`. Do not run raw `prisma migrate deploy` on a fresh database (see existing deploy scripts).

---

## 5. After DNS (done 13 Oct 2026)

Certificate is issued for both names. HTTP redirects to HTTPS. Security headers are back on the HTTPS response.

Already checked: `https://app.samyoj.com/health` and `https://admin.samyoj.com/health` are ok, HTTP redirects to HTTPS, and the webhook challenge returns `ping`.

Still to confirm by hand:

- Login in a browser
- One new WhatsApp reply increases `totalReceived`

Stop the GCP VM only after that. Keep it stopped for 7 days before delete.

---

## 6. What stays on GCP until cutover

[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) and [SERVER_INVENTORY.md](./SERVER_INVENTORY.md) describe `samyoj-server`. Use them only if you must touch the old VM. New work goes to this file.
