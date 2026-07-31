#!/usr/bin/env bash
# =============================================================================
# Samyoj Connection Health Check — diagnose why inbound messages aren't arriving
# =============================================================================
# Run this whenever messages aren't showing in Inbox. It checks every link in
# the chain: Meta → tunnel → Express → Redis → DB → Socket.IO.
#
# Usage:
#   bash scripts/diagnose-webhook.sh
#   bash scripts/diagnose-webhook.sh --ngrok   # also test ngrok URL
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

WARNINGS=0
ERRORS=0

ok()   { echo -e "  ${GREEN}OK${NC}   $1"; }
warn() { WARNINGS=$((WARNINGS+1)); echo -e "  ${YELLOW}WARN${NC} $1"; }
fail() { ERRORS=$((ERRORS+1)); echo -e "  ${RED}FAIL${NC} $1"; }
info() { echo -e "  ${CYAN}INFO${NC} $1"; }

LOCAL_URL="http://localhost:8000"
CODESPACE_NAME="${CODESPACE_NAME:-}"
CODESPACE_DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
CODESPACE_URL=""
if [ -n "$CODESPACE_NAME" ]; then
  CODESPACE_URL="https://${CODESPACE_NAME}-8000.${CODESPACE_DOMAIN}"
fi

echo ""
echo -e "${BOLD}  Samyoj Connection Health Check${NC}"
echo "  ────────────────────────────────"
echo ""

# ── 1. Server running ──────────────────────────────────────────────────────
echo -e "${CYAN}[1]${NC} Express server on localhost:8000"
HEALTH=$(curl -s "$LOCAL_URL/api/whatsapp/webhook/health" 2>/dev/null || echo "")
if [ -n "$HEALTH" ]; then
  ok "Server is running"
  TOTAL=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['totalReceived'])" 2>/dev/null || echo "?")
  ERRS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['totalErrors'])" 2>/dev/null || echo "?")
  WEBHOOK_URL=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'].get('webhookUrl',''))" 2>/dev/null || echo "")
  info "Webhooks received (from Meta or tests): $TOTAL"
  info "Webhook errors: $ERRS"
  info "META_WEBHOOK_URL: ${WEBHOOK_URL:-not set}"
else
  fail "Server not reachable on localhost:8000 — start it with: cd server && npm run dev"
fi

# ── 2. Redis ────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[2]${NC} Redis (BullMQ)"
if redis-cli ping 2>/dev/null | grep -q PONG; then
  ok "Redis is running"
else
  fail "Redis not reachable — start with: docker compose up -d"
fi

# ── 3. Database ─────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[3]${NC} PostgreSQL"
if psql "postgresql://postgres:postgres@localhost:5432/whatsapp_platform" -c "SELECT 1" >/dev/null 2>&1; then
  ok "PostgreSQL connected"
  WA_COUNT=$(psql "postgresql://postgres:postgres@localhost:5432/whatsapp_platform" -t -c "SELECT COUNT(*) FROM whatsapp_numbers WHERE is_active = true" 2>/dev/null | tr -d ' ')
  MSG_COUNT=$(psql "postgresql://postgres:postgres@localhost:5432/whatsapp_platform" -t -c "SELECT COUNT(*) FROM messages WHERE direction = 'INBOUND'" 2>/dev/null | tr -d ' ')
  info "Active WhatsApp numbers: $WA_COUNT"
  info "Total inbound messages ever: $MSG_COUNT"
  if [ "$MSG_COUNT" -eq 0 ] 2>/dev/null; then
    warn "Zero inbound messages — webhooks from Meta never reached the server"
  fi
else
  fail "PostgreSQL not reachable"
fi

# ── 4. Webhook GET verification ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}[4]${NC} Webhook verification (GET)"
VERIFY_TOKEN=$(grep META_VERIFY_TOKEN /workspaces/Samyoj/server/.env 2>/dev/null | cut -d= -f2 || echo "")
if [ -n "$VERIFY_TOKEN" ]; then
  CHALLENGE=$(curl -s "${LOCAL_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=DIAG_CHECK" 2>/dev/null)
  if [ "$CHALLENGE" = "DIAG_CHECK" ]; then
    ok "Webhook GET verification works"
  else
    fail "Webhook GET verification failed — returned: $CHALLENGE"
  fi
else
  fail "META_VERIFY_TOKEN not found in .env"
fi

# ── 5. Tunnel reachability ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[5]${NC} Tunnel reachability (public HTTPS)"

if [ -n "$CODESPACE_URL" ]; then
  echo -e "  Codespace URL: ${YELLOW}$CODESPACE_URL${NC}"
  CS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${CODESPACE_URL}/api/whatsapp/webhook/health" 2>/dev/null || echo "000")
  if [ "$CS_STATUS" -ge 200 ] && [ "$CS_STATUS" -lt 300 ]; then
    ok "Codespace URL is publicly reachable (HTTP $CS_STATUS)"
  elif [ "$CS_STATUS" == "404" ]; then
    fail "Codespace URL returns 404 — port 8000 is PRIVATE. Go to Ports tab → right-click 8000 → Set Public"
  elif [ "$CS_STATUS" == "000" ]; then
    fail "Codespace URL not reachable (network error)"
  else
    warn "Codespace URL returned HTTP $CS_STATUS"
  fi
fi

# Check ngrok
NGROK_RUNNING=false
if pgrep -f "ngrok http" >/dev/null 2>&1; then
  NGROK_RUNNING=true
  NGROK_STATUS=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; t=json.load(sys.stdin)['tunnels'][0]['public_url']; print(t)" 2>/dev/null || echo "")
  if [ -n "$NGROK_STATUS" ]; then
    echo -e "  ngrok URL: ${YELLOW}$NGROK_STATUS${NC}"
    NG_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${NGROK_STATUS}/api/whatsapp/webhook/health" 2>/dev/null || echo "000")
    if [ "$NG_STATUS" -ge 200 ] && [ "$NG_STATUS" -lt 300 ]; then
      ok "ngrok URL is publicly reachable (HTTP $NG_STATUS)"
    else
      fail "ngrok URL returned HTTP $NG_STATUS — tunnel may not be forwarding to port 8000"
    fi
  else
    warn "ngrok process running but API not reachable"
  fi
else
  info "ngrok not running (start with: cd server && npm run tunnel)"
fi

if ! $NGROK_RUNNING && [ -z "$CODESPACE_URL" ]; then
  fail "No tunnel active — Meta cannot reach localhost:8000"
fi

# ── 6. Meta webhook URL config ──────────────────────────────────────────────
echo ""
echo -e "${CYAN}[6]${NC} META_WEBHOOK_URL in .env"
if [ -n "$WEBHOOK_URL" ] && [ "$WEBHOOK_URL" != "None" ] && [ "$WEBHOOK_URL" != "" ]; then
  info "Value: $WEBHOOK_URL"
  # Check if this URL actually resolves
  MW_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${WEBHOOK_URL}" 2>/dev/null || echo "000")
  if [ "$MW_STATUS" -ge 200 ] && [ "$MW_STATUS" -lt 300 ]; then
    ok "META_WEBHOOK_URL is reachable (HTTP $MW_STATUS)"
  else
    fail "META_WEBHOOK_URL is NOT reachable (HTTP $MW_STATUS) — Meta cannot deliver webhooks here"
  fi
else
  fail "META_WEBHOOK_URL is empty — set it in server/.env"
fi

# ── 7. Socket.IO ────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[7]${NC} Socket.IO (real-time to Inbox)"
SOCKET_CHECK=$(curl -s "${LOCAL_URL}/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "")
if echo "$SOCKET_CHECK" | grep -q "sid\|0{" >/dev/null 2>&1; then
  ok "Socket.IO is responding"
else
  warn "Socket.IO may not be responding — Inbox may not update live"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  ────────────────────────────────${NC}"
echo -e "  Errors: ${RED}$ERRORS${NC}  |  Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}  Inbound messages cannot arrive until errors above are fixed.${NC}"
  echo ""
  echo "  Most likely fix:"
  echo "    1. Make port 8000 PUBLIC in Codespace Ports tab"
  echo "    2. Update META_WEBHOOK_URL in server/.env to the public URL"
  echo "    3. Configure Meta Console → WhatsApp → Configuration:"
  echo "       Callback URL: <public-url>/api/whatsapp/webhook"
  echo "       Verify Token: <META_VERIFY_TOKEN from .env>"
  echo "    4. Reconnect WhatsApp from Settings"
  echo ""
else
  echo -e "${GREEN}  All checks passed. If messages still don't appear, check server logs.${NC}"
  echo ""
fi