# Dev Setup Checklist — Samyoj (Agent + Human)

> **Purpose:** Har baar app run / test karte waqt ye steps follow karo.  
> **Why:** Outbound WhatsApp localhost pe chal sakta hai; **inbound Inbox replies** ke liye public tunnel zaroori hai. Tunnel bhool gaye = `totalReceived: 0`.

---

## One-command setup (first time)

```bash
bash setup.sh
# Installs deps, configures .env, starts Docker + API + Client + tunnel
```

## Quick start (after first setup)

```bash
bash start.sh    # start all
bash stop.sh     # stop all
bash stop.sh --all # also stop Postgres + Redis
```

---

## What setup.sh does automatically

1. ✅ Prereqs check (Node 20.19+, Docker, npm, official ngrok CLI)  
2. ✅ Copies `.env.example` → `.env` and generates local JWT/encryption secrets  
3. ✅ Uses ngrok config/`NGROK_AUTHTOKEN`, or securely prompts once  
4. ✅ Starts Docker (Postgres + Redis) + waits for ready  
5. ✅ `npm install` (server + client)  
6. ✅ Prisma migrate  
7. ✅ Starts public tunnel before API (ngrok preferred, Cloudflare fallback)  
8. ✅ Verifies public webhook challenge (`ping`) before claiming success  
9. ✅ Registers Meta webhook when a WhatsApp number is connected  
10. ✅ Starts API + Client  

---

## Do / Don't

| Do | Don't |
|----|--------|
| Use `bash setup.sh` first time | Manually install deps every time |
| Use `bash start.sh` after setup | Use free ngrok custom domain (`ERR_NGROK_313`) |
| Keep tunnel running while testing replies | Show App ID / App Secret / `.env` in Settings UI |
| Use Settings → **Connect WhatsApp** only | Re-add Meta credential forms for normal users |

---

## Platform Meta credentials (server only)

In `server/.env` (never in UI):

- `META_APP_ID`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `NGROK_AUTHTOKEN` (required for inbound tunnel; or ngrok already authenticated locally)
- `META_WEBHOOK_URL` (set by tunnel script)
- `META_REDIRECT_URI=http://localhost:3000/settings/whatsapp/callback`

---

## Quick health checks

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/whatsapp/webhook/health
# Expect: webhookUrl = current tunnel, after a phone reply totalReceived > 0
```

---

## Symptom → fix

| Symptom | Fix |
|---------|-----|
| Send works, reply never in Inbox | Start/fix tunnel + setup-webhook + restart API |
| `totalReceived: 0` | Meta not hitting URL — dead tunnel / wrong `.env` |
| ngrok custom domain error | Use ngrok authtoken + `setup.sh` |
| Connect asks for App ID | Bug — UI must only show Connect WhatsApp |

---

## Related

- Agent rule: `.cursor/rules/whatsapp-dev-setup.mdc` (always apply)
- Scripts: `setup.sh`, `start.sh`, `stop.sh` (project root)
- Tunnel: `scripts/dev-tunnel.sh`
