# Phase A0 — Meta Dashboard checklist (manual)

Complete **before** customer E2E on a live Meta app.

## Facebook Login for Business → Configurations

1. Create **Embedded Signup v4** configuration (standard Cloud API onboarding).
2. Copy **Configuration ID** → `META_ES_CONFIG_ID` in `server/.env`.
3. (Phase B) Create second configuration with **WhatsApp Business app onboarding** enabled → `META_ES_COEX_CONFIG_ID`.

## App webhooks (App Dashboard → WhatsApp → Configuration)

Subscribe fields:

- `messages`, `calls` (existing)
- `account_update` (ES lifecycle + coexistence offboard)
- Phase B: `history`, `smb_message_echoes`, `smb_app_state_sync`

Callback URL: `META_WEBHOOK_URL` (HTTPS tunnel in dev).

## App Review

- **Advanced access** for `whatsapp_business_management` and `whatsapp_business_messaging`.
- Without Advanced access, live customer grants fail with OAuth/API errors.

## Env vars (server `.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `META_APP_ID` | yes | Platform app (never shown in Settings UI) |
| `META_APP_SECRET` | yes | Token exchange + webhook HMAC |
| `META_ES_CONFIG_ID` | yes (Phase A) | ES v4 standard connect `config_id` |
| `META_ES_COEX_CONFIG_ID` | Phase B | Coexistence / Business app onboarding |
| `META_VERIFY_TOKEN` | yes | Webhook challenge |
| `META_WEBHOOK_URL` | yes (inbound) | Public HTTPS `/api/whatsapp/webhook` |
| `META_API_VERSION` | optional | Default `v21.0` |

## Tech Provider

Confirm Tech Provider status per `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md`.

## Client (no secrets)

- Load Facebook JS SDK with `META_APP_ID` from connect-url API response only.
- Users never enter App ID/Secret in Settings.
