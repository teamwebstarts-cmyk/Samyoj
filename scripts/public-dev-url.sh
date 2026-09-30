#!/usr/bin/env bash
# Stable GitHub Codespaces HTTPS URLs (same name until the codespace is deleted).
# UI + Meta OAuth: port 3000. Inbound webhook: port 8000 (API directly).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/server/.env"

codespace_name() {
  [[ -n "${CODESPACE_NAME:-}" ]]
}

codespace_domain() {
  echo "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
}

# https://{name}-3000.app.github.dev
codespace_client_origin() {
  codespace_name || return 1
  echo "https://${CODESPACE_NAME}-3000.$(codespace_domain)"
}

# https://{name}-8000.app.github.dev
codespace_api_origin() {
  codespace_name || return 1
  echo "https://${CODESPACE_NAME}-8000.$(codespace_domain)"
}

write_env_key() {
  local key="$1"
  local value="$2"
  ENV_FILE="$ENV_FILE" ENV_KEY="$key" ENV_VALUE="$value" node <<'NODE'
const fs = require('node:fs');
const file = process.env.ENV_FILE;
const key = process.env.ENV_KEY;
const value = process.env.ENV_VALUE;
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const index = lines.findIndex((line) => line.startsWith(`${key}=`));
if (index >= 0) lines[index] = `${key}=${value}`;
else lines.push(`${key}=${value}`);
fs.writeFileSync(file, lines.join('\n'));
NODE
}

# Cursor/SSH sessions do not always mark Meta ports public; gh can fix it in-place.
ensure_codespace_ports_public() {
  codespace_name || return 0
  command -v gh >/dev/null 2>&1 || return 0
  gh codespace ports visibility 3000:public 3001:public 8000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 || true
}

apply_codespace_env() {
  local client_origin api_origin webhook_url
  client_origin="$(codespace_client_origin)"
  api_origin="$(codespace_api_origin)"
  webhook_url="${api_origin}/api/whatsapp/webhook"
  write_env_key CLIENT_URL "$client_origin"
  write_env_key SERVER_URL "$api_origin"
  write_env_key BASE_URL "$api_origin"
  write_env_key META_REDIRECT_URI "${client_origin}/settings/whatsapp/callback/popup"
  write_env_key META_WEBHOOK_URL "$webhook_url"
  echo "$client_origin" > "${ROOT_DIR}/.run/codespace-client-url"
  echo "$api_origin" > "${ROOT_DIR}/.run/codespace-api-url"
  echo "$webhook_url" > "${ROOT_DIR}/.run/public-webhook-url"
}

# Returns 0 when the public HTTPS preview answers (not GitHub 404).
probe_https_status() {
  local url="$1"
  local code
  code="$(
    URL="$url" node <<'NODE' 2>/dev/null || echo "000"
const url = process.env.URL;
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 12000);
fetch(url, { signal: ctrl.signal, redirect: 'follow' })
  .then((res) => process.stdout.write(String(res.status)))
  .catch(() => process.stdout.write('000'))
  .finally(() => clearTimeout(t));
NODE
  )"
  [[ "$code" =~ ^[23] ]]
}

verify_webhook_challenge() {
  local webhook_url="$1"
  local verify_token="$2"
  local verify_url="${webhook_url}?hub.mode=subscribe&hub.verify_token=${verify_token}&hub.challenge=ping"
  local body
  body="$(
    VERIFY_URL="$verify_url" node <<'NODE' 2>/dev/null || true
const url = process.env.VERIFY_URL;
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 12000);
fetch(url, { signal: ctrl.signal })
  .then(async (res) => process.stdout.write(await res.text()))
  .catch(() => {})
  .finally(() => clearTimeout(t));
NODE
  )"
  [[ "$body" == "ping" ]]
}
