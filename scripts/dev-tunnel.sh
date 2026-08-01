#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Samyoj — ngrok Tunnel Script
# =============================================================================
# Starts an ngrok HTTP tunnel to localhost:8000 and auto-updates
# server/.env META_WEBHOOK_URL + registers the webhook with Meta.
#
# Usage:  bash scripts/dev-tunnel.sh
# Prereq: NGROK_AUTHTOKEN in server/.env or ~/.config/ngrok/ngrok.yml
# =============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/server/.env"
PORT="${TUNNEL_PORT:-8000}"
TARGET="http://localhost:${PORT}"

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[tunnel]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── Check ngrok ────────────────────────────────────────────────────────────────
if ! command -v ngrok >/dev/null 2>&1; then
  fail "Official ngrok CLI is required. Install it from https://ngrok.com/download"
fi

# ── Configure optional token from server/.env ─────────────────────────────────
NGROK_AUTH_TOKEN="$(grep -m1 '^NGROK_AUTHTOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
if [[ -n "$NGROK_AUTH_TOKEN" ]]; then
  ngrok config add-authtoken "$NGROK_AUTH_TOKEN" >/dev/null ||
    fail "Could not configure NGROK_AUTHTOKEN."
fi

# ── Wait for tunnel URL ────────────────────────────────────────────────────────
wait_for_tunnel() {
  local webhook_url="$1"
  local verify_token="$2"
  local max_attempts="${3:-60}"
  local attempt=1
  local verify_url="${webhook_url}?hub.mode=subscribe&hub.verify_token=${verify_token}&hub.challenge=ping"

  info "Waiting for tunnel to be reachable (up to ${max_attempts}s)..."
  while [[ "$attempt" -le "$max_attempts" ]]; do
    local body
    body="$(curl -s --max-time 5 "$verify_url" 2>/dev/null || true)"
    if [[ "$body" == "ping" ]]; then
      ok "Tunnel is reachable (webhook verification OK)."
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  warn "Tunnel not reachable after ${max_attempts}s — webhook registration skipped."
  return 1
}

# ── Update .env + register webhook ─────────────────────────────────────────────
update_webhook() {
  local tunnel_url="$1"
  local webhook_url="${tunnel_url}/api/whatsapp/webhook"

  if [[ ! -f "$ENV_FILE" ]]; then
    warn "server/.env not found — cannot update META_WEBHOOK_URL"
    return
  fi

  ENV_FILE="$ENV_FILE" WEBHOOK_URL="$webhook_url" node <<'NODE'
const fs = require('node:fs');
const file = process.env.ENV_FILE;
const value = process.env.WEBHOOK_URL;
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const index = lines.findIndex((line) => line.startsWith('META_WEBHOOK_URL='));
if (index >= 0) lines[index] = `META_WEBHOOK_URL=${value}`;
else lines.push(`META_WEBHOOK_URL=${value}`);
fs.writeFileSync(file, lines.join('\n'));
NODE

  ok "Updated server/.env: META_WEBHOOK_URL=${webhook_url}"
  echo "$tunnel_url" > "$ROOT_DIR/.run/tunnel-url"
  echo "pending" > "$ROOT_DIR/.run/webhook-status"

  # Wait for tunnel to be live, then register webhook
  local verify_token
  verify_token=$(grep '^META_VERIFY_TOKEN=' "$ENV_FILE" | cut -d= -f2-)

  if ! wait_for_tunnel "$webhook_url" "$verify_token"; then
    warn "Once the server is running, register webhook manually: cd server && npm run setup-webhook"
    return
  fi

  info "Registering webhook with Meta..."
  local attempt=1
  while [[ "$attempt" -le 5 ]]; do
    if (cd "$ROOT_DIR/server" && npm run setup-webhook); then
      echo "ready" > "$ROOT_DIR/.run/webhook-status"
      ok "Webhook registered. Incoming messages should work now."
      return
    fi
    if [[ "$attempt" -lt 5 ]]; then
      warn "Webhook registration failed (attempt ${attempt}/5), retrying in 5s..."
      sleep 5
    fi
    attempt=$((attempt + 1))
  done

  warn "Webhook registration failed. Run manually: cd server && npm run setup-webhook"
}

# ── Start ngrok ────────────────────────────────────────────────────────────────
info "Starting ngrok tunnel → ${TARGET}"
echo ""

mkdir -p "$ROOT_DIR/.run/logs"
NGROK_LOG="$ROOT_DIR/.run/logs/ngrok-agent.log"
ngrok http "$PORT" --log=stdout >"$NGROK_LOG" 2>&1 &
NGROK_PID=$!
trap 'kill "$NGROK_PID" 2>/dev/null || true' EXIT INT TERM

TUNNEL_URL=""
for attempt in {1..30}; do
  if ! kill -0 "$NGROK_PID" 2>/dev/null; then
    warn "ngrok exited before opening a tunnel:"
    tail -n 20 "$NGROK_LOG" 2>/dev/null || true
    exit 1
  fi

  TUNNEL_URL="$(
    curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null |
      node -e '
        let input = "";
        process.stdin.on("data", chunk => input += chunk);
        process.stdin.on("end", () => {
          try {
            const tunnel = JSON.parse(input).tunnels.find(item => item.proto === "https");
            if (tunnel) process.stdout.write(tunnel.public_url);
          } catch {}
        });
      ' || true
  )"
  [[ "$TUNNEL_URL" == https://* ]] && break
  sleep 1
done

[[ "$TUNNEL_URL" == https://* ]] || fail "ngrok did not provide a public HTTPS URL."
ok "Public URL: $TUNNEL_URL"
update_webhook "$TUNNEL_URL"

wait "$NGROK_PID"
