#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Samyoj — Public webhook tunnel (required for inbound WhatsApp)
# =============================================================================
# Prefer ngrok when authenticated. If ngrok cannot start, fall back to a
# temporary Cloudflare quick tunnel so Inbox replies keep working in local/dev.
#
# Usage:  bash scripts/dev-tunnel.sh
# =============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/server/.env"
BIN_DIR="$ROOT_DIR/.bin"
PORT="${TUNNEL_PORT:-8000}"
TARGET="http://localhost:${PORT}"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$RUN_DIR/logs"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[tunnel]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

mkdir -p "$BIN_DIR" "$LOG_DIR"

write_env_webhook() {
  local webhook_url="$1"
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
}

wait_for_tunnel() {
  local webhook_url="$1"
  local verify_token="$2"
  local max_attempts="${3:-90}"
  local attempt=1
  local verify_url="${webhook_url}?hub.mode=subscribe&hub.verify_token=${verify_token}&hub.challenge=ping"

  info "Waiting for tunnel to be reachable (up to ${max_attempts}s)..."
  while [[ "$attempt" -le "$max_attempts" ]]; do
    # Use Node (not curl) — Codespace DNS sometimes fails for curl on trycloudflare.com
    local body
    body="$(
      VERIFY_URL="$verify_url" node <<'NODE' 2>/dev/null || true
const url = process.env.VERIFY_URL;
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 8000);
fetch(url, { signal: ctrl.signal })
  .then(async (res) => {
    const text = await res.text();
    process.stdout.write(text);
  })
  .catch(() => {})
  .finally(() => clearTimeout(timer));
NODE
    )"
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

register_webhook() {
  local attempt=1
  info "Registering webhook with Meta..."
  while [[ "$attempt" -le 5 ]]; do
    if (cd "$ROOT_DIR/server" && npm run setup-webhook); then
      echo "ready" > "$RUN_DIR/webhook-status"
      ok "Webhook registered. Incoming messages should work now."
      return 0
    fi
    if [[ "$attempt" -lt 5 ]]; then
      warn "Webhook registration failed (attempt ${attempt}/5), retrying in 5s..."
      sleep 5
    fi
    attempt=$((attempt + 1))
  done
  echo "failed" > "$RUN_DIR/webhook-status"
  warn "Webhook registration failed. Run manually: cd server && npm run setup-webhook"
  return 1
}

# Publish URL only AFTER .env is updated so start.sh cannot race an empty META_WEBHOOK_URL.
publish_tunnel() {
  local tunnel_url="$1"
  local webhook_url="${tunnel_url}/api/whatsapp/webhook"

  [[ -f "$ENV_FILE" ]] || fail "server/.env not found — cannot update META_WEBHOOK_URL"
  write_env_webhook "$webhook_url"
  ok "Updated server/.env: META_WEBHOOK_URL=${webhook_url}"

  echo "pending" > "$RUN_DIR/webhook-status"
  echo "$tunnel_url" > "$RUN_DIR/tunnel-url"

  local verify_token
  verify_token=$(grep '^META_VERIFY_TOKEN=' "$ENV_FILE" | cut -d= -f2-)
  if wait_for_tunnel "$webhook_url" "$verify_token"; then
    register_webhook || true
  else
    warn "Once the API is running, register webhook manually: cd server && npm run setup-webhook"
  fi
}

ensure_cloudflared() {
  if command -v cloudflared >/dev/null 2>&1; then
    command -v cloudflared
    return
  fi
  local binary="$BIN_DIR/cloudflared"
  if [[ -x "$binary" ]]; then
    echo "$binary"
    return
  fi

  local arch asset
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) asset="cloudflared-linux-amd64" ;;
    aarch64|arm64) asset="cloudflared-linux-arm64" ;;
    *) fail "Unsupported architecture for cloudflared fallback: $arch" ;;
  esac

  info "Downloading cloudflared fallback (${asset})..."
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}" -o "$binary"
  chmod +x "$binary"
  echo "$binary"
}

start_cloudflared() {
  local cloudflared
  cloudflared="$(ensure_cloudflared)"
  info "Starting Cloudflare quick tunnel fallback → ${TARGET}"
  warn "Add NGROK_AUTHTOKEN to server/.env to prefer ngrok next time."

  local cf_log="$LOG_DIR/cloudflared.log"
  "$cloudflared" tunnel --url "$TARGET" >"$cf_log" 2>&1 &
  local cf_pid=$!
  trap 'kill '"$cf_pid"' 2>/dev/null || true' EXIT INT TERM

  local tunnel_url=""
  for attempt in {1..40}; do
    if ! kill -0 "$cf_pid" 2>/dev/null; then
      warn "cloudflared exited before opening a tunnel:"
      tail -n 30 "$cf_log" 2>/dev/null || true
      exit 1
    fi
    tunnel_url="$(
      grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$cf_log" 2>/dev/null | tail -n 1 || true
    )"
    [[ "$tunnel_url" == https://* ]] && break
    sleep 1
  done

  [[ "$tunnel_url" == https://* ]] || fail "cloudflared did not provide a public HTTPS URL."
  ok "Public URL: $tunnel_url"
  publish_tunnel "$tunnel_url"
  wait "$cf_pid"
}

start_ngrok() {
  command -v ngrok >/dev/null 2>&1 || return 1

  local token
  token="$(grep -m1 '^NGROK_AUTHTOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)"
  if [[ -n "$token" ]]; then
    ngrok config add-authtoken "$token" >/dev/null 2>&1 || true
  fi

  if ! grep -q 'authtoken:' "$HOME/.config/ngrok/ngrok.yml" 2>/dev/null; then
    warn "ngrok is not authenticated."
    return 1
  fi

  info "Starting ngrok tunnel → ${TARGET}"
  local ngrok_log="$LOG_DIR/ngrok-agent.log"
  ngrok http "$PORT" --log=stdout >"$ngrok_log" 2>&1 &
  local ngrok_pid=$!

  local tunnel_url=""
  for attempt in {1..25}; do
    if ! kill -0 "$ngrok_pid" 2>/dev/null; then
      warn "ngrok exited before opening a tunnel:"
      tail -n 20 "$ngrok_log" 2>/dev/null || true
      return 1
    fi
    tunnel_url="$(
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
    [[ "$tunnel_url" == https://* ]] && break
    sleep 1
  done

  if [[ "$tunnel_url" != https://* ]]; then
    kill "$ngrok_pid" 2>/dev/null || true
    wait "$ngrok_pid" 2>/dev/null || true
    warn "ngrok did not provide a public HTTPS URL."
    return 1
  fi

  trap 'kill '"$ngrok_pid"' 2>/dev/null || true' EXIT INT TERM
  ok "Public URL: $tunnel_url"
  publish_tunnel "$tunnel_url"
  wait "$ngrok_pid"
}

if start_ngrok; then
  exit 0
fi

warn "Falling back to Cloudflare quick tunnel so inbound WhatsApp keeps working."
start_cloudflared
