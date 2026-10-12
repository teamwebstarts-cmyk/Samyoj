#!/usr/bin/env bash
# Drop old host logs before a deploy so the 10GB disk does not fill up.
# Does not touch Postgres, Redis keys, uploads, or .env.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/samyoj/Samyoj}"
log() { echo "[trim] $*"; }

PM2_LOG_DIR="${PM2_LOG_DIR:-$HOME/.pm2/logs}"
if [[ -d "$PM2_LOG_DIR" ]]; then
  while IFS= read -r -d '' f; do
    tail -n 2000 "$f" > "$f.trim"
    mv "$f.trim" "$f"
    log "kept last 2000 lines of $f"
  done < <(find "$PM2_LOG_DIR" -type f -name '*.log' -size +20M -print0)
fi

FFMPEG_CACHE="${HOME}/.cache/ffmpeg-static-nodejs"
FFMPEG_BIN="$APP_DIR/server/node_modules/ffmpeg-static/ffmpeg"
if [[ -d "$FFMPEG_CACHE" && -x "$FFMPEG_BIN" ]]; then
  rm -rf "$FFMPEG_CACHE"
  log "removed ffmpeg download cache"
fi

if ! sudo -n true 2>/dev/null; then
  log "no passwordless sudo; skipped journal, ops-agent, and redis cap"
  exit 0
fi

sudo journalctl --vacuum-size=80M
log "journal capped at 80M"

OPS_DIR=/var/log/google-cloud-ops-agent
if [[ -d "$OPS_DIR" ]]; then
  sudo find "$OPS_DIR" -type f \( -name '*.gz' -o -name '*.old' -o -name '*.log.[0-9]*' \) -delete
  sudo find "$OPS_DIR" -type f -name '*.log' -size +50M -exec truncate -s 0 {} \;
  log "ops-agent logs trimmed"
fi

# A leaked queue must not eat the 4GB VM. noeviction refuses new writes
# instead of deleting webhook jobs. 256MB is far above current use (~2MB).
current="$(redis-cli CONFIG GET maxmemory | awk 'NR==2')"
if [[ "$current" == "0" ]]; then
  redis-cli CONFIG SET maxmemory 268435456 >/dev/null
  redis-cli CONFIG SET maxmemory-policy noeviction >/dev/null
  conf=/etc/redis/redis.conf
  if [[ -f "$conf" ]]; then
    sudo sed -i \
      -e 's/^#\s*maxmemory .*/maxmemory 256mb/' \
      -e 's/^maxmemory .*/maxmemory 256mb/' \
      -e 's/^#\s*maxmemory-policy .*/maxmemory-policy noeviction/' \
      -e 's/^maxmemory-policy .*/maxmemory-policy noeviction/' \
      "$conf"
    sudo grep -q '^maxmemory ' "$conf" || echo 'maxmemory 256mb' | sudo tee -a "$conf" >/dev/null
    sudo grep -q '^maxmemory-policy ' "$conf" || echo 'maxmemory-policy noeviction' | sudo tee -a "$conf" >/dev/null
  fi
  log "redis maxmemory set to 256mb noeviction"
fi
