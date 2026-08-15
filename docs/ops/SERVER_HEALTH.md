# Server health runbook

Live: `https://app.samyoj.com`. VM `samyoj-server` / `asia-south1-c`. App user `samyoj`, path `/home/samyoj/Samyoj`.

This is **ops**, not a claim that customer production is complete.

## Quick checks

```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
gcloud compute ssh samyoj-server --zone=asia-south1-c
```

On the VM:

```bash
# API + DB + Redis + embedded workers
curl -sS http://127.0.0.1:8000/health

# Public webhook health (no URL / no error text)
curl -sS https://app.samyoj.com/api/whatsapp/webhook/health

# Challenge (expect body: ping)
TOKEN=$(sudo -u samyoj grep ^META_VERIFY_TOKEN= /home/samyoj/Samyoj/server/.env | cut -d= -f2-)
curl -sS "http://127.0.0.1:8000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=ping"

# Recent Meta POSTs
sudo grep "POST /api/whatsapp/webhook" /var/log/nginx/access.log | tail -20

# PM2
sudo -u samyoj pm2 status
sudo -u samyoj pm2 logs whatsapp-api --lines 80
```

Webhook URL in production `.env` must stay `https://app.samyoj.com/api/whatsapp/webhook` (host `app.samyoj.com` only). Never ngrok.

## Error tracking

- **Sentry:** `server/src/config/sentry.ts`. If `SENTRY_DSN` is unset, Sentry stays off — do not invent a DSN.
- **Durable ops log:** `/home/samyoj/Samyoj/.run/logs/ops-errors.log` (JSON, error-level Winston). Rotate at 5 MB × 3 files.
- **DB receipts:** `provider_webhook_events` — one `RECEIVED` row per Meta POST (`receipt:<requestId>`).
- **Admin API:** `GET /api/ops/recent-errors` (OWNER/ADMIN JWT). Returns recent log lines, webhook receipts, failed/missed calls. No tokens or phone numbers.

```bash
sudo -u samyoj tail -n 50 /home/samyoj/Samyoj/.run/logs/ops-errors.log
```

## If Inbox is silent / AI does not reply / calls keep ringing

1. Nginx must show **new** `POST /api/whatsapp/webhook` from `facebookexternalua` when you message or call.
2. If there are no POSTs: re-run `cd /home/samyoj/Samyoj/server && npx tsx scripts/setup-webhook.ts` on the VM (pins app callback + WABA override to `app.samyoj.com`). Confirm subscribed fields include `messages` and `calls`.
3. If POSTs are 200 but Inbox empty: workers must be **inside** `whatsapp-api` (`workersStarted: true`). Do not start `whatsapp-worker`.
4. AI chat skip: `bot_active` must be true. Stale `bot_handoff_at` no longer blocks the bot when `bot_active` is true. Human-assigned non-OPEN chats stay skipped.
5. Inbound call ringing: Meta `calls` connect webhook → inline `processWebhookFields` → WebRTC answer → Graph `pre_accept` + `accept` with sanitized SDP (`SHA-256`, `a=setup:active`, single audio m-line). Check PM2 for `Meta call action failed` / `Failed to start AI voice session`.

## Do not

- Wipe Postgres
- Copy a local `.env` over production
- Point the webhook at ngrok
- `git reset --hard`
