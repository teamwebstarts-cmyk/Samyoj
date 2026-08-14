# Samyoj Deployment Log — 2026-08-15

> Code-update deploy of branch `call-ui-improvemnet` to GCE VM `samyoj-server` (`asia-south1-c`), live `https://app.samyoj.com`.
> This is **not** a first-time install. Billing TARGET catalog (`docs/billing/`) was **not** shipped as live checkout.

Earlier this calendar day a Codespace attempt was **blocked** (no GCP credentials / no SSH). Production was not mutated then. After `gcloud auth` on this Codespace, the deploy completed.

---

## FINAL STATUS

| Item | Value |
|------|--------|
| Deploy result | **SUCCESS** |
| Live URL | `https://app.samyoj.com` |
| Branch | `call-ui-improvemnet` |
| VM git SHA | **`92e2605`** (`92e2605ffba8f1ed114105f31f0e45f0c088131b`) — *Refactor ticket components for improved UI and functionality* |
| Previous prod SHA | `fa0cb5b` (2026-08-08) + 11 VM-only working-tree files |
| Local workspace SHA shipped | `92e2605` (matches `origin/call-ui-improvemnet`) |
| Production `.env` | **unchanged** (sha256 `dd42a999…8c807e25`). Webhook still `https://app.samyoj.com/api/whatsapp/webhook`. No ngrok/localhost. Local `.env` was **not** copied. |
| Billing TARGET catalog | **not shipped**. Live `plans.ts`: Starter Free / Growth ₹3,999 / Business ₹11,999 / Enterprise Custom |
| PM2 | `whatsapp-api` **online** only. Leftover `whatsapp-worker` **deleted** (workers embedded in API). |
| systemd `pm2-samyoj` | enabled + active (untouched; already reboot-safe) |
| Disk | cleaned 74% → **51%** (4.6G free) |

---

## Pre-deploy snapshot (2026-08-14 ~19:28 UTC)

| Item | Value |
|------|--------|
| SSH | `gcloud compute ssh samyoj-server --zone=asia-south1-c` as login user `codespace` → OK |
| App user / path | `samyoj` @ `/home/samyoj/Samyoj` |
| Node / npm | v20.20.2 / 10.8.2 |
| Git | `call-ui-improvemnet` @ `fa0cb5b` |
| Disk | 74% (2.5G free) — cleaned before build |
| PM2 | `whatsapp-api` + **`whatsapp-worker`** both online (6D uptime) |
| Health | `api`/`database`/`redis` ok |
| Public webhook health (old build) | `totalReceived: 22`, still leaked `webhookUrl` / `lastError` / `lastFbTraceId` |
| Prisma | 4 applied (`init`, `auth_email_verified`, `add_conversation_favorite`, `unique_whatsapp_phone_number_id`) |
| `.env` (safe) | `NODE_ENV=production`, URLs `https://app.samyoj.com`, `META_WEBHOOK_URL=https://app.samyoj.com/api/whatsapp/webhook`, Meta + Sarvam keys set, no `NGROK_AUTHTOKEN` |

### VM-only uncommitted files (inventoried **before** any overwrite)

Backed up to `/home/samyoj/backups/vm-only-20260815-1928/` (+ `working-tree.diff`). **Did not `git reset --hard`.**

| File | VM-only intent | Already in `92e2605`? |
|------|----------------|------------------------|
| `client/src/pages/RegisterPage.tsx` | skip email verification / auto-login | identical |
| `server/src/modules/ai/guardrails.ts` | `shouldEndVoiceCallOnHandoff` | identical |
| `server/src/realtime.ts` | Redis pub/sub bridge | identical |
| `server/src/modules/auth/routes.ts` | email verification disabled | yes (local had extra later commits) |
| `client/src/components/inbox/ChatThread.tsx` | hide `isCallSummary` bubbles | yes |
| `client/src/components/inbox/inboxUtils.ts` | `isAgentOnlyChatMessage` | yes |
| `client/src/types/index.ts` | `isCallSummary` | yes |
| `server/src/modules/ai/chatbot.service.ts` | no instant NO_KB_MATCH handoff | yes |
| `server/src/modules/calling/ai-voice-agent.ts` | call summary as internal note | yes |
| `server/src/modules/calling/settings.service.ts` | Sarvam STT lang fallback | yes |
| `server/src/modules/inbox/routes.ts` | filter legacy call-summary rows | yes |

Working tree was cleaned with `git checkout -- <those 11 files>` **after** the backup, then fast-forward pull. No VM-only semantic fix was dropped.

---

## Phase log

### Phase 0 — Snapshot
- Status: DONE. Public site 200; health ok; GCP account `nirbhayhiwse37@gmail.com`; project `project-cf2ff302-9e0b-42b0-a1b`.

### Phase 1 — Disk cleanup
- Status: DONE. `journalctl --vacuum-size=200M` (~472M), truncated syslog + ops-agent logs, `apt-get clean`.
- Result: **74% → 50%** (4.6G free). Post-build **51%**.

### Phase 2 — Backups
- Status: DONE.
  - `.env` copy: `/home/samyoj/backups/server.env.bak-20260814-193129` (chmod 600)
  - `pg_dump`: `/home/samyoj/backups/whatsapp_platform-20260814-193129.sql.gz` (43,731 bytes, gzip OK, 50 `CREATE TABLE`)
  - VM-only source: `/home/samyoj/backups/vm-only-20260815-1928/`

### Phase 3 — Sync code
- Status: DONE. `git fetch` + `git pull --ff-only origin call-ui-improvemnet` (`fa0cb5b` → `92e2605`).
- `.env` sha256 unchanged. `META_WEBHOOK_URL` still production HTTPS.

### Phase 4 — Install
- Status: DONE. `server` `npm ci` + `npx prisma generate` (Prisma 6.19.3). `client` `npm ci`.

### Phase 5 — Migrate
- Status: DONE. `npx prisma migrate deploy` applied **12** migrations. Schema up to date (16 total).
- `npm run db:validate-migration-chain` **exits 1** on this repo because historical `20260808120000_unique_whatsapp_phone_number_id` contains `DELETE FROM` (already applied 2026-08-08; **not** re-run).
- Pre-migrate isolation preflight **could not run** (script queries `contacts.whatsapp_number_id` before that column exists).
- Post-migrate preflight: **no blockers**, no review rows.
- Row counts unchanged (1 WhatsApp number, 3 contacts, 3 conversations, 36 messages, 1 campaign, 10 calls) — isolation did not need to clone contacts.
- **Not used:** `prisma migrate reset` / `migrate dev`.

Applied:

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

### Phase 6 — Build
- Status: DONE. Server `tsc` → `server/dist/index.js`. Client vite → `client/dist/assets/index-BJPYrl-b.js` (2.13 MB / 591 KB gzip). Benign Vite public-asset runtime-resolve warnings (same as 2026-08-08).

### Phase 7 — Restart
- Status: DONE. `pm2 delete whatsapp-worker`; `pm2 restart config/ecosystem.config.js --update-env`; `pm2 save`.
- Startup: embedded workers started (10 queues), WebSocket ready, Sarvam pre-warmed, `API server started` port 8000 `production`.
- `nginx -t` OK (existing harmless `:80` `server_name` conflict warning).

---

## Post-deploy verification

| Check | Result |
|-------|--------|
| `https://app.samyoj.com/` | **200**, bundle `assets/index-BJPYrl-b.js` |
| `https://app.samyoj.com/login` | **200** |
| `http://app.samyoj.com/` | **301** → `https://app.samyoj.com/` |
| `GET /health` (local + public) | `{"status":"ok","checks":{"api":"ok","database":"ok","redis":"ok"},"workersStarted":true}` |
| `GET /api/whatsapp/webhook/health` (local + public) | HTTP 200; `webhookConfigured: true`; **no** `webhookUrl` / `lastError` / `lastFbTraceId` (new `toPublicWebhookHealth`) |
| Webhook challenge (localhost, real token) | body `ping` |
| Webhook challenge (public, wrong token) | HTTP **403** |
| PM2 | `whatsapp-api` online; **no** `whatsapp-worker` |
| In-memory webhook counters | `totalReceived: 0` after restart — **not** proof inbound is dead. Last live inbound before this deploy was `2026-08-10T18:21:53Z` (`totalReceived: 22`). Prove with a **new** phone reply. |

---

## Leftover on VM (after deploy)

Untracked only (secrets; **do not commit**):

- `server/.env.bak-20260808-144316`
- `server/.env.bak-fullsync-20260808-180628`
- `server/.env.bak-metacreds-20260808-150400`
- `server/.env.bak-sarvam-20260808-180119`

Preserved off-tree: `/home/samyoj/backups/vm-only-20260815-1928/`, env bak, pg_dump.

Working tree has **no** remaining modified source files.

---

## What was NOT done (safety)

- No copy of local `server/.env` / ngrok / localhost into production
- No TARGET billing catalog as live checkout (`docs/billing/` is spec; `plans.ts` unchanged vs `fa0cb5b`)
- No `prisma migrate reset` / `migrate dev`
- No `git reset --hard`
- No force-push, no secrets committed, no git config changes
- No Meta App ID/Secret in Settings UI
- Did not claim customer-production-ready (auth still `localStorage` JWT, etc.)

---

## Errors / notes

1. `db:validate-migration-chain` always fails while the historical unique-phone `DELETE` file exists in `prisma/migrations`, even when that migration is already applied. Deploy used `prisma migrate deploy` after `pg_dump` + confirming that migration was already in `_prisma_migrations`.
2. Isolation preflight cannot run **before** `20260813230000` (missing `contacts.whatsapp_number_id`). Ran cleanly after migrate.
3. SMTP / Google OAuth still unset in prod `.env` (startup warnings only; email verification is already disabled in code).
4. Duplicate nginx `:80` `server_name` warning unchanged (harmless).
5. In-memory webhook counters reset on PM2 restart.

---

## Rollback

**Code** (schema stays new unless you restore the dump):

```bash
# VM-only patches from before this pull:
#   /home/samyoj/backups/vm-only-20260815-1928/
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && git checkout fa0cb5b'
# restore the 11 files from the vm-only backup if you need that exact tree
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj/server && npm ci && npx prisma generate && npm run build'
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj/client && npm ci && npm run build'
sudo -u samyoj bash -c 'cd /home/samyoj/Samyoj && pm2 restart config/ecosystem.config.js --update-env && pm2 save'
```

**Schema** (only if rolling back across the 12 migrations):

```bash
# /home/samyoj/backups/whatsapp_platform-20260814-193129.sql.gz
# gunzip -c <file> | psql "$DATABASE_URL"
```

Do **not** use the 2026-08-08 dump (`whatsapp_platform-20260808-144221.sql.gz`) for this rollback — it predates later production data.

Rolling back code to `fa0cb5b` **without** restoring the dump will break (new columns/tables the old code does not expect).
