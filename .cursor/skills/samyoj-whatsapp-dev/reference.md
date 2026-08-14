# Samyoj WhatsApp Dev — Reference

## Why inbound breaks repeatedly

Meta POSTs webhooks only to a **public HTTPS** URL. Localhost is invisible to Meta.

Typical failure chain:

1. Tunnel not started / ngrok unauthenticated (`ERR_NGROK_4018`)
2. `META_WEBHOOK_URL` empty or stale
3. API started **before** `.env` update → in-memory `config.meta.webhookUrl` wrong
4. Webhook not registered with Meta (`setup-webhook`)
5. Agent/manual start of API+client **without** tunnel → UI looks healthy, Inbox dead

Health signal:

```json
{ "totalReceived": 0, "webhookConfigured": true }
```
Tunnel URL lives in `server/.env` `META_WEBHOOK_URL`, not in this public JSON.

## Runtime layout

| Piece | Port / artifact | Notes |
|-------|-----------------|-------|
| Client (Vite) | `:3000` | Proxies `/api` → `:8000` |
| API (Express) | `:8000` | Embeds BullMQ workers |
| Postgres | `127.0.0.1:5432` | Docker |
| Redis | `127.0.0.1:6379` | Docker + queues |
| Tunnel | `.run/tunnel-url` | Updates `META_WEBHOOK_URL` |
| Logs / PIDs | `.run/logs/`, `.run/*.pid` | Managed by start/stop |

## Key files

| Path | Role |
|------|------|
| `setup.sh` | First-time deps, secrets, docker, then `start.sh` |
| `start.sh` | Docker → tunnel → API (after URL) → challenge → client |
| `stop.sh` | Stop client/api/tunnel; `--all` also docker |
| `scripts/dev-tunnel.sh` | ngrok only + env + setup-webhook (fails if auth missing) |
| `server/scripts/setup-webhook.ts` | Register callback with Meta |
| `server/src/modules/whatsapp/org-meta.service.ts` | Platform credential resolve/sanitize |
| `server/src/modules/whatsapp/routes.ts` | OAuth, webhook GET/POST, health |
| `server/src/workers/webhook.processor.ts` | Persist inbound + emit socket |

## Connect flow (normal user)

1. Settings → Connect WhatsApp
2. Client requests `/api/whatsapp/connect-url` (browser-origin redirect URI)
3. Meta OAuth popup
4. Callback → exchange code → encrypt token → save number
5. Async webhook registration / WABA subscribe

Platform `META_APP_ID` appears in Facebook authorize URL as `client_id` (unavoidable). It must not appear as an editable Settings field.

## Competitor UX lesson

Interakt / Wati / AiSensy style: user never enters App ID/Secret. Platform Meta app owns OAuth. Samyoj matches that for product UX.

## Codespace notes

- Port “Public” via `gh codespace ports` is flaky; prefer tunnel scripts.
- `curl` may fail public tunnel DNS in Codespaces; Node `fetch` often works.
- `setup-webhook.ts` retries reachability and is a good secondary verifier.

## Do / Don’t

| Do | Don’t |
|----|--------|
| Use `bash start.sh` for full stack | Start only client/server and assume inbound works |
| Keep tunnel alive while testing replies | Point Meta at a dead tunnel URL |
| Restart API after webhook URL change | Share real `.env` secrets in chat/docs |
| Fix tunnel when `totalReceived: 0` | Rebuild Inbox UI first |
| Ask for real `NGROK_AUTHTOKEN` once | Fabricate authtokens |

## Related audit leftovers

- Legacy `/whatsapp/connect` and `/meta-config` still exist server-side — remove in security hardening pass.
- Auth deep review lives in `docs/audit/AUTH_DEEP_REVIEW.md` (separate from WhatsApp inbound).
