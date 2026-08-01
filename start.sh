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
NC='\033[0m'

info()  { echo -e "${CYAN}[start]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
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

[[ -f server/.env ]] || fail "server/.env is missing. Run bash setup.sh first."
[[ -d server/node_modules && -d client/node_modules ]] ||
  fail "Dependencies are missing. Run bash setup.sh first."
ENCRYPTION_KEY="$(grep -m1 '^ENCRYPTION_KEY=' server/.env | cut -d= -f2- || true)"
[[ "$ENCRYPTION_KEY" =~ ^[0-9a-fA-F]{64}$ ]] ||
  fail "ENCRYPTION_KEY must be exactly 64 hexadecimal characters. Run bash setup.sh."

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
(cd server && npx prisma migrate deploy)
ok "Database schema is current"

if ! is_running tunnel; then
  rm -f "$RUN_DIR/tunnel-url" "$RUN_DIR/webhook-status"
  info "Starting ngrok tunnel..."
  start_process tunnel "bash scripts/dev-tunnel.sh"
  for attempt in {1..35}; do
    [[ -s "$RUN_DIR/tunnel-url" ]] && break
    is_running tunnel || fail "Tunnel failed. See .run/logs/tunnel.log"
    sleep 1
  done
  [[ -s "$RUN_DIR/tunnel-url" ]] || fail "Tunnel URL was not created. See .run/logs/tunnel.log"
else
  ok "tunnel is already running"
  [[ -s "$RUN_DIR/tunnel-url" ]] ||
    fail "Tunnel PID exists but its URL is missing. Run bash stop.sh, then bash start.sh."
fi

info "Starting API server..."
start_process api "npm --prefix server run dev"

for attempt in {1..30}; do
  curl -fsS http://localhost:8000/health >/dev/null 2>&1 && break
  is_running api || fail "API failed. See .run/logs/api.log"
  sleep 1
done
curl -fsS http://localhost:8000/health >/dev/null 2>&1 ||
  fail "API did not become healthy. See .run/logs/api.log"
ok "API is healthy"

info "Starting Client..."
start_process client "npm --prefix client run dev -- --host 0.0.0.0"
for attempt in {1..30}; do
  curl -fsS http://localhost:3000 >/dev/null 2>&1 && break
  is_running client || fail "Client failed. See .run/logs/client.log"
  sleep 1
done
curl -fsS http://localhost:3000 >/dev/null 2>&1 ||
  fail "Client did not become reachable. See .run/logs/client.log"

echo ""
ok "All services started."
echo "  Open: http://localhost:3000"
echo "  API:  http://localhost:8000"
echo "  Webhook: $(cat "$RUN_DIR/tunnel-url")/api/whatsapp/webhook"
echo "  Webhook registration: $(cat "$RUN_DIR/webhook-status" 2>/dev/null || echo pending)"
echo "  Logs: .run/logs/"
echo "  Stop: bash stop.sh"
