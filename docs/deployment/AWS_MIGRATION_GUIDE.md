# Samyoj — GCP → AWS Migration Guide (Production)

> **Purpose:** Reliable runbook for moving `samyoj-server` (Google Cloud) to AWS Mumbai (`ap-south-1`) with the **same product behavior**, **clear data boundaries**, and **no full source tree on the server**.  
> **Audience:** You (owner) + anyone doing cutover — written so you can learn each layer, not just follow blindly.  
> **Last updated:** 2026-10-12 (live GCP inspection + AWS/GCP public pricing APIs on this date).  
> **Related:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) (current GCP ops), [SERVER_INVENTORY.md](./SERVER_INVENTORY.md) (Aug 2026 audit — partial; see §2 for live deltas).

---

## Table of contents

1. [Big picture (5-minute mental model)](#1-big-picture-5-minute-mental-model)
2. [What runs today on Google Cloud](#2-what-runs-today-on-google-cloud)
3. [What we will run on AWS (target)](#3-what-we-will-run-on-aws-target)
4. [Verified monthly cost (not guesswork)](#4-verified-monthly-cost-not-guesswork)
5. [Data migration matrix — what moves, what does not](#5-data-migration-matrix--what-moves-what-does-not)
6. [PostgreSQL — the real source of truth](#6-postgresql--the-real-source-of-truth)
7. [Redis & BullMQ — mostly disposable](#7-redis--bullmq--mostly-disposable)
8. [Disk files (uploads, SSL, logs)](#8-disk-files-uploads-ssl-logs)
9. [Secrets & `.env` (never in Git)](#9-secrets--env-never-in-git)
10. [Secure AWS environment (design)](#10-secure-aws-environment-design)
11. [GitHub & source code — how nothing is “lost” but nothing leaks](#11-github--source-code--how-nothing-is-lost-but-nothing-leaks)
12. [Migration phases (checklist)](#12-migration-phases-checklist)
13. [Rollback plan](#13-rollback-plan)
14. [After cutover — backups & monitoring](#14-after-cutover--backups--monitoring)
15. [AWS MCP & Cursor — can the AI help on AWS?](#15-aws-mcp--cursor--can-the-ai-help-on-aws)
16. [Appendix — commands & references](#16-appendix--commands--references)

---

## 1. Big picture (5-minute mental model)

Think in **four layers**. Migration is mostly moving **layer 2–3**; layer 1 stays on GitHub; layer 4 is external SaaS.

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. SOURCE OF TRUTH (GitHub)                                     │
│    teamwebstarts-cmyk/Samyoj — branches, tags, PRs, history     │
│    Never deleted by migration; server does not need a full clone │
└───────────────────────────────┬─────────────────────────────────┘
                                │ CI builds release artifact
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. RUNTIME (one VM — GCP today, AWS tomorrow)                   │
│    nginx :443 → Node :8000 (PM2: whatsapp-api only)             │
│    Postgres + Redis on same machine (localhost)                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ reads/writes
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CUSTOMER DATA                                                │
│    PostgreSQL (whatsapp_platform) + optional local/S3 media      │
│    Redis queues/cache (mostly rebuildable)                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │ API keys in .env
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. EXTERNAL SERVICES                                            │
│    Meta WhatsApp, Razorpay, Sarvam, Azure OpenAI, SMTP, etc.    │
│    Same accounts; only URLs/IPs may change if you change domains  │
└─────────────────────────────────────────────────────────────────┘
```

**Migration success** = users open `https://app.samyoj.com`, log in, see same orgs/contacts/inbox/campaigns, WhatsApp send/receive works, billing hooks still valid — on AWS hardware.

---

## 2. What runs today on Google Cloud

Live inspection **2026-10-12** (SSH + `gcloud`; overrides older inventory where different).

| Item | Value |
|------|--------|
| Project | `project-cf2ff302-9e0b-42b0-a1b` |
| VM | `samyoj-server`, zone `asia-south1-c` (Mumbai) |
| Shape | **e2-medium** — 2 vCPU, **3.8 GiB RAM** |
| Disk | **10 GB** pd-balanced, **~87% full** |
| Public IP | **34.47.220.76** (reserved name `samyoj-static-ip`) |
| OS | Debian 13 (trixie) |
| App user | `samyoj` |
| App path | `/home/samyoj/Samyoj` |
| Git remote | `git@github.com:teamwebstarts-cmyk/Samyoj.git` |
| Branch on VM (Oct 2026) | `v8.8.0--ai-studio-update` @ `08d4a367` |
| Process | PM2 **`whatsapp-api` only** (workers embedded — see `config/ecosystem.config.js`) |
| Postgres | **17.11**, localhost — DBs: `whatsapp_platform`, `samyojdatabase`, `postgres` |
| Redis | **8.0.2**, localhost |
| Edge | nginx → `127.0.0.1:8000`; domains **`app.samyoj.com`**, **`admin.samyoj.com`** |
| Deploy today | `git pull` on VM + `scripts/vps-deploy.sh` |

**Security gaps on GCP (fix on AWS, not copy):**

- Firewall allows **22, 8000, 8787, 3389** from `0.0.0.0/0` — API port should not be public.
- Full **git checkout + `server/src` + `.git`** on disk (~1.3 GB tree).
- **`~/.ssh/id_ed25519`** on server (GitHub deploy key) — if VM is compromised, repo access is compromised.
- **No scheduled DB backups** on VM (script exists in repo; cron does not).

---

## 3. What we will run on AWS (target)

Same **architecture** (one box), better **disk & security**. Region: **`ap-south-1`** (Mumbai).

| GCP today | AWS target | Why |
|-----------|------------|-----|
| e2-medium (2 vCPU, ~4 GB) | **t3.medium** (2 vCPU, 4 GiB) | Same class, AWS Price List API match |
| 10 GB disk (full) | **30 GB gp3**, encrypted | Room for builds + logs + Postgres growth |
| Static IP 34.47.220.76 | **Elastic IP** (new address) | DNS cutover to new A record |
| `gcloud compute ssh` | **SSM Session Manager** (no SSH :22 on internet) | Smaller attack surface |
| git pull on server | **GitHub Actions → release tarball/SSH rsync** | No `.git` / no `src` on server |
| Secrets in `server/.env` on disk | Same file path, **`chmod 600`**, optional **SSM Parameter Store** later | Matches current app; upgrade path clear |

**Explicitly not in v1 (cost + complexity):** RDS, ElastiCache, ALB, EKS, second app server. Load on GCP is low (~0.3); one VM is correct until metrics say otherwise.

**Code reference (runtime):**

- PM2: `config/ecosystem.config.js` — only `whatsapp-api`, `SAMYOJ_EMBEDDED_WORKERS=1`.
- Deploy script: `scripts/vps-deploy.sh` — backup → migrate → build → webhook pin → smoke.
- Smoke: `scripts/vps-prod-smoke.sh`.

---

## 4. Verified monthly cost (not guesswork)

Prices below are **on-demand list** from official APIs **2026-10-12**. Billing month = **730 hours**. USD/INR example uses **₹83.5/$** (change with your bank rate). **GST extra.**

### AWS (`ap-south-1`) — target

| Line | Rate (API) | Quantity | USD/mo |
|------|------------|----------|--------|
| EC2 **t3.medium** Linux | $0.0448 / hr | 730 hr | **$32.70** |
| EBS **gp3** | $0.0912 / GB-mo | 30 GB | **$2.74** |
| Elastic IP (attached, instance running) | $0 | 1 | **$0** |
| **Subtotal (VM + disk)** | | | **≈ $35.44 (~₹2,960)** |

*Not included:* internet egress (often small for this app), S3 backup storage (~₹50–200 if you keep 7–14 nightly DB dumps).

### GCP (`asia-south1`) — current (for comparison)

| Line | Rate (Cloud Billing API) | Quantity | USD/mo |
|------|--------------------------|----------|--------|
| E2 core | $0.0261993 / vCPU-hr | 2 × 730 | $38.25 |
| E2 RAM | $0.00351072 / GiB-hr | 4 × 730 | $10.25 |
| **Compute** | | | **$48.50** |
| pd-balanced | $0.12 / GB-mo | 10 GB | **$1.20** |
| **List total** | | | **≈ $49.70 (~₹4,150)** |

GCP often applies **sustained-use discount** on 24×7 compute (~25–30%), so real GCP bill may land near **~₹3,000** — similar band to AWS, not 10× cheaper.

**Takeaway:** Migration is not mainly to save ₹500; it is for **security, disk headroom, and a deploy model without git on the box**.

---

## 5. Data migration matrix — what moves, what does not

### ✅ Must migrate (product breaks without this)

| Data | Where it lives today | How we move it | Notes |
|------|----------------------|----------------|-------|
| **Primary app database** | Postgres `whatsapp_platform` | `pg_dump --format=custom` → `pg_restore` on AWS | All tenants, WhatsApp numbers, contacts, conversations, messages metadata, campaigns, billing rows, AI config, etc. (Prisma models in `server/prisma/schema.prisma`) |
| **Production secrets** | `/home/samyoj/Samyoj/server/.env` | Secure copy (Doppler export, encrypted file, **not** chat/email) | Same keys as today; see §9 |
| **TLS identity** | Let’s Encrypt on VM | **Re-issue on AWS** with certbot | Do not copy private keys across clouds unless emergency; new machine = new cert request |
| **DNS** | `app.samyoj.com`, `admin.samyoj.com` | A/AAAA → **new Elastic IP** | Short TTL (300s) before cutover |
| **Meta webhook URL** | `https://app.samyoj.com/api/whatsapp/webhook` | **Unchanged hostname** if DNS only changes IP | `vps-deploy.sh` pins this; run `npm run setup-webhook` after cutover |
| **Local media files** (if any) | `server/uploads/media/` when `STORAGE_DRIVER=local` | `rsync` or tarball | Check GCP disk size under `uploads/` before cutover |
| **Google TTS / service account file** | `server/key.json` (if calling uses Google TTS) | Secure copy to AWS same path, `chmod 600` | Optional if you use Sarvam-only calling |

### ⚠️ Migrate only after you confirm need

| Data | Where | Action |
|------|--------|--------|
| **`samyojdatabase`** | Postgres on GCP | **Not referenced in repo.** On VM: inspect tables (`\dt`). If empty/legacy, skip; if used by manual tools, dump separately. |
| **S3 objects** | If `STORAGE_DRIVER=s3` | **No VM migration** — same bucket/keys in `.env`; AWS app uses same S3 API |
| **Razorpay / Meta** | Their dashboards | No data export; ensure webhook URLs still reachable |

### ❌ Do not migrate (rebuild or discard)

| Item | Why |
|------|-----|
| **Redis contents** | Queues, rate-limit counters, template cache, call:* keys — **ephemeral**. Stop API → start fresh Redis on AWS → workers re-queue from DB/webhooks where designed |
| **BullMQ in-flight jobs** | Same as Redis; plan **5–15 min maintenance** window |
| **Node `node_modules` / `dist` on old VM** | Rebuilt by CI or `npm ci && npm run build` on release artifact |
| **Full git repo on server** | **Do not copy** `.git`, `server/src`, `client/src`, `admin/src` to AWS production path |
| **`/var/log/*`, PM2 logs** | Operational only; optional archive for forensics |
| **GCP Ops Agent / fluent-bit state** | GCP-specific |
| **SSH host keys / old authorized_keys** | New machine, new keys; use SSM |
| **ngrok / dev tunnel config** | Production uses fixed `app.samyoj.com` webhook only |

### 🌐 Stays where it already is (not “on the VM”)

| Service | What stays |
|---------|------------|
| **GitHub** | All source history, branches, tags |
| **Meta WhatsApp Cloud** | WABA, templates, phone numbers (your OAuth tokens are in DB + `.env`) |
| **Razorpay** | Orders/subscriptions in **your** Postgres + Razorpay dashboard |
| **Sarvam / Azure OpenAI** | External APIs; keys in `.env` |
| **Customer phones** | No migration |

---

## 6. PostgreSQL — the real source of truth

The app uses **`DATABASE_URL`** → database name **`whatsapp_platform`** (see live GCP `.env` pattern in deployment docs).

`npm run db:backup` (`server/scripts/backup-database.ts`) dumps **only** the database in `DATABASE_URL` (custom format → `.run/backups/whatsapp-platform-*.dump`).

**What kind of business data is inside (high level):**

| Area | Prisma examples | User-visible |
|------|-----------------|--------------|
| Auth & tenancy | `User`, `Organization`, `OrganizationUser`, `RefreshToken` | Login, teams |
| WhatsApp | `WhatsappNumber`, `Contact`, `Conversation`, `Message` | Inbox, Connect |
| Campaigns & automation | `Campaign`, `Automation`, `Flow` | Campaigns, flows |
| Billing (current code) | `PaymentOrder`, `PlanPeriod`, `Billing*` models | Plans, invoices |
| AI | `AiBot`, `KnowledgeBaseItem`, `AiUsageLog`, credits | Train, usage |
| Platform admin | `PlatformOperator`, `PlatformAuditLog` | `admin.samyoj.com` |
| Integrations | `GmailMailbox`, `Instagram*`, `MetaAdsSnapshot` | Omnichannel features |

**Migration command pattern (maintenance window):**

```bash
# On GCP (as user with DATABASE_URL)
cd /home/samyoj/Samyoj/server
npm run db:backup
# Copy .run/backups/*.dump to AWS securely (scp via bastion or S3 presigned)

# On AWS (after Postgres installed, empty DB created)
npm run db:restore   # uses server/scripts/restore-database.ts — test on staging first
```

After restore: `npm run db:migrate-startup-safe` on **new code** if AWS runs a newer commit than GCP (usual case).

---

## 7. Redis & BullMQ — mostly disposable

Redis (`REDIS_URL=redis://localhost:6379`) holds:

- **BullMQ** job queues (`webhook-queue`, `message-queue`, `broadcast-queue`, … — see workers in `server/src/workers/`)
- **Caches** (e.g. WhatsApp templates — `server/src/modules/templates/cache.ts`)
- **Rate limits / throttles** (campaign locks, coexistence send throttle, help-center daily limits)
- **Ephemeral call state** (`call:active:*` keys cleaned on API start — `server/src/index.ts`)

**Procedure:**

1. Announce maintenance.
2. Stop `whatsapp-api` on GCP (drain: wait until PM2 shows no active campaign sends if possible).
3. Final Postgres dump (§6).
4. Start AWS with **empty Redis**.
5. Users may need to **retry** a stuck campaign; inbound webhooks Meta will **retry** if briefly down.

---

## 8. Disk files (uploads, SSL, logs)

| Path (typical) | Migrate? |
|----------------|----------|
| `server/uploads/media/` | **Yes** if `STORAGE_DRIVER=local` and files referenced in DB |
| `server/key.json` | **Yes** if env points to Google TTS |
| `/etc/letsencrypt/` | **No** — re-run certbot on AWS |
| `/home/samyoj/Samyoj/.git` | **No** on AWS prod |
| `/home/samyoj/.pm2/logs/` | Optional archive |
| `OPS_ERROR_LOG` path from `.env` | Create empty writable file on AWS |

**Storage driver** (`server/src/config/index.ts`, `server/src/modules/media/storage-adapter.ts`):

- `STORAGE_DRIVER=local` → files on disk; must rsync.
- `STORAGE_DRIVER=s3` → migrate **bucket policy + env**, not files from VM.

---

## 9. Secrets & `.env` (never in Git)

Production file: **`server/.env`** on server only (see key list in `scripts/vps-prod-smoke.sh` and `docs/deployment/DEPLOYMENT_GUIDE.md`).

**Rules:**

1. **Never** commit `.env`, `key.json`, or dumps to GitHub.
2. Copy secrets via **Doppler**, **1Password**, or encrypted archive — one person verifies checksum on AWS.
3. File permissions: **`chmod 600`**, owner = app user (`samyoj` or `ubuntu`).
4. Production gates enforced by `vps-deploy.sh`: `NODE_ENV=production`, `OAUTH_STATE_SECRET`, `ALLOW_UNVERIFIED_LOGIN=false`, `PLATFORM_MFA_REQUIRED=true`.

**After AWS cutover, rotate if GCP VM was ever widely accessible:**

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` (rotation has product impact — plan separately)
- GitHub deploy key on old VM — **revoke** when GCP VM is destroyed
- Optional: new `META_VERIFY_TOKEN` only if you want forced webhook re-verify

---

## 10. Secure AWS environment (design)

### Network

| Rule | Setting |
|------|---------|
| Inbound from internet | **TCP 80, 443 only** |
| SSH | **Closed** on 0.0.0.0/0; admin via **SSM Session Manager** |
| Postgres / Redis / Node 8000 | **127.0.0.1 only** (bind API to localhost; nginx public) |
| Outbound | Default allow (Meta, Razorpay, Sarvam, SMTP) |

### Instance

- **IMDSv2 required** (metadata hardening).
- **Encrypted gp3** root volume.
- **No** GitHub private key on instance — CI uses **OIDC** or one-time deploy key stored in **GitHub Secrets**, not on disk long-term.

### IAM (minimal)

| Principal | Permission |
|-----------|------------|
| Human admin | MFA, `AdministratorAccess` or break-glass role |
| EC2 instance role | `AmazonSSMManagedInstanceCore` + optional `s3:PutObject` on backup bucket only |
| GitHub Actions OIDC role | `ec2:Describe*`, `ssm:SendCommand` or SSH deploy scoped to one instance |

### Application (already in codebase)

- HttpOnly cookies + CSRF (SAMYOJ-3 pattern).
- `helmet`, rate limits, production config validation (`server/src/config/validate.ts`).
- WhatsApp number isolation — see `.cursor/rules/whatsapp-number-isolation.mdc`.

### Compliance note

Customer **message content** and **PII** live in **Postgres** (and media on disk/S3). That is what you protect first — not hiding compiled `dist/*.js`.

---

## 11. GitHub & source code — how nothing is “lost” but nothing leaks

### Where source code actually lives

| Copy | Role |
|------|------|
| **GitHub `teamwebstarts-cmyk/Samyoj`** | Canonical — branches, history, tags, PRs |
| **Your laptop / Codespaces** | Dev clones |
| **GCP VM today** | Extra copy (`.git` + `src`) — **remove this pattern on AWS** |

Migration **does not delete GitHub**. If AWS dies, you still have code; you redeploy from GitHub.

### Target deploy flow (recommended)

```text
GitHub (push to main or release tag)
    → GitHub Actions job
        → npm ci / build server + client + admin
        → prisma generate (migrations shipped in artifact)
        → tar release/ (dist folders, package-lock, prisma/migrations, config/ecosystem.config.js, scripts/vps-deploy.sh)
    → scp or S3 → AWS /opt/samyoj/releases/<git-sha>/
    → symlink current → restart PM2
```

**On AWS production disk you keep:**

- `server/dist/`, `client/dist/`, `admin/dist/`
- `server/node_modules/` (production deps only)
- `server/prisma/migrations/` (for `db:migrate-startup-safe`)
- `config/ecosystem.config.js`, `scripts/vps-deploy.sh`, `scripts/vps-prod-smoke.sh`

**You do not keep:**

- `.git/`, `**/src/`, `**/*.ts` (except none in prod)
- GitHub deploy private key
- DevDependencies on server

### How you learn / verify nothing is “missed”

1. **Tag every production deploy:** `git tag prod-2026-10-12-aws-cutover` on the exact commit AWS runs.
2. **Record in this doc or a deploy log:** tag + artifact SHA256 + DB dump filename.
3. **Smoke test:** `scripts/vps-prod-smoke.sh` (health, webhook, env keys).
4. **Compare commit:** on AWS `cat /opt/samyoj/current/RELEASE.json` (file CI writes) vs GitHub tag.

### If someone gets shell on AWS

- They can read **`dist`** and **`.env`** — plan for that (least privilege, no SSH, rotate secrets).
- They **cannot** get git history or TypeScript sources if you did not deploy them.
- They **cannot** push to GitHub without CI credentials (use OIDC, short-lived).

---

## 12. Migration phases (checklist)

### Phase 0 — Prepare (no downtime)

- [ ] AWS account, billing alert at ₹5k / $50
- [ ] Create EC2 + Elastic IP + security group (§10)
- [ ] Install stack (Postgres 17, Redis, Node 20, nginx, certbot, PM2)
- [ ] GitHub Actions workflow (build artifact, no secrets in log)
- [ ] Staging: restore **copy** of DB dump, run smoke tests
- [ ] Document `samyojdatabase` on GCP (used or skip)

### Phase 1 — Rehearsal

- [ ] Full dump + restore on AWS staging
- [ ] `rsync` uploads if local storage
- [ ] Login, inbox, send test message, admin login
- [ ] Measure deploy time + disk free (target **> 8 GB** free after build)

### Phase 2 — Cutover (maintenance window, ~30–60 min)

- [ ] Lower DNS TTL to 300s (24h before)
- [ ] Stop GCP `whatsapp-api`
- [ ] Final `npm run db:backup` + copy to AWS
- [ ] Restore on AWS production Postgres
- [ ] Deploy release artifact; `pm2 start` / `vps-deploy.sh` equivalent without `git pull`
- [ ] certbot for `app` + `admin` hostnames
- [ ] `npm run setup-webhook` (or `vps-deploy.sh` step 7)
- [ ] Switch DNS A records to Elastic IP
- [ ] Run `vps-prod-smoke.sh`
- [ ] Send **new** WhatsApp reply from phone; confirm `totalReceived` increments

### Phase 3 — Decommission GCP

- [ ] Keep GCP VM **stopped** 7 days (rollback)
- [ ] Revoke GCP VM GitHub deploy key
- [ ] Delete VM + disk after confidence
- [ ] Enable nightly `db:backup` → S3 on AWS

---

## 13. Rollback plan

If AWS fails within rollback window:

1. Start GCP VM (if stopped) or never stopped traffic until DNS flipped.
2. Point DNS back to **34.47.220.76**.
3. Restore Postgres from **pre-cutover dump** if AWS writes corrupted data (last resort).

**Avoid split-brain:** do not run both VMs as production with same DB live — pick one writer.

---

## 14. After cutover — backups & monitoring

| Task | Tool in repo / AWS |
|------|---------------------|
| DB backup before each deploy | `npm run db:backup` (already in `vps-deploy.sh`) |
| Scheduled backup | cron on AWS → dump → **S3** (encrypt bucket, lifecycle 14–30 days) |
| App health | `GET /health`, `GET /api/whatsapp/webhook/health` |
| Errors | `OPS_ERROR_LOG`, optional `SENTRY_DSN` |
| Disk alert | CloudWatch agent or simple cron `df` → email |

---

## 15. AWS MCP & Cursor — can the AI help on AWS?

**In this Cursor workspace today:** there is **no AWS MCP** pre-installed (unlike Render/Vercel plugins you may have). You can add one.

### Options (2026)

| Option | What it does | Good for |
|--------|----------------|----------|
| **[AWS MCP Server](https://aws.amazon.com/blogs/aws/the-aws-mcp-server-is-now-generally-available/)** (managed) | Tools like `call_aws`, AWS docs search, sandboxed Python against AWS APIs | Letting the agent create EC2, IAM, S3 **with your IAM guardrails** |
| **[MCP Proxy for AWS](https://github.com/aws/mcp-proxy-for-aws)** | Connects Cursor to remote AWS MCP with SigV4; read-only mode | Safer experimentation |
| **[awslabs aws-api-mcp-server](https://github.com/awslabs/mcp/tree/main/src/aws-api-mcp-server)** (open source, local) | `call_aws` / suggest AWS CLI commands via `uvx` | Full control on your laptop; uses your AWS credentials |

**Regions:** Managed AWS MCP Server expanded to several regions (e.g. Singapore, Tokyo, Ireland, London, Oregon) — API calls can still target **`ap-south-1`**. See [AWS announcement Oct 2026](https://aws.amazon.com/about-aws/whats-new/2026/10/aws-mcp-server-six-additional-regions/).

**Cost:** MCP server itself is **no extra charge**; you pay for EC2/S3/etc. the agent creates.

**Safety for you:**

- Use a **staging AWS account** or **read-only IAM** while learning.
- Enable **CloudTrail** so every API call is auditable.
- Do **not** give the agent root keys in chat; use IAM role + MCP Proxy read-only first.

**Example local MCP snippet (Cursor `mcp.json` — adjust region):**

```json
{
  "mcpServers": {
    "awslabs.aws-api-mcp-server": {
      "command": "uvx",
      "args": ["awslabs.aws-api-mcp-server@latest"],
      "env": {
        "AWS_REGION": "ap-south-1",
        "AWS_PROFILE": "samyoj-admin"
      }
    }
  }
}
```

After adding, restart Cursor; the agent can help run `describe-instances`, create security groups, etc., **under your approval prompts**.

---

## 16. Appendix — commands & references

### GCP (current) access

```bash
gcloud config set project project-cf2ff302-9e0b-42b0-a1b
gcloud compute ssh samyoj-server --zone=asia-south1-c
```

### Diagnostics snapshot (read-only)

```bash
# Inside VM
bash /home/samyoj/Samyoj/scripts/vm-diagnostics.sh > ~/vm-diagnostics-$(date +%Y%m%d).txt
```

### Production deploy (GCP today)

```bash
sudo -u samyoj bash /home/samyoj/Samyoj/scripts/vps-deploy.sh
```

### Repo files to read when implementing AWS

| File | Why |
|------|-----|
| `scripts/vps-deploy.sh` | Production deploy sequence |
| `scripts/vps-prod-smoke.sh` | Post-cutover verification |
| `config/ecosystem.config.js` | PM2 single process |
| `server/scripts/backup-database.ts` / `restore-database.ts` | Data move |
| `docs/deployment/DEPLOYMENT_GUIDE.md` | nginx, env groups, troubleshooting |
| `.cursor/rules/whatsapp-number-isolation.mdc` | Data scoping rules |

### Pricing sources (2026-10-12)

- AWS: `pricing.us-east-1.amazonaws.com` offer file for `ap-south-1` (EC2 + EBS gp3).
- GCP: Cloud Billing API SKUs for `asia-south1` E2 core/RAM + pd-balanced.

---

## Document maintenance

When cutover completes, update this file:

1. AWS instance id, Elastic IP, and `RELEASE.json` commit.
2. Date DNS switched.
3. Whether `samyojdatabase` was migrated or dropped.
4. Link to GitHub Actions workflow path once added.

**Owner sign-off:** _________________ **Date:** _________________
