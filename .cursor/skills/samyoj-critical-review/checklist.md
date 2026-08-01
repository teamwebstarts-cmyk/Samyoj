# Samyoj Critical Review — Checklist

Use as a working sheet. Mark only after evidence.

## WhatsApp Connect

- [ ] Settings has no App ID / Secret / `.env` / Advanced override UI
- [ ] `MetaAppConfigModal` absent or unused
- [ ] `resolveMetaCredentials` falls back to platform env
- [ ] OAuth redirect URI comes from browser origin
- [ ] OAuth state signed, bound to user+org, expires
- [ ] Legacy `POST /whatsapp/connect` removed or admin-gated
- [ ] `/meta-config` removed or non-user-facing

## Inbound webhook

- [ ] Tunnel process running (ngrok or cloudflared)
- [ ] `META_WEBHOOK_URL` non-empty and matches tunnel
- [ ] API health `webhookUrl` matches `.env`
- [ ] Public challenge body is exactly `ping`
- [ ] `setup-webhook` succeeds for connected WABA
- [ ] New phone reply increments `totalReceived`
- [ ] `start.sh` fails closed without challenge success

## Dev setup

- [ ] Node ≥ 20.19 enforced
- [ ] `ENCRYPTION_KEY` 64 hex (auto-generated if placeholder)
- [ ] `npm ci` + Prisma generate on install
- [ ] Docker ports on `127.0.0.1`
- [ ] No fabricated `NGROK_AUTHTOKEN`
- [ ] cloudflared fallback only when ngrok unavailable
- [ ] Challenge verify uses Node fetch in Codespace

## Security / tenancy

- [ ] `phoneNumberId` unique in Prisma
- [ ] Webhook lookup cannot cross tenants on duplicates
- [ ] Pending OAuth token is opaque server-side (no Meta token in JWT)
- [ ] Meta `client_secret` not in URL query if avoidable
- [ ] Connect/disconnect require OWNER/ADMIN
- [ ] Unauthenticated `/webhook/health` does not over-expose internals (or is restricted)

## Auth (if in scope)

- [ ] Access/refresh not solely in localStorage long-term plan documented
- [ ] Refresh rotation / reuse detection
- [ ] Brute-force / lockout
- [ ] Email verification policy clear

## Tests / docs drift

- [ ] Vitest includes only `src/**/*.test.ts` (not `dist`)
- [ ] Audit docs do not advertise removed MetaAppConfig Advanced UI
- [ ] FEATURE_MATRIX marks legacy APIs honestly

## Quick verify commands

```bash
bash -n setup.sh start.sh stop.sh scripts/dev-tunnel.sh
docker compose config --quiet
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/whatsapp/webhook/health
cd server && npm test
cd server && npm run build
cd client && npm run build
```

Webhook challenge (Codespace-safe):

```bash
node -e 'fetch(process.env.U).then(r=>r.text()).then(console.log)' \
  # with U="<META_WEBHOOK_URL>?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=ping"
```
