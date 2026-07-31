# Dev Setup Checklist — Samyoj (Agent + Human)

> **Purpose:** Har baar app run / test karte waqt ye steps follow karo.  
> **Why:** Outbound WhatsApp localhost pe chal sakta hai; **inbound Inbox replies** ke liye public tunnel zaroori hai. Tunnel bhool gaye = `totalReceived: 0`.

---

## One-command mental model

```
Docker → API → Client → Tunnel (cloudflared) → API restart if .env changed → Test
```

---

## Full startup (copy-paste)

```bash
# 1) Infra
cd /workspaces/Samyoj && docker compose up -d

# 2) API (terminal A)
cd /workspaces/Samyoj/server && npm run dev

# 3) Client (terminal B)
cd /workspaces/Samyoj/client && npm run dev

# 4) Public webhook tunnel (terminal C) — REQUIRED for inbound
cd /workspaces/Samyoj && bash scripts/dev-tunnel.sh
# This updates META_WEBHOOK_URL + registers Meta webhook

# 5) Restart API after tunnel updates .env (so webhook URL reloads)
# Stop terminal A, then again:
cd /workspaces/Samyoj/server && npm run dev
```

Open: http://localhost:3000

---

## Quick health checks

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/whatsapp/webhook/health
# Expect: webhookUrl = current tunnel, after a phone reply totalReceived > 0
```

Tunnel verify (replace URL from `.env`):

```bash
WEBHOOK="$(grep '^META_WEBHOOK_URL=' server/.env | cut -d= -f2-)"
TOKEN="$(grep '^META_VERIFY_TOKEN=' server/.env | cut -d= -f2-)"
curl -s "${WEBHOOK}?hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=ping"
# Expect: ping
```

---

## Do / Don’t

| Do | Don’t |
|----|--------|
| Use `bash scripts/dev-tunnel.sh` for free inbound | Expect Inbox replies on localhost alone |
| Keep tunnel running while testing replies | Use free ngrok custom domain (`ERR_NGROK_313`) |
| Restart API after `META_WEBHOOK_URL` changes | Show App ID / App Secret / `.env` in Settings UI |
| Use Settings → **Connect WhatsApp** only | Re-add Meta credential forms for normal users |

---

## Platform Meta credentials (server only)

In `server/.env` (never in UI):

- `META_APP_ID`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `META_WEBHOOK_URL` (set by tunnel script)
- `META_REDIRECT_URI=http://localhost:3000/settings/whatsapp/callback`

---

## Symptom → fix

| Symptom | Fix |
|---------|-----|
| Send works, reply never in Inbox | Start/fix tunnel + setup-webhook + restart API |
| `totalReceived: 0` | Meta not hitting URL — dead tunnel / wrong `.env` |
| ngrok custom domain error | Use cloudflared `dev-tunnel.sh` |
| Connect asks for App ID | Bug — UI must only show Connect WhatsApp |

---

## Related

- Agent rule: `.cursor/rules/whatsapp-dev-setup.mdc` (always apply)
- Deep handoff: `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md`
