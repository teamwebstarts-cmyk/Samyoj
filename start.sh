#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
# ponytail: verify_webhook_challenge lives in scripts/public-dev-url.sh
source "$ROOT_DIR/scripts/public-dev-url.sh"
# ponytail: WSL + Windows Node/ngrok/curl shims for local dev (not Codespaces-only).
source "$ROOT_DIR/scripts/local-wsl-shims.sh"
local_wsl_shims "$ROOT_DIR"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$RUN_DIR/logs"
mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${CYAN}[start]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

is_running() {
  [[ -f "$RUN_DIR/$1.pid" ]] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null
}

start_process() {
  local name="$1"
  local command="$2"
  if is_running "$name"; then
    ok "$name is already running (PID $(cat "$RUN_DIR/$name.pid"))"
    return
  fi
  nohup setsid bash -c "cd \"$ROOT_DIR\" && source scripts/local-wsl-shims.sh && local_wsl_shims \"$ROOT_DIR\" && exec $command" >"$LOG_DIR/$name.log" 2>&1 </dev/null &
  local pid=$!
  echo "$pid" > "$RUN_DIR/$name.pid"
  disown "$pid" 2>/dev/null || true
}

stop_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    stop_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

restart_api() {
  if [[ -f "$RUN_DIR/api.pid" ]]; then
    local pid
    pid="$(cat "$RUN_DIR/api.pid")"
    if kill -0 "$pid" 2>/dev/null; then
      info "Restarting API so it loads the current META_WEBHOOK_URL..."
      stop_tree "$pid"
      sleep 1
    fi
    rm -f "$RUN_DIR/api.pid"
  fi

  # Optional Doppler layer: USE_DOPPLER=1 bash start.sh runs the API with
  # Doppler-injected secrets. server/.env remains the fallback for anything
  # not present in Doppler (dotenv never overrides existing env vars).
  local api_cmd="npm --prefix server run dev"
  if [[ "${USE_DOPPLER:-0}" == "1" ]]; then
    if command -v doppler >/dev/null 2>&1; then
      api_cmd="doppler run -- npm --prefix server run dev"
      info "USE_DOPPLER=1 — API will load secrets from Doppler (server/.env as fallback)"
    else
      warn "USE_DOPPLER=1 but Doppler CLI is missing — falling back to server/.env. Run bash scripts/doppler-setup.sh"
    fi
  fi
  start_process api "$api_cmd"
}

restart_client() {
  if [[ -f "$RUN_DIR/client.pid" ]]; then
    local pid
    pid="$(cat "$RUN_DIR/client.pid")"
    if kill -0 "$pid" 2>/dev/null; then
      info "Restarting client so Vite loads the HTTPS dev origin..."
      stop_tree "$pid"
      sleep 1
    fi
    rm -f "$RUN_DIR/client.pid"
  fi
  start_process client "npm --prefix client run dev"
}

[[ -f server/.env ]] || fail "server/.env is missing. Run bash setup.sh first."
[[ -d server/node_modules && -d client/node_modules && -d admin/node_modules ]] ||
  fail "Dependencies are missing. Run bash setup.sh first."
ENCRYPTION_KEY="$(grep -m1 '^ENCRYPTION_KEY=' server/.env | cut -d= -f2- || true)"
[[ "$ENCRYPTION_KEY" =~ ^[0-9a-fA-F]{64}$ ]] ||
  fail "ENCRYPTION_KEY must be exactly 64 hexadecimal characters. Run bash setup.sh."
unset ENCRYPTION_KEY
if ! grep -q '^PLATFORM_ADMIN_URL=' server/.env; then
  printf '\nPLATFORM_ADMIN_URL=http://localhost:3001\n' >> server/.env
  ok "Set PLATFORM_ADMIN_URL=http://localhost:3001"
fi
if ! grep -q '^PLATFORM_MFA_REQUIRED=' server/.env; then
  if grep -q '^NODE_ENV=production$' server/.env; then
    printf '\nPLATFORM_MFA_REQUIRED=true\n' >> server/.env
    ok "Set PLATFORM_MFA_REQUIRED=true for production"
  else
    printf '\nPLATFORM_MFA_REQUIRED=false\n' >> server/.env
    ok "Set PLATFORM_MFA_REQUIRED=false for local development"
  fi
fi

harden_local_permissions() {
  chmod 600 server/.env
  if [[ -f client/.env ]]; then
    chmod 600 client/.env
  fi
  if [[ -f admin/.env ]]; then
    chmod 600 admin/.env
  fi
  if [[ -d "$LOG_DIR" ]]; then
    find "$LOG_DIR" -type f -exec chmod 640 {} + 2>/dev/null || true
  fi
  local env_mode
  env_mode="$(stat -c '%a' server/.env 2>/dev/null || true)"
  if [[ -n "$env_mode" && "$env_mode" != "600" ]]; then
    if [[ -r /proc/version ]] && grep -qi microsoft /proc/version; then
      warn "server/.env stays mode ${env_mode} on the Windows drive. That is expected; continuing."
    else
      warn "server/.env permissions are ${env_mode}; expected 600"
    fi
  fi
}

harden_local_permissions

info "Starting Docker containers..."
docker compose up -d
for attempt in {1..30}; do
  docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 ||
  fail "PostgreSQL did not become ready."
for attempt in {1..15}; do
  docker compose exec -T redis redis-cli ping >/dev/null 2>&1 && break
  sleep 1
done
docker compose exec -T redis redis-cli ping >/dev/null 2>&1 ||
  fail "Redis did not become ready."
ok "Docker containers running"

info "Applying pending database migrations..."
(cd server && npm run db:migrate-startup-safe) ||
  fail "Database migrations were refused by the fail-closed safety workflow. Follow docs/WHATSAPP_NUMBER_MIGRATION_SAFETY.md."
ok "Database schema is current"

info "Starting API server..."
restart_api

for attempt in {1..40}; do
  curl -fsS http://localhost:8000/health >/dev/null 2>&1 && break
  is_running api || fail "API failed. See .run/logs/api.log"
  sleep 1
done
curl -fsS http://localhost:8000/health >/dev/null 2>&1 ||
  fail "API did not become healthy. See .run/logs/api.log"
ok "API is healthy"

info "Starting Client..."
start_process client "npm --prefix client run dev"
for attempt in {1..30}; do
  curl -fsS http://localhost:3000 >/dev/null 2>&1 && break
  is_running client || fail "Client failed. See .run/logs/client.log"
  sleep 1
done
curl -fsS http://localhost:3000 >/dev/null 2>&1 ||
  fail "Client did not become reachable. See .run/logs/client.log"
ok "Client is reachable"

if codespace_name 2>/dev/null; then
  ensure_codespace_ports_public
  CS_CLIENT="$(codespace_client_origin)"
  echo "$CS_CLIENT" >"$RUN_DIR/codespace-client-url"
  write_env_key CLIENT_URL "$CS_CLIENT"
  ok "Codespace UI (public): $CS_CLIENT"
  restart_api
  for attempt in {1..40}; do
    curl -fsS http://localhost:8000/health >/dev/null 2>&1 && break
    is_running api || fail "API failed after CLIENT_URL update. See .run/logs/api.log"
    sleep 1
  done
fi

PUBLIC_MODE="${SAMYOJ_PUBLIC_MODE:-ngrok}"
if [[ "$PUBLIC_MODE" != "ngrok" ]]; then
  fail "Ngrok is required for inbound webhook testing. Stable Codespaces URLs and fallback tunnels are disabled."
fi

CONNECT_HTTPS_ORIGIN=""
WEBHOOK_URL=""

if [[ "$PUBLIC_MODE" == "ngrok" ]]; then
  if is_running tunnel; then
    info "Restarting ngrok tunnel..."
    stop_tree "$(cat "$RUN_DIR/tunnel.pid")"
    rm -f "$RUN_DIR/tunnel.pid" "$RUN_DIR/tunnel-url" "$RUN_DIR/webhook-status"
  fi
  if command -v taskkill.exe >/dev/null 2>&1; then
    taskkill.exe /IM ngrok.exe /F >/dev/null 2>&1 || true
    sleep 1
  fi
  rm -f "$RUN_DIR/tunnel-url" "$RUN_DIR/webhook-status"
  if bash "$ROOT_DIR/scripts/read-env-key.sh" server/.env NGROK_STATIC_DOMAIN | grep -q .; then
    info "Starting ngrok tunnel (stable domain from NGROK_STATIC_DOMAIN)..."
  else
    info "Starting ngrok tunnel (set NGROK_STATIC_DOMAIN in server/.env for a permanent URL)..."
  fi
  start_process tunnel "bash scripts/dev-tunnel.sh"
  for attempt in {1..90}; do
    if [[ -s "$RUN_DIR/tunnel-url" ]]; then
      WEBHOOK_ENV="$(bash "$ROOT_DIR/scripts/read-env-key.sh" server/.env META_WEBHOOK_URL || true)"
      [[ -n "$WEBHOOK_ENV" ]] && break
    fi
    if is_running tunnel; then
      sleep 1
      continue
    fi
    if curl -fsS http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1 && [[ -s "$RUN_DIR/tunnel-url" ]]; then
      break
    fi
    fail "Tunnel failed. See .run/logs/tunnel.log"
  done
  [[ -s "$RUN_DIR/tunnel-url" ]] || fail "Tunnel URL was not created. See .run/logs/tunnel.log"
  CONNECT_HTTPS_ORIGIN="$(cat "$RUN_DIR/tunnel-url")"
  WEBHOOK_URL="$(bash "$ROOT_DIR/scripts/read-env-key.sh" server/.env META_WEBHOOK_URL || true)"
  ok "ngrok ready: $CONNECT_HTTPS_ORIGIN"
  if [[ -f "$RUN_DIR/tunnel-port" ]] && [[ "$(cat "$RUN_DIR/tunnel-port")" == "3000" ]]; then
    restart_client
    for attempt in {1..30}; do
      curl -fsS http://localhost:3000 >/dev/null 2>&1 && break
      is_running client || fail "Client failed after tunnel setup. See .run/logs/client.log"
      sleep 1
    done
    curl -fsS http://localhost:3000 >/dev/null 2>&1 ||
      fail "Client did not become reachable after tunnel setup. See .run/logs/client.log"
    ok "Client restarted for HTTPS Connect"
  fi
fi

info "Restarting API so it loads the current META_WEBHOOK_URL..."
restart_api
for attempt in {1..40}; do
  curl -fsS http://localhost:8000/health >/dev/null 2>&1 && break
  is_running api || fail "API failed after public URL setup. See .run/logs/api.log"
  sleep 1
done

VERIFY_TOKEN="$(grep -m1 '^META_VERIFY_TOKEN=' server/.env | cut -d= -f2-)"
info "Verifying public webhook challenge..."
CHALLENGE_OK=false
for attempt in {1..60}; do
  if verify_webhook_challenge "$WEBHOOK_URL" "$VERIFY_TOKEN"; then
    CHALLENGE_OK=true
    break
  fi
  sleep 1
done
if [[ "$CHALLENGE_OK" == true ]]; then
  ok "Public webhook challenge passed"
  (cd server && npm run setup-webhook) >/dev/null 2>&1 && ok "Meta webhook registered" || warn "Meta webhook registration pending (connect a number first if needed)"
else
  fail "Public webhook challenge failed. Inbox replies will not arrive. See .run/logs/tunnel.log."
fi

info "Starting Admin..."
start_process admin "npm --prefix admin run dev"
for attempt in {1..30}; do
  curl -fsS http://localhost:3001 >/dev/null 2>&1 && break
  is_running admin || fail "Admin failed. See .run/logs/admin.log"
  sleep 1
done
curl -fsS http://localhost:3001 >/dev/null 2>&1 ||
  fail "Admin did not become reachable. See .run/logs/admin.log"
ok "Admin is reachable"

harden_local_permissions

echo ""
if [[ "$CHALLENGE_OK" == true ]]; then
  ok "All services started (public webhook verified)."
else
  ok "All services started (public webhook not verified yet — see warnings above)."
fi
if [[ -f "$RUN_DIR/tunnel-port" ]] && [[ "$(cat "$RUN_DIR/tunnel-port")" == "3000" ]] && [[ -n "$CONNECT_HTTPS_ORIGIN" ]]; then
  echo "  WhatsApp Connect (use this): $CONNECT_HTTPS_ORIGIN"
  echo "  Local UI (no Connect):       http://localhost:3000"
else
  echo "  Connect + test UI (HTTPS): $CONNECT_HTTPS_ORIGIN"
  echo "  Local UI (no Connect):     http://localhost:3000"
fi
if [[ -f "$RUN_DIR/codespace-client-url" ]]; then
  echo "  Codespace UI (HTTPS):      $(cat "$RUN_DIR/codespace-client-url")"
fi
echo "  Admin:                     http://localhost:3001"
echo "  API (local):               http://localhost:8000"
echo "  Webhook (Meta):            $WEBHOOK_URL"
if [[ -n "$CONNECT_HTTPS_ORIGIN" ]]; then
  echo "  Meta OAuth (HTTPS via ngrok):"
  echo "    ${CONNECT_HTTPS_ORIGIN}/settings/whatsapp/callback/popup"
  if ! bash "$ROOT_DIR/scripts/read-env-key.sh" server/.env NGROK_STATIC_DOMAIN | grep -q .; then
    echo "  Tip: set NGROK_STATIC_DOMAIN in server/.env to keep this URL across restarts."
  fi
fi
echo "  Webhook registration: $(cat "$RUN_DIR/webhook-status" 2>/dev/null || echo pending)"
echo "  Logs: .run/logs/"
echo "  Stop: bash stop.sh"
