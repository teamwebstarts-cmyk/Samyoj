#!/usr/bin/env bash
# Production stack smoke test — run on samyoj-server after deploy.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/samyoj/Samyoj}"
ENV_FILE="$APP_DIR/server/.env"
FAIL=0

ok()   { echo "[ok] $*"; }
fail() { echo "[FAIL] $*"; FAIL=1; }
info() { echo "[..] $*"; }

info "health"
HEALTH=$(curl -sS --max-time 10 http://127.0.0.1:8000/health || true)
echo "$HEALTH" | grep -q '"status":"ok"' && ok "api health" || fail "api health"

info "postgres + redis via health"
echo "$HEALTH" | grep -q '"database":"ok"' && ok "postgres" || fail "postgres"
echo "$HEALTH" | grep -q '"redis":"ok"' && ok "redis" || fail "redis"
echo "$HEALTH" | grep -q '"workersStarted":true' && ok "embedded workers" || fail "embedded workers"

info "webhook health"
WH=$(curl -sS --max-time 10 http://127.0.0.1:8000/api/whatsapp/webhook/health || true)
echo "$WH" | grep -q '"webhookConfigured":true' && ok "webhook configured" || fail "webhook configured"
echo "$WH" | grep -q '"appSecretConfigured":true' && ok "meta app secret" || fail "meta app secret"

VERIFY=$(grep -m1 '^META_VERIFY_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
CH=$(curl -sS --max-time 10 "http://127.0.0.1:8000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=ping" || true)
[[ "$CH" == "ping" ]] && ok "webhook challenge" || fail "webhook challenge got: $CH"

PUBLIC=$(curl -sS --max-time 15 "https://app.samyoj.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=ping" || true)
[[ "$PUBLIC" == "ping" ]] && ok "public nginx webhook" || fail "public nginx webhook got: $PUBLIC"

info "env keys (names only)"
for key in META_APP_ID META_APP_SECRET META_WEBHOOK_URL SARVAM_API_KEY DATABASE_URL REDIS_URL ENCRYPTION_KEY JWT_SECRET; do
  if grep -q "^${key}=" "$ENV_FILE" && [[ -n "$(grep "^${key}=" "$ENV_FILE" | cut -d= -f2-)" ]]; then
    ok "env $key set"
  else
    fail "env $key missing or empty"
  fi
done

grep -q '^META_ALLOW_TUNNEL_WEBHOOK=' "$ENV_FILE" && fail "META_ALLOW_TUNNEL_WEBHOOK must not be on VPS" || ok "no tunnel override on prod"

info "ops error log"
OPS_LOG=$(grep -m1 '^OPS_ERROR_LOG=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || echo "$APP_DIR/.run/logs/ops-errors.log")
if [[ -f "$OPS_LOG" ]] || [[ -w "$(dirname "$OPS_LOG")" ]]; then
  ok "ops error log path writable: $OPS_LOG"
else
  fail "ops error log not writable: $OPS_LOG"
fi

info "sarvam + webrtc (node)"
sudo -u samyoj bash -c "cd '$APP_DIR/server' && node - <<'NODE'
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const checks = [];
function pass(name) { checks.push({ name, ok: true }); }
function fail(name, detail) { checks.push({ name, ok: false, detail }); }

if (process.env.SARVAM_API_KEY) pass('SARVAM_API_KEY');
else fail('SARVAM_API_KEY', 'missing');

try {
  require('@roamhq/wrtc');
  pass('webrtc @roamhq/wrtc');
} catch (e) {
  fail('webrtc @roamhq/wrtc', e.message);
}

(async () => {
  if (!process.env.SARVAM_API_KEY) {
    print();
    process.exit(1);
  }
  try {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        inputs: ['Samyoj production smoke test'],
        target_language_code: 'en-IN',
        speaker: 'shubh',
        model: 'bulbul:v3',
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) pass('sarvam TTS API');
    else fail('sarvam TTS API', 'HTTP ' + res.status);
  } catch (e) {
    fail('sarvam TTS API', e.message);
  }
  print();
  process.exit(checks.some((c) => !c.ok) ? 1 : 0);
})();

function print() {
  for (const c of checks) {
    console.log(c.ok ? '[ok] ' + c.name : '[FAIL] ' + c.name + (c.detail ? ': ' + c.detail : ''));
  }
}
NODE"

SMOKE_NODE=$?
[[ "$SMOKE_NODE" -eq 0 ]] && ok "node stack checks" || fail "node stack checks"

info "pm2"
PM2_JSON=$(sudo -u samyoj pm2 jlist 2>/dev/null || echo '[]')
PM2_VERDICT=$(echo "$PM2_JSON" | python3 -c "
import sys, json
procs = json.load(sys.stdin)
names = [p.get('name','') for p in procs]
status = {p.get('name',''): p.get('pm2_env',{}).get('status') for p in procs}
out = []
if 'whatsapp-api' in names and status.get('whatsapp-api') == 'online':
    out.append('api_ok')
else:
    out.append('api_bad')
if 'whatsapp-worker' in names:
    out.append('worker_bad')
else:
    out.append('worker_ok')
print(','.join(out))
")
[[ "$PM2_VERDICT" == *api_ok* ]] && ok "pm2 whatsapp-api online" || fail "pm2 whatsapp-api"
[[ "$PM2_VERDICT" == *worker_ok* ]] && ok "no duplicate worker" || fail "whatsapp-worker must not run"

info "public site"
curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://app.samyoj.com/health | grep -q 200 && ok "https://app.samyoj.com/health" || fail "public health"

if [[ "$FAIL" -ne 0 ]]; then
  echo "SMOKE TEST FAILED"
  exit 1
fi
echo "SMOKE TEST PASSED"
