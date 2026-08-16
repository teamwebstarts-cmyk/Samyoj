# Dev Setup Checklist — Samyoj (Agent + Human)

> **Purpose:** Har baar app run / test karte waqt ye steps follow karo.  
> **Why:** Outbound WhatsApp localhost pe chal sakta hai; **inbound Inbox replies** ke liye public tunnel zaroori hai. Tunnel bhool gaye = `totalReceived: 0`.

---

## One-command setup (first time)

```bash
bash setup.sh
# Installs deps, configures .env, starts Docker + API + Client + Admin + tunnel
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
2. ✅ Copies `.env.example` → `.env` (server, client, admin) and generates local JWT/encryption secrets  
3. ✅ Uses ngrok config/`NGROK_AUTHTOKEN`, or securely prompts once  
4. ✅ Starts Docker (Postgres + Redis) + waits for ready  
5. ✅ `npm ci` (server + client + admin)  
6. ✅ Prisma migrate  
7. ✅ Starts public tunnel before API (ngrok only — no Cloudflare fallback)  
8. ✅ Verifies public webhook challenge (`ping`) before claiming success  
9. ✅ Registers Meta webhook when a WhatsApp number is connected  
10. ✅ Starts API `:8000` + Client `:3000` + Admin `:3001`  

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
- `PLATFORM_ADMIN_URL` (admin origin for `/api/platform` CORS; local `http://localhost:3001`)
- `META_REDIRECT_URI=http://localhost:3000/settings/whatsapp/callback`

First platform operator (once): `cd server && PLATFORM_OPERATOR_PASSWORD='ChooseAStrongPass1' npm run platform:bootstrap-operator -- --email you@samyoj.com` then open `http://localhost:3001`.

---

## Quick health checks

```bash
curl -s http://localhost:8000/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001
curl -s http://localhost:8000/api/whatsapp/webhook/health
# Expect: HTTP 200, verifyTokenConfigured/appSecretConfigured booleans, webhookConfigured true when META_WEBHOOK_URL is set.
# The live tunnel URL is not in this public JSON — read it from server/.env META_WEBHOOK_URL.
# After a phone reply: totalReceived > 0
```

---

## Optional: Doppler secrets layer

`server/.env` is the source of truth for local dev and works standalone. Doppler is an **optional** layer on top — inject secrets from Doppler instead of `.env`.

```bash
bash scripts/doppler-setup.sh        # install CLI, login, link project, push .env secrets
cd server && npm run dev:doppler      # run API with Doppler secrets
# or: USE_DOPPLER=1 bash start.sh     # full stack with Doppler for the API
```

- Doppler values take **precedence**; anything not in Doppler falls back to `server/.env` (dotenv never overrides existing env vars).
- `META_WEBHOOK_URL` stays dynamic — the tunnel re-writes it each start, so it is excluded from the Doppler push.
- Manage secrets at https://dashboard.doppler.com.

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
