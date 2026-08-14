# Samyoj Deployment Log — 2026-08-15

> Intended: code-update deploy of branch `call-ui-improvemnet` to GCE VM `samyoj-server` (`asia-south1-c`), live `https://app.samyoj.com`.
> This is **not** a first-time install. Billing TARGET catalog was **not** to be shipped as product code.
> **Result: BLOCKED before any VM mutation.** Production left untouched.

---

## FINAL STATUS

| Item | Value |
|------|--------|
| Deploy result | **FAIL / blocked** — no SSH to the VM |
| Live URL | `https://app.samyoj.com` (still the 2026-08-08 build) |
| Git SHA on VM | **unknown this session** (last recorded: `fa0cb5b` + later uncommitted VM drift; could not re-verify) |
| Local workspace SHA intended to ship | `3290011` (`call-ui-improvemnet`, matches `origin/call-ui-improvemnet`) |
| Migrations applied | **none** (did not reach the VM) |
| Production `.env` | **not read, not written** |
| Billing TARGET catalog | **not deployed** (and was never going to be; live `plans.ts` still Growth ₹3999 / Business ₹11999) |

---

## Job 1 (memory) — done in this Codespace

Cursor rules (not a copy of the 19 billing docs):

- Created: `.cursor/rules/billing-research.mdc` (`alwaysApply: true`)
- Pointer added (≤5 lines) in `.cursor/rules/whatsapp-dev-setup.mdc`
- Pointer added in `.cursor/rules/session-memory.mdc`

Canonical pack remains `docs/billing/` (README = index). Current-code audit: `docs/audit/BILLING_SYSTEM_REVIEW.md`.

---

## Phase 0 — Snapshot (what could be captured without SSH)

### Public live checks (2026-08-14 ~19:12 UTC)

| Check | Result |
|-------|--------|
| `https://app.samyoj.com/` | **200** |
| `https://app.samyoj.com/login` | **200** |
| `http://app.samyoj.com/` | **301** → `https://app.samyoj.com/` |
| `GET https://app.samyoj.com/health` | `{"status":"ok","checks":{"api":"ok","database":"ok","redis":"ok"},"version":"1.0.0"}` |
| `GET /api/whatsapp/webhook/health` (public) | HTTP 200. `totalReceived: 22`, `totalProcessed: 22`, `totalErrors: 0`, `lastReceivedAt: 2026-08-10T18:21:53.398Z`, `verifyTokenConfigured: true`, `appSecretConfigured: true` |
| Webhook challenge with wrong token | HTTP **403** `Forbidden — verify_token mismatch` (endpoint alive) |

**Note:** live public webhook health still returns `webhookUrl`, `lastError`, `lastFbTraceId`. Current local code (`toPublicWebhookHealth`) strips those. That difference is evidence production is still on the 2026-08-08 tree (plus later VM-only patches), not this workspace.

### Local git (this Codespace)

| Item | Value |
|------|--------|
| Branch | `call-ui-improvemnet` tracking `origin/call-ui-improvemnet` |
| HEAD | `3290011` — *Add remaining billing research docs through implementation blueprint.* |
| Commits since last known prod SHA `fa0cb5b` | **108** |
| Prisma migrations **not** on the 2026-08-08 deploy | 12 files (campaign safety/boundaries, webhook idempotency, WhatsApp number isolation + reconcile, conversation charges by phone, contact custom attributes, webhook durability) |
| Billing product code vs `fa0cb5b` | `plans.ts` **unchanged** (old one-shot prices). Only `usage.service.ts` (+2/−1) in `server/src/modules/billing` |
| Uncommitted on local | `client/src/components/inbox/ConversationItem.tsx` (1 line deleted) — not part of this blocked deploy |

### VM (could not capture)

Could not run: disk `df`, `pm2 list`, `git status` / SHA on `/home/samyoj/Samyoj`, nginx, or `.env` key inventory.

Last known from `docs/deployment/DEPLOY_LOG_2026-08-08.md` (do not treat as re-verified today):

- Path `/home/samyoj/Samyoj`, user `samyoj`
- Branch `call-ui-improvemnet` @ `fa0cb5b` plus **VM-only** working-tree drift: email verification skip, Redis realtime bridge, Sarvam env, later call/inbox patches
- PM2 then ran **both** `whatsapp-api` and `whatsapp-worker`. Current repo embeds workers in the API (`config/ecosystem.config.js`); a future successful deploy must `pm2 delete whatsapp-worker` so there is not a second BullMQ consumer
- Production webhook: `https://app.samyoj.com/api/whatsapp/webhook` (messages + calls), **not** localhost/ngrok

Email-verification skip and Redis realtime **are already in this workspace** (`server/src/modules/auth/routes.ts`, `client/src/pages/RegisterPage.tsx`, `server/src/realtime.ts`). A future rsync/git sync should still **diff VM vs local** before overwrite — do **not** `git reset --hard` on the VM until that inventory exists.

---

## Phase 1 — Access attempt

1. `gcloud` was **not installed** in this Codespace (`command not found`). `~/.config/gcloud` from the 2026-08-08 session is **gone**.
2. Installed Google Cloud SDK **580.0.0** to `/home/codespace/google-cloud-sdk`.
3. `gcloud auth list` → **No credentialed accounts.**
4. `gcloud auth print-access-token` → *You do not currently have an active account selected.*
5. Direct SSH: `samyoj@34.47.220.76` and `codespace@34.47.220.76` → **Permission denied (publickey)**. No `~/.ssh/id_*` or `google_compute_engine` key.
6. No GCP service-account JSON in the workspace. Local `server/.env` has no `GOOGLE_APPLICATION_CREDENTIALS`. No `CLOUDSDK_AUTH_ACCESS_TOKEN`.
7. GitHub CLI is authed as `Nir-Bhay`; that does **not** grant GCE SSH. CI workflow is GitHub-hosted tests only (no deploy job).

**Exact blocker:** this environment has the `gcloud` CLI but **zero GCP user/ADC credentials**, so `gcloud compute ssh samyoj-server --zone=asia-south1-c` cannot run. Did not invent access. Did not change the VM.

### How to unblock (human, this Codespace)

```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
gcloud auth login          # browser / --no-launch-browser
gcloud config set project project-cf2ff302-9e0b-42b0-a1b
gcloud compute ssh samyoj-server --zone=asia-south1-c --command='whoami'
```

Or export a short-lived `CLOUDSDK_AUTH_ACCESS_TOKEN` from a machine that is already logged in as the project owner. Then re-run the 2026-08-15 code-update procedure (snapshot → preserve VM-only files → rsync/pull **without** copying local `.env` → `pg_dump` → `prisma migrate deploy` → build → PM2 API-only → webhook verify).

---

## What was NOT done (safety)

- No `git reset --hard` on the VM
- No copy of local `.env` / ngrok / localhost URLs into production
- No TARGET billing catalog implementation (`docs/billing/` is spec only)
- No `prisma migrate deploy` / `migrate dev` / `reset`
- No password resets
- No Meta App ID/Secret in Settings UI
- No secrets committed
- No git config changes, no force-push

---

## What a successful retry should ship (application code, not billing spec)

Bring this workspace (`3290011` + confirm VM-only leftovers) onto `/home/samyoj/Samyoj` **excluding** `server/.env`, `node_modules`, and `dist`. Then:

- `npm ci` (server + client), `prisma generate`, **backup then** `prisma migrate deploy` (12 pending since 2026-08-08; isolation migration `20260813230000` clones contacts — backup first)
- Build client + server
- PM2: **`whatsapp-api` only**; delete leftover `whatsapp-worker`
- Confirm `META_WEBHOOK_URL=https://app.samyoj.com/api/whatsapp/webhook`; re-check Graph subscription fields `messages` + `calls`
- Do **not** change Razorpay plan prices

### Migrations that would apply (after `pg_dump`)

- `20260808235900_campaign_safety`
- `20260809001500_campaign_phase1_boundaries`
- `20260809003000_campaign_provider_call_boundary`
- `20260809004500_campaign_quota_run_ownership`
- `20260811000000_campaign_provider_status_ordering`
- `20260811170000_webhook_idempotency`
- `20260813230000_whatsapp_number_data_isolation`
- `20260814001500_whatsapp_relationship_safety`
- `20260814013000_reconcile_whatsapp_schema`
- `20260814130000_scope_conversation_charges_by_phone`
- `20260814143000_contact_custom_attributes`
- `20260814220000_webhook_durability`

---

## Rollback

**Not applicable — production was not changed.**

If a later session does complete the deploy, rollback of **code** (not schema) would be:

```bash
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && git checkout fa0cb5b'
# restore any VM-only files inventoried before overwrite
# then npm ci + prisma generate + build client/server + pm2 restart config/ecosystem.config.js
```

Schema rollback after the 12 migrations would need the `pg_dump` taken **immediately before** `migrate deploy` (restore: `gunzip -c <backup>.sql.gz | psql "$DATABASE_URL"`). Last known backup from 2026-08-08: `/home/samyoj/backups/whatsapp_platform-20260808-144221.sql.gz` (too old for a 2026-08-15 schema rollback).
