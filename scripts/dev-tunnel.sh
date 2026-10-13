#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Samyoj — Public HTTPS tunnel (inbound webhook + Meta OAuth / Connect UI)
# =============================================================================
# ALWAYS uses ngrok. No Cloudflare / cloudflared fallback.
# Fails clearly if ngrok CLI or NGROK_AUTHTOKEN is missing.
#
# Default: port 3000 (Vite UI + /api proxy + webhook) for local dev so Meta Connect
# works over HTTPS. Codespaces default 8000 (UI has its own HTTPS preview).
# Override: TUNNEL_PORT=8000 bash start.sh
#
# Usage:  bash scripts/dev-tunnel.sh
# =============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/server/.env"
CLIENT_ENV_FILE="$ROOT_DIR/client/.env"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$RUN_DIR/logs"
READ_ENV="$ROOT_DIR/scripts/read-env-key.sh"

resolve_tunnel_port() {
  if [[ -n "${TUNNEL_PORT:-}" ]]; then
    echo "$TUNNEL_PORT"
    return
  fi
  if [[ -n "${CODESPACE_NAME:-}" ]]; then
    echo 8000
    return
  fi
  echo 3000
}

PORT="$(resolve_tunnel_port)"
TARGET="http://127.0.0.1:${PORT}"

source "$ROOT_DIR/scripts/local-wsl-shims.sh"
local_wsl_shims "$ROOT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[tunnel]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

mkdir -p "$LOG_DIR"

read_env() {
  bash "$READ_ENV" "$ENV_FILE" "$1"
}

ngrok_https_public_url() {
  curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null |
    node -e '
      let input = "";
      process.stdin.on("data", (chunk) => (input += chunk));
      process.stdin.on("end", () => {
        try {
          const tunnel = JSON.parse(input).tunnels.find((item) => item.proto === "https");
          if (tunnel) process.stdout.write(tunnel.public_url);
        } catch {}
      });
    ' 2>/dev/null || true
}

normalize_ngrok_host() {
  local raw="$1"
  raw="${raw#https://}"
  raw="${raw#http://}"
  raw="${raw%%/*}"
  echo "$raw"
}

write_env_file_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  # Args, not env: WSL does not forward env vars to Windows node.exe.
  node - "$file" "$key" "$value" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const key = process.argv[3];
const value = process.argv[4];
const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
const index = lines.findIndex((line) => line.startsWith(`${key}=`));
if (index >= 0) lines[index] = `${key}=${value}`;
else lines.push(`${key}=${value}`);
fs.writeFileSync(file, lines.join('\n'));
NODE
}

write_env_key() {
  write_env_file_key "$ENV_FILE" "$1" "$2"
}

write_env_webhook() {
  write_env_key META_WEBHOOK_URL "$1"
}

wait_for_tunnel() {
  local webhook_url="$1"
  local verify_token="$2"
  local max_attempts="${3:-90}"
  local attempt=1
  local verify_url="${webhook_url}?hub.mode=subscribe&hub.verify_token=${verify_token}&hub.challenge=ping"

  info "Waiting for tunnel to be reachable (up to ${max_attempts}s)..."
  while [[ "$attempt" -le "$max_attempts" ]]; do
    local body
    body="$(
      node - "$verify_url" <<'NODE' 2>/dev/null || true
const url = process.argv[2];
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
  if [[ "$PORT" == "3000" ]]; then
    write_env_key CLIENT_URL "$tunnel_url"
    write_env_key META_REDIRECT_URI "${tunnel_url}/settings/whatsapp/callback/popup"
    write_env_file_key "$CLIENT_ENV_FILE" VITE_DEV_HTTPS_ORIGIN "$tunnel_url"
    ok "Updated CLIENT_URL + META_REDIRECT_URI for WhatsApp Connect (HTTPS)"
    ok "Updated client/.env: VITE_DEV_HTTPS_ORIGIN (open this URL in the browser)"
  fi
  echo "$PORT" > "$RUN_DIR/tunnel-port"
  if [[ -z "$(read_env NGROK_STATIC_DOMAIN)" ]]; then
    local host
    host="$(normalize_ngrok_host "$tunnel_url")"
    if [[ "$host" =~ \.ngrok-free\.(dev|app)$ ]]; then
      write_env_key NGROK_STATIC_DOMAIN "$host"
      ok "Pinned NGROK_STATIC_DOMAIN=${host} in server/.env (same URL on every start)"
    fi
  fi
  echo "pending" > "$RUN_DIR/webhook-status"
  echo "$tunnel_url" > "$RUN_DIR/tunnel-url"

  local verify_token
  verify_token="$(read_env META_VERIFY_TOKEN)"
  if wait_for_tunnel "$webhook_url" "$verify_token"; then
    register_webhook || true
  else
    warn "Once the API is running, register webhook manually: cd server && npm run setup-webhook"
  fi
}

ensure_ngrok_auth() {
  [[ -f "$ENV_FILE" ]] || fail "server/.env not found. Add NGROK_AUTHTOKEN and retry."

  local token
  token="$(read_env NGROK_AUTHTOKEN)"
  if [[ -z "$token" ]]; then
    token="$(read_env NGROK_AUTH_TOKEN)"
  fi

  if [[ -n "$token" ]]; then
    local auth_out="$LOG_DIR/ngrok-auth.out"
    local auth_err="$LOG_DIR/ngrok-auth.err"
    if ngrok config add-authtoken "$token" >"$auth_out" 2>"$auth_err"; then
      return 0
    fi
    if grep -qiE 'saved|updated|already|unchanged' "$auth_err" 2>/dev/null; then
      return 0
    fi
    if ngrok version >/dev/null 2>&1; then
      warn "ngrok config add-authtoken reported an error; continuing if ngrok.yml already has your token."
      tail -n 2 "$auth_err" 2>/dev/null || true
      return 0
    fi
    tail -n 5 "$auth_err" 2>/dev/null || true
    fail "ngrok rejected NGROK_AUTHTOKEN from server/.env. Check the token and retry."
  fi

  if grep -q 'authtoken:' "$HOME/.config/ngrok/ngrok.yml" 2>/dev/null; then
    return 0
  fi
  fail "NGROK_AUTHTOKEN missing. Add it to server/.env (from https://dashboard.ngrok.com/get-started/your-authtoken)."
}

watch_ngrok_agent() {
  while curl -fsS http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; do
    sleep 20
  done
  fail "ngrok agent stopped. Run bash start.sh again."
}

start_ngrok() {
  command -v ngrok >/dev/null 2>&1 || fail "Official ngrok CLI is required. Install from https://ngrok.com/download"

  ensure_ngrok_auth

  local static_host=""
  static_host="$(normalize_ngrok_host "$(read_env NGROK_STATIC_DOMAIN)")"
  if [[ "$static_host" == "samyoj-dev.ngrok-free.app" ]]; then
    fail "Do not use team domain samyoj-dev.ngrok-free.app (ERR_NGROK_313). Set NGROK_STATIC_DOMAIN to your own ngrok static domain."
  fi

  local existing_url
  existing_url="$(ngrok_https_public_url)"
  if [[ "$existing_url" == https://* ]]; then
    if [[ -z "$static_host" ]] || [[ "$existing_url" == *"$static_host"* ]]; then
      ok "Reusing running ngrok: $existing_url"
      publish_tunnel "$existing_url"
      watch_ngrok_agent
    fi
    warn "ngrok is already running at $existing_url (wanted ${static_host:-a new URL}). Run bash stop.sh, then bash start.sh."
    fail "Another ngrok tunnel is already active."
  fi

  info "Starting ngrok tunnel → ${TARGET}"
  local ngrok_log="$LOG_DIR/ngrok-agent.log"
  local -a ngrok_cmd=(http "$PORT" --log=stdout)
  if [[ -n "$static_host" ]]; then
    ngrok_cmd+=(--url "https://${static_host}")
    info "Stable public URL: https://${static_host}"
  else
    warn "No NGROK_STATIC_DOMAIN — URL will change each session. Add your free static domain in server/.env."
  fi

  ngrok "${ngrok_cmd[@]}" >"$ngrok_log" 2>&1 &
  local ngrok_pid=$!

  local tunnel_url=""
  for attempt in {1..45}; do
    if ! kill -0 "$ngrok_pid" 2>/dev/null; then
      warn "ngrok exited before opening a tunnel:"
      tail -n 30 "$ngrok_log" 2>/dev/null || true
      fail "ngrok failed to start. See .run/logs/ngrok-agent.log"
    fi
    tunnel_url="$(ngrok_https_public_url)"
    [[ "$tunnel_url" == https://* ]] && break
    sleep 1
  done

  if [[ "$tunnel_url" != https://* ]]; then
    kill "$ngrok_pid" 2>/dev/null || true
    wait "$ngrok_pid" 2>/dev/null || true
    fail "ngrok did not provide a public HTTPS URL. See .run/logs/ngrok-agent.log"
  fi

  trap 'kill '"$ngrok_pid"' 2>/dev/null || true' EXIT INT TERM
  ok "Public URL: $tunnel_url"
  publish_tunnel "$tunnel_url"
  wait "$ngrok_pid"
}

start_ngrok
