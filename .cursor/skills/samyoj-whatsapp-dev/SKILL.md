---
name: samyoj-whatsapp-dev
description: >-
  Run, debug, and harden Samyoj WhatsApp Cloud API local development: setup/start/stop
  scripts, ngrok-only inbound tunnels, Meta webhook registration, Connect WhatsApp
  OAuth (platform App ID only), and Inbox inbound failures (totalReceived: 0). Use when
  the user asks to run/restart/setup Samyoj, fix Inbox not receiving messages, configure
  Meta webhooks/tunnels, simplify WhatsApp Connect UX, or work on META_WEBHOOK_URL /
  META_APP_ID / ngrok.
---

# Samyoj WhatsApp + Local Dev

## Non-negotiables

1. **Normal users never see** Meta App ID, App Secret, `.env`, or Advanced credential override in UI.
2. Platform credentials live only in `server/.env` (`META_APP_ID`, `META_APP_SECRET`).
3. User flow = **Connect WhatsApp** → Facebook OAuth → pick number.
4. **Inbound needs a public HTTPS tunnel.** Outbound works on localhost without one.
5. Prefer infra fix over rewriting Inbox UI when replies are missing.
6. **Never invent** ngrok authtokens or Meta secrets. Ask the user. Do **not** fall back to Cloudflare.

## Run / restart checklist

Copy and track:

```
Samyoj run:
- [ ] bash setup.sh (first time) OR bash start.sh (daily)
- [ ] Docker Postgres + Redis up
- [ ] Tunnel URL written + META_WEBHOOK_URL set
- [ ] API healthy on :8000 WITH current webhook URL loaded
- [ ] Public challenge returns ping
- [ ] Client on :3000
- [ ] npm run setup-webhook succeeded (or number connected later)
```

### Commands

| Action | Command |
|--------|---------|
| First setup | `bash setup.sh` |
| Daily start | `bash start.sh` |
| Stop app | `bash stop.sh` |
| Stop + Docker | `bash stop.sh --all` |
| Tunnel only | `bash scripts/dev-tunnel.sh` |
| Register webhook | `cd server && npm run setup-webhook` |
| Health | `curl -s http://localhost:8000/api/whatsapp/webhook/health` |

`start.sh` must hard-fail if public webhook challenge is not `ping`. Do not claim success with empty `META_WEBHOOK_URL`.

Workers are **embedded in the API** (`startWorkers()` in `server/src/index.ts`). Do **not** also run `npm run dev:worker` in local dev — that duplicates consumers.

## Outbound vs inbound

| Direction | Tunnel? | Broken symptom |
|-----------|---------|----------------|
| Outbound Samyoj → phone | No | Send works on localhost |
| Inbound phone → Inbox | **Yes** | Send works, replies never appear; health `totalReceived: 0`, `webhookUrl: ""` |

## Inbox replies missing — diagnose first

When user says message receive nahi ho raha / Inbox empty for new replies:

1. `curl -s http://localhost:8000/api/whatsapp/webhook/health`
2. Expect non-empty `webhookUrl`, tunnel process alive (`.run/logs/tunnel.log`)
3. Confirm `META_WEBHOOK_URL` in `server/.env` matches live tunnel
4. Restart API after any `.env` webhook change (`start.sh` does this)
5. `cd server && npm run setup-webhook`
6. Ask user to send a **new** phone reply (old messages do not replay)
7. Prefer tunnel/webhook fix over Inbox UI changes

### Challenge verification (Codespace)

Shell `curl` may fail DNS for public tunnel hosts in Codespaces. Use Node `fetch`:

```bash
VERIFY_URL="$WEBHOOK_URL?hub.mode=subscribe&hub.verify_token=$META_VERIFY_TOKEN&hub.challenge=ping" \
node -e 'fetch(process.env.VERIFY_URL).then(r=>r.text()).then(console.log)'
```

Expect exact body: `ping`.

## Tunnel policy

`scripts/dev-tunnel.sh`:

1. **Always ngrok** — requires `NGROK_AUTHTOKEN` in `server/.env` or authtoken in `~/.config/ngrok/ngrok.yml`
2. If ngrok cannot start → **fail clearly** (no Cloudflare / cloudflared fallback)
3. Write `META_WEBHOOK_URL` **before** publishing `.run/tunnel-url` (avoid API race)
4. Then register webhook when possible

Avoid free ngrok reserved domain `samyoj-dev.ngrok-free.app` → `ERR_NGROK_313`. Use a random ngrok URL.

Do not use the vulnerable `ngrok` npm package; use the official ngrok CLI.

## Connect WhatsApp product rules

- Settings shows only **Connect WhatsApp** (no credential forms).
- Backend `resolveMetaCredentials()` uses platform `.env` by default.
- Do not re-add `MetaAppConfigModal` / App ID inputs unless user explicitly asks.
- Keep audit docs aligned: no “Advanced override” as current product behavior.

### Known security follow-ups (next hardening)

Prioritize before production:

1. Remove legacy `POST /whatsapp/connect` (raw token injection)
2. Unique DB constraint on `phoneNumberId` (cross-tenant webhook risk)
3. Stop putting Meta access token inside client-visible `pendingToken` JWT
4. Remove/lock down `/meta-config` override APIs for normal orgs
5. OWNER/ADMIN-only for connect/disconnect

## Setup script expectations

- Node **20.19+** (not 18)
- `npm ci` + Prisma `postinstall` generate
- Auto-generate `JWT_*`, `ENCRYPTION_KEY`, `META_VERIFY_TOKEN` if placeholders
- `ENCRYPTION_KEY` must be 64 hex chars or WhatsApp token encrypt fails
- Docker DB/Redis bound to `127.0.0.1`
- Baseline existing DB if `migrate deploy` hits P3005: `prisma migrate resolve --applied 20250617000000_init`

## Docs (source of truth)

- `docs/DEV_SETUP_CHECKLIST.md`
- `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md`
- `docs/audit/WHATSAPP_CONNECTION_FLOW_ANALYSIS.md`
- Always-apply rule: `.cursor/rules/whatsapp-dev-setup.mdc`

## Deeper reference

For incident history, file map, and competitor-flow notes, see [reference.md](reference.md).
