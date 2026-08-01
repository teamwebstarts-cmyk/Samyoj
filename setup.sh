#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[setup]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

env_value() {
  grep -m1 "^$1=" server/.env 2>/dev/null | cut -d= -f2- || true
}

info "Checking prerequisites..."
for command_name in node npm docker curl; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required but not installed."
done
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 18 ]] || fail "Node.js 18+ is required (found $(node --version))."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."
docker info >/dev/null 2>&1 || fail "Docker is installed but not running."
ok "Node $(node --version), npm $(npm --version), and Docker are ready"

info "Preparing environment files..."
for dir in server client; do
  if [[ ! -f "$dir/.env" ]]; then
    [[ -f "$dir/.env.example" ]] || fail "$dir/.env.example is missing."
    cp "$dir/.env.example" "$dir/.env"
    ok "Created $dir/.env"
  fi
done

if ! command -v ngrok >/dev/null 2>&1; then
  info "Installing ngrok..."
  npm install --global ngrok || fail "ngrok installation failed. Install it from https://ngrok.com/download and retry."
fi
ok "$(ngrok version)"

NGROK_AUTH_TOKEN="$(env_value NGROK_AUTHTOKEN)"
NGROK_CONFIGURED=false
if [[ -n "$NGROK_AUTH_TOKEN" ]]; then
  ngrok config add-authtoken "$NGROK_AUTH_TOKEN" >/dev/null || fail "Could not save NGROK_AUTHTOKEN."
  NGROK_CONFIGURED=true
elif ngrok config check >/dev/null 2>&1 && grep -q 'authtoken:' "$HOME/.config/ngrok/ngrok.yml" 2>/dev/null; then
  NGROK_CONFIGURED=true
fi

if [[ "$NGROK_CONFIGURED" != true ]]; then
  echo
  warn "An ngrok authtoken is required for inbound WhatsApp replies."
  echo "  Get it from: https://dashboard.ngrok.com/get-started/your-authtoken"
  read -r -s -p "  Paste ngrok authtoken: " NGROK_AUTH_TOKEN
  echo
  [[ -n "$NGROK_AUTH_TOKEN" ]] || fail "No ngrok authtoken was provided."
  ngrok config add-authtoken "$NGROK_AUTH_TOKEN" >/dev/null || fail "ngrok rejected the token."
fi
ok "ngrok authentication is configured"

for key in META_APP_ID META_APP_SECRET META_VERIFY_TOKEN; do
  value="$(env_value "$key")"
  if [[ -z "$value" || "$value" == your_* || "$value" == replace-* ]]; then
    fail "$key must be configured in server/.env."
  fi
done

info "Starting PostgreSQL and Redis..."
docker compose up -d
for attempt in {1..30}; do
  docker exec whatsapp_postgres pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec whatsapp_postgres pg_isready -U postgres >/dev/null 2>&1 || fail "PostgreSQL did not become ready."
for attempt in {1..15}; do
  docker exec whatsapp_redis redis-cli ping >/dev/null 2>&1 && break
  sleep 1
done
docker exec whatsapp_redis redis-cli ping >/dev/null 2>&1 || fail "Redis did not become ready."
ok "PostgreSQL and Redis are ready"

info "Installing application dependencies..."
npm install
npm --prefix server install
npm --prefix client install
ok "Dependencies installed"

info "Generating Prisma client and applying migrations..."
npm --prefix server run db:generate
(cd server && npx prisma migrate deploy)
ok "Database is ready"

info "Starting Samyoj..."
bash "$ROOT_DIR/start.sh"
