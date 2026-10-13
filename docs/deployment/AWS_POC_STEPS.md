# Samyoj — GCP → AWS minimal migration (POC)

> **Decision (13 Oct 2026):** Migrate. Developer testing, so we move **only what the app needs to boot and show the same inbox**. No extra services (no RDS, no Redis Cloud, no load balancer).  
> **POC rule:** `app.samyoj.com` stays on Google Cloud until the AWS box passes a smoke test. DNS is the last step, and only after you say go.  
> **Who is who:** **You** = account owner (IAM, secrets, DNS, phone test). **Agent** = Cursor + AWS MCP + GCP SSH.

Live snapshot used for this plan: 11 orgs, 11 users, 1 active WhatsApp number, 6 contacts, 5 chats, 17 messages, 1 AI bot, 2 knowledge items, uploads ~3.6 MB. Billing rows are empty. There is **no industry field** in the database.

---

## Why we dump the whole database (this *is* minimal)

Cherry-picking tables breaks foreign keys (a message needs a conversation, which needs a contact, which needs an org). The database is tiny, so the smallest safe move is:

| Move | Skip |
|------|------|
| Postgres database `whatsapp_platform` (one `pg_dump`) | Redis (queues rebuild) |
| `server/.env` (secrets, copied, never committed) | `.git`, TypeScript `src`, `node_modules` |
| `server/uploads/` (~3.6 MB) | Logs, old SSL keys |
| | Extra DB `samyojdatabase` (app code does not use it) |

---

## Picture

```text
YOU                          AGENT
 │                             │
 │ 1. IAM write + "go"         │
 ├────────────────────────────►│ 2. Create Mumbai VM + lock ports
 │                             │ 3. Dump GCP DB + copy .env + uploads
 │                             │ 4. Install Node/Postgres/Redis/nginx
 │                             │ 5. Restore DB, start app on the new IP
 │ 6. Open http://NEW_IP/health│
 │ 7. Say "DNS go" or "stop"   │
 └────────────────────────────►│ 8. Only then: app.samyoj.com → AWS
```

---

## Step 0 — You (before anything is created)

Do these in the AWS console. MCP cannot grant itself more power.

| # | You do this | Done when |
|---|-------------|-----------|
| 0.1 | IAM user `nirbhayhiwse37@gmail.com` (account `157328692150`) can **create** EC2 in `ap-south-1`. Fast path: attach **PowerUserAccess** for the POC week, remove it after. | A test create would not return `AccessDenied` |
| 0.2 | Billing alarm around **₹5,000 / month** (console → Billing → Budgets). Expected POC box is about **₹3,000/month** if left running. | Email alarm exists |
| 0.3 | Reply in chat: **`POC start`** | Agent starts Step 1 |

You do **not** paste `.env`, access keys, or the database password into chat. The agent copies them server-to-server over SSH.

---

## Step 1 — Agent: empty AWS machine (no DNS)

Region **Mumbai `ap-south-1`**. Name **`samyoj-poc`**.

| What | Setting |
|------|---------|
| Type | `t3.medium` (2 vCPU, 4 GB) — same class as GCP `e2-medium` |
| Disk | 30 GB gp3, encrypted |
| OS | Debian 13 |
| Public ports | **80 and 443 only** |
| SSH from the internet | **closed** — enter with AWS Session Manager |
| App / Postgres / Redis | listen on **127.0.0.1** only |
| Elastic IP | one new address (GCP `34.47.220.76` is untouched) |

**You learn:** a security group is the cloud firewall. Closing port 22 and 8000 is the main difference from the current GCP box.

**Proof:** agent pastes instance id + Elastic IP. You can see the instance in the AWS console. `app.samyoj.com` still opens the old GCP site.

---

## Step 2 — Agent: copy only the important bits from GCP

On `samyoj-server` (GCP), short read, no downtime yet:

1. `pg_dump` of `whatsapp_platform` (custom format).
2. Secure copy of `server/.env` onto the AWS box, mode `600`.
3. Copy `server/uploads/` (3.6 MB).
4. Do **not** copy `.git` or `server/src`.

GCP app **keeps running** during the POC. The dump is a snapshot; new test messages after the dump exist only on GCP until a final dump at DNS time.

---

## Step 3 — Agent: install the same stack, not the same disk

On the AWS box:

| Piece | Version target |
|-------|----------------|
| nginx | reverse proxy → `127.0.0.1:8000` |
| PostgreSQL | 17 |
| Redis | 8 (empty is fine) |
| Node | 20 |
| PM2 | **only** `whatsapp-api` (workers live inside the API) |

Then:

1. `pg_restore` into `whatsapp_platform`.
2. Put `.env` in place. Change nothing except what must point at this machine (`DATABASE_URL` host stays `localhost`).
3. Deploy **built** app from GitHub commit (prefer latest `main` if you want newest code; POC can also match GCP commit `08d4a367` so we know failures are infra, not code). **Default for POC: same commit as GCP (`08d4a367`)** so we test the move, not a new release.
4. No GitHub key left on the server.

---

## Step 4 — Proof the POC works (you + agent)

GCP DNS is still live. We test AWS by **IP** or a one-off curl.

| Check | Who | Pass looks like |
|-------|-----|-----------------|
| `curl http://127.0.0.1:8000/health` on the box | Agent | `"status":"ok"`, database ok, redis ok, `workersStarted: true` |
| Org count after restore | Agent | **11** organizations |
| Message count | Agent | **17** (or higher if we re-dump) |
| Active WhatsApp numbers | Agent | **1** |
| Login page via Elastic IP (HTTP) | You, in browser | Samyoj login HTML loads |
| You log in with an existing test user | You | Same org / inbox as GCP |

**WhatsApp replies will still hit GCP** until DNS moves, because Meta calls `https://app.samyoj.com`. That is expected for the POC. Do not treat “phone reply missing on AWS” as a failure yet.

**Stop here if health or login fails.** GCP is still production-for-testing. Nothing to roll back except deleting the AWS instance.

---

## Step 5 — You decide

| You say | What happens |
|---------|----------------|
| **`POC stop`** | Agent terminates `samyoj-poc` and releases the Elastic IP. GCP unchanged. |
| **`DNS go`** | Real cutover (Step 6). Short maintenance. |

---

## Step 6 — Cutover (only after `DNS go`)

| # | Who | Action |
|---|-----|--------|
| 6.1 | You | Lower DNS TTL to 300 seconds a few hours ahead (if you control DNS). |
| 6.2 | Agent | Stop GCP `whatsapp-api` so no new writes. |
| 6.3 | Agent | Final `pg_dump` + restore (picks up messages since Step 2). |
| 6.4 | Agent | Certbot for `app.samyoj.com` and `admin.samyoj.com` **after** DNS points at AWS (or use a temporary cert check). |
| 6.5 | You | Change **A record** of `app.samyoj.com` and `admin.samyoj.com` from `34.47.220.76` to the **new Elastic IP**. |
| 6.6 | Agent | `scripts/vps-prod-smoke.sh` style checks: health, webhook challenge returns `ping`. |
| 6.7 | You | Send **one new WhatsApp reply** to the business number. Agent confirms `totalReceived` went up. |
| 6.8 | Agent | Leave GCP VM **stopped** for 7 days, then delete only if you say so. |

Webhook URL stays `https://app.samyoj.com/api/whatsapp/webhook`. Meta does not need a new URL if the hostname is unchanged.

---

## What you will learn, mapped to steps

| Idea | Where you see it |
|------|------------------|
| Cloud firewall | Step 1 security group |
| Data vs code | Step 2 dump vs Step 3 build |
| Secrets never in git/chat | Step 2 `.env` copy |
| Proof before customers move | Step 4 IP test |
| DNS is the switch | Step 6 |

---

## Cost of leaving the POC on

About **$35 / month (~₹3,000)** if `t3.medium` + 30 GB stays running. Stop or terminate the instance when you are not testing. GCP and AWS both bill if both VMs are on.

---

## Current status

| Item | State |
|------|--------|
| AWS MCP | Connected, account `157328692150` |
| Mumbai EC2 | **`samyoj-poc`** `i-085ca1949bb94e621` · `t3.medium` · Debian 12 · key `samyoj-poc-bootstrap` |
| Elastic IP | **`3.108.25.94`** |
| Security group | `sg-053a33215e0d0477a` — **80, 443** public; **22 only** from the Codespace IP (temporary) |
| App on AWS | **Running.** Health ok. DB restored: 11 orgs, 17 messages, 1 WhatsApp number. No `.git`, no `server/src`. |
| POC URL | `http://3.108.25.94/` (HTTP only — DNS not moved) |
| GCP `app.samyoj.com` | **Still live** |

**Your next (Step 4 preview):** when agent says ready, open `http://3.108.25.94/` and try login.
