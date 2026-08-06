#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Samyoj — Doppler secrets setup (OPTIONAL)
# =============================================================================
# Doppler is an optional layer on top of server/.env. It is NOT required for
# local development — the app works exactly as before with server/.env alone.
#
# When you opt in, Doppler-injected secrets take precedence and anything not in
# Doppler falls back to server/.env (dotenv never overrides existing env vars).
#
# This script:
#   1. Installs the Doppler CLI if missing
#   2. Logs you in (interactive) and links a project
#   3. Pushes the current server/.env secrets into Doppler
#
# Usage:  bash scripts/doppler-setup.sh
# =============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/server/.env"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'
info() { echo -e "${CYAN}[doppler]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*"; exit 1; }

[[ -f "$ENV_FILE" ]] || fail "server/.env not found. Run bash setup.sh first."

# Doppler is linked at the repo root so `start.sh` (which cd's to ROOT_DIR before
# launching the API) and the `dev:doppler` npm script both resolve the project.
cd "$ROOT_DIR"

# --- 1. Install Doppler CLI if missing --------------------------------------
if ! command -v doppler >/dev/null 2>&1; then
  info "Doppler CLI not found. Installing (official installer)..."
  curl -sL --fail https://cli.doppler.com/install.sh | sh
  command -v doppler >/dev/null 2>&1 || fail "Doppler CLI install failed."
fi
ok "Doppler CLI $(doppler --version 2>/dev/null | sed 's/.*Version: //')"

# --- 2. Login + link project ------------------------------------------------
info "Logging in to Doppler (opens browser)..."
doppler login || fail "Doppler login failed."

if [[ -z "${DOPPLER_PROJECT:-}" ]]; then
  info "Linking a Doppler project..."
  doppler setup || fail "doppler setup failed. Create a project at https://dashboard.doppler.com first."
else
  info "Using DOPPLER_PROJECT=${DOPPLER_PROJECT}"
  doppler configure set project "$DOPPLER_PROJECT" >/dev/null
fi

CONFIG="${DOPPLER_CONFIG:-dev}"
doppler configure set config "$CONFIG" >/dev/null 2>&1 || true
ok "Linked to project '$(doppler configure get project --plain 2>/dev/null || echo '?')' / config '$CONFIG'"

# --- 3. Push server/.env secrets to Doppler ----------------------------------
info "Pushing server/.env secrets to Doppler ($CONFIG)..."
# Strip comments/blank lines, then upload the KEY=VALUE pairs in one shot.
# (META_WEBHOOK_URL is dynamic — the tunnel re-writes it each start, so it is
#  excluded here to avoid pinning a stale URL in Doppler.)
TMP_ENV="$(mktemp)"
grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" \
  | grep -v '^META_WEBHOOK_URL=' \
  > "$TMP_ENV"
doppler secrets upload "$TMP_ENV" --config "$CONFIG" >/dev/null
rm -f "$TMP_ENV"
ok "Secrets pushed to Doppler ($CONFIG)."

echo ""
echo "  Run the API with Doppler:  cd server && npm run dev:doppler"
echo "  Or enable it in start.sh:  USE_DOPPLER=1 bash start.sh"
echo "  Manage secrets:            https://dashboard.doppler.com"
