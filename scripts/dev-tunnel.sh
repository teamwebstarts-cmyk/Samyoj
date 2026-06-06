#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/.bin"
ENV_FILE="$ROOT_DIR/server/.env"
CLOUDFLARED="$BIN_DIR/cloudflared"
PORT="${TUNNEL_PORT:-5000}"
TARGET="http://localhost:${PORT}"

mkdir -p "$BIN_DIR"

if command -v cloudflared >/dev/null 2>&1; then
  CLOUDFLARED="$(command -v cloudflared)"
elif [[ ! -x "$CLOUDFLARED" ]]; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64) ASSET="cloudflared-linux-amd64" ;;
    aarch64|arm64) ASSET="cloudflared-linux-arm64" ;;
    *)
      echo "Unsupported architecture: $ARCH"
      echo "Install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
      exit 1
      ;;
  esac

  URL="https://github.com/cloudflare/cloudflared/releases/latest/download/${ASSET}"
  echo "Downloading cloudflared (${ASSET})..."
  curl -fsSL "$URL" -o "$CLOUDFLARED"
  chmod +x "$CLOUDFLARED"
fi

wait_for_tunnel() {
  local webhook_url="$1"
  local verify_token="$2"
  local max_attempts="${3:-60}"
  local attempt=1

  local verify_url="${webhook_url}?hub.mode=subscribe&hub.verify_token=${verify_token}&hub.challenge=ping"

  echo "Waiting for tunnel to be reachable (up to ${max_attempts}s)..."
  while [[ "$attempt" -le "$max_attempts" ]]; do
    local body
    body="$(curl -s --max-time 5 "$verify_url" 2>/dev/null || true)"
    if [[ "$body" == "ping" ]]; then
      echo "Tunnel is reachable (webhook verification OK)."
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done

  echo "Tunnel not reachable after ${max_attempts}s."
  return 1
}

update_webhook_env() {
  local tunnel_url="$1"
  local webhook_url="${tunnel_url}/api/whatsapp/webhook"

  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Could not update $ENV_FILE (file not found)"
    return
  fi

  if grep -q '^META_WEBHOOK_URL=' "$ENV_FILE"; then
    sed -i "s|^META_WEBHOOK_URL=.*|META_WEBHOOK_URL=${webhook_url}|" "$ENV_FILE"
  else
    echo "META_WEBHOOK_URL=${webhook_url}" >> "$ENV_FILE"
  fi

  echo
  echo "Updated server/.env:"
  echo "  META_WEBHOOK_URL=${webhook_url}"

  if ! wait_for_tunnel "$webhook_url" "$(grep '^META_VERIFY_TOKEN=' "$ENV_FILE" | cut -d= -f2-)"; then
    echo "Webhook registration skipped — tunnel not ready yet."
    echo "Once the server is running, run: cd server && npm run setup-webhook"
    echo
    return
  fi

  echo "Registering webhook with Meta..."
  local attempt=1
  while [[ "$attempt" -le 5 ]]; do
    if (cd "$ROOT_DIR/server" && npm run setup-webhook); then
      echo "Webhook registered. Incoming messages should work now."
      echo
      return
    fi
    if [[ "$attempt" -lt 5 ]]; then
      echo "Webhook registration failed (attempt ${attempt}/5), retrying in 5s..."
      sleep 5
    fi
    attempt=$((attempt + 1))
  done

  echo "Webhook registration failed. Run manually: cd server && npm run setup-webhook"
  echo
}

echo "Starting tunnel -> ${TARGET}"
echo "Watching for tunnel URL to update server/.env automatically..."
echo

"$CLOUDFLARED" tunnel --url "$TARGET" 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [[ "$line" =~ https://[a-z0-9-]+\.trycloudflare\.com ]]; then
    TUNNEL_URL="${BASH_REMATCH[0]}"
    if [[ ! -f "$ENV_FILE.updated" ]] || [[ "$(cat "$ENV_FILE.updated" 2>/dev/null)" != "$TUNNEL_URL" ]]; then
      update_webhook_env "$TUNNEL_URL"
      echo "$TUNNEL_URL" > "$ENV_FILE.updated"
    fi
  fi
done
