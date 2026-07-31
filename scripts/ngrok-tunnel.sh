#!/usr/bin/env bash
# =============================================================================
# ngrok Tunnel Starter — Samyoj WhatsApp Platform
# =============================================================================
# Exposes localhost:8000 via a stable HTTPS URL so Meta can deliver webhooks.
#
# Prerequisites:
#   1. ngrok installed (brew install ngrok / choco install ngrok / apt install ngrok)
#   2. Free ngrok account + auth token: ngrok config add-authtoken <YOUR_AUTH_TOKEN>
#   3. Reserve a free static domain: https://dashboard.ngrok.com/cloud-edge/domains
#
# Usage:
#   npm run tunnel                          # start with default domain from env
#   NGROK_DOMAIN=my-app.ngrok-free.app npm run tunnel
#   npm run tunnel -- --domain my-app.ngrok-free.app
#
# Once running, update your Meta App dashboard:
#   Callback URL: https://<domain>/api/whatsapp/webhook
#   Verify Token: <META_VERIFY_TOKEN from .env>
# =============================================================================

set -euo pipefail

NGROK_DOMAIN="${NGROK_DOMAIN:-samyoj-dev.ngrok-free.app}"
LOCAL_PORT="${LOCAL_PORT:-8000}"

# Allow override via first CLI arg: npm run tunnel -- --domain custom.app
for arg in "$@"; do
  case "$arg" in
    --domain) shift; NGROK_DOMAIN="$1"; shift ;;
    --domain=*) NGROK_DOMAIN="${arg#*=}" ;;
  esac
done

echo ""
echo "  Samyoj ngrok tunnel"
echo "  ───────────────────"
echo "  Domain   : $NGROK_DOMAIN"
echo "  Local    : http://localhost:$LOCAL_PORT"
echo "  Webhook  : https://$NGROK_DOMAIN/api/whatsapp/webhook"
echo ""

exec ngrok http "$LOCAL_PORT" --domain "$NGROK_DOMAIN"