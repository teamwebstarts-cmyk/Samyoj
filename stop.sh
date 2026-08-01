#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
RUN_DIR="$ROOT_DIR/.run"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[stop]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }

stop_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    stop_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

stop_service() {
  local name="$1"
  local pid_file="$RUN_DIR/$name.pid"
  if [[ ! -f "$pid_file" ]]; then
    info "$name was not started by start.sh"
    return
  fi
  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    stop_tree "$pid"
    ok "$name stopped"
  else
    info "$name was not running"
  fi
  rm -f "$pid_file"
}

stop_service client
stop_service api
stop_service tunnel
rm -f "$RUN_DIR/tunnel-url" "$RUN_DIR/webhook-status"

if [[ "${1:-}" == "--all" ]]; then
  info "Stopping PostgreSQL and Redis..."
  docker compose down
  ok "Docker services stopped"
else
  info "PostgreSQL and Redis remain running. Use 'bash stop.sh --all' to stop them too."
fi

ok "Samyoj stopped."
