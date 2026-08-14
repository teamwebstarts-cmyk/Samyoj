#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
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
  nohup bash -c "cd \"$ROOT_DIR\" && exec $command" >"$LOG_DIR/$name.log" 2>&1 &
  echo "$!" > "$RUN_DIR/$name.pid"
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

[[ -f server/.env ]] || fail "server/.env is missing. Run bash setup.sh first."
[[ -d server/node_modules && -d client/node_modules ]] ||
  fail "Dependencies are missing. Run bash setup.sh first."
ENCRYPTION_KEY="$(grep -m1 '^ENCRYPTION_KEY=' server/.env | cut -d= -f2- || true)"
[[ "$ENCRYPTION_KEY" =~ ^[0-9a-fA-F]{64}$ ]] ||
  fail "ENCRYPTION_KEY must be exactly 64 hexadecimal characters. Run bash setup.sh."
unset ENCRYPTION_KEY

harden_local_permissions() {
  chmod 600 server/.env
  if [[ -f client/.env ]]; then
    chmod 600 client/.env
  fi
  if [[ -d "$LOG_DIR" ]]; then
    find "$LOG_DIR" -type f -exec chmod 640 {} + 2>/dev/null || true
  fi
  local env_mode
  env_mode="$(stat -c '%a' server/.env 2>/dev/null || true)"
  if [[ -n "$env_mode" && "$env_mode" != "600" ]]; then
    warn "server/.env permissions are ${env_mode}; expected 600"
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

if ! is_running tunnel; then
  rm -f "$RUN_DIR/tunnel-url" "$RUN_DIR/webhook-status"
  info "Starting public webhook tunnel..."
  start_process tunnel "bash scripts/dev-tunnel.sh"
  for attempt in {1..60}; do
    if [[ -s "$RUN_DIR/tunnel-url" ]]; then
      WEBHOOK_ENV="$(grep -m1 '^META_WEBHOOK_URL=' server/.env | cut -d= -f2- || true)"
      [[ -n "$WEBHOOK_ENV" ]] && break
    fi
    is_running tunnel || fail "Tunnel failed. See .run/logs/tunnel.log"
    sleep 1
  done
  [[ -s "$RUN_DIR/tunnel-url" ]] || fail "Tunnel URL was not created. See .run/logs/tunnel.log"
  WEBHOOK_ENV="$(grep -m1 '^META_WEBHOOK_URL=' server/.env | cut -d= -f2- || true)"
  [[ -n "$WEBHOOK_ENV" ]] || fail "META_WEBHOOK_URL is still empty after tunnel start."
else
  ok "tunnel is already running"
  [[ -s "$RUN_DIR/tunnel-url" ]] ||
    fail "Tunnel PID exists but its URL is missing. Run bash stop.sh, then bash start.sh."
fi

TUNNEL_BASE="$(cat "$RUN_DIR/tunnel-url")"
WEBHOOK_URL="$(grep -m1 '^META_WEBHOOK_URL=' server/.env | cut -d= -f2-)"
ok "Tunnel ready: $TUNNEL_BASE"

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

VERIFY_TOKEN="$(grep -m1 '^META_VERIFY_TOKEN=' server/.env | cut -d= -f2-)"
info "Verifying public webhook challenge..."
CHALLENGE_OK=false
VERIFY_URL="${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=ping"
for attempt in {1..60}; do
  # Node fetch is more reliable than curl for public tunnel DNS in Codespaces
  BODY="$(
    VERIFY_URL="$VERIFY_URL" node <<'NODE' 2>/dev/null || true
const url = process.env.VERIFY_URL;
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), 8000);
fetch(url, { signal: ctrl.signal })
  .then(async (res) => process.stdout.write(await res.text()))
  .catch(() => {})
  .finally(() => clearTimeout(timer));
NODE
  )"
  if [[ "$BODY" == "ping" ]]; then
    CHALLENGE_OK=true
    break
  fi
  sleep 1
done
[[ "$CHALLENGE_OK" == true ]] ||
  fail "Public webhook challenge failed. Inbox replies will not arrive. See .run/logs/tunnel.log"

ok "Public webhook challenge passed"
(cd server && npm run setup-webhook) >/dev/null 2>&1 && ok "Meta webhook registered" || warn "Meta webhook registration pending (connect a number first if needed)"

info "Starting Client..."
start_process client "npm --prefix client run dev -- --host 0.0.0.0"
for attempt in {1..30}; do
  curl -fsS http://localhost:3000 >/dev/null 2>&1 && break
  is_running client || fail "Client failed. See .run/logs/client.log"
  sleep 1
done
curl -fsS http://localhost:3000 >/dev/null 2>&1 ||
  fail "Client did not become reachable. See .run/logs/client.log"

harden_local_permissions

echo ""
ok "All services started (inbound webhook required and verified)."
echo "  Open: http://localhost:3000"
echo "  API:  http://localhost:8000"
echo "  Webhook: $WEBHOOK_URL"
echo "  Webhook registration: $(cat "$RUN_DIR/webhook-status" 2>/dev/null || echo pending)"
echo "  Logs: .run/logs/"
echo "  Stop: bash stop.sh"
