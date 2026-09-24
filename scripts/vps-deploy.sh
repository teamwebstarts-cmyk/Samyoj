#!/usr/bin/env bash
# Production deploy for samyoj-server. Run as user samyoj.
# Always re-pins Meta webhook to app.samyoj.com so local ngrok cannot steal inbound.
set -euo pipefail
APP=/home/samyoj/Samyoj
PM2=/usr/bin/pm2
BRANCH="${DEPLOY_BRANCH:-main}"

echo "===== 1. Pull origin/${BRANCH} ====="
cd "$APP"
[[ -z "$(git status --porcelain)" ]] || { echo "Refusing deploy with a dirty working tree"; exit 1; }
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/${BRANCH}"
echo "HEAD=$(git rev-parse --short HEAD) BRANCH=$(git branch --show-current) MSG=$(git log -1 --format=%s)"

echo "===== 2. Server deps + prisma generate ====="
cd "$APP/server"
grep -q '^NODE_ENV=production$' .env || { echo "NODE_ENV=production is required"; exit 1; }
grep -q '^OAUTH_STATE_SECRET=.\+' .env || { echo "OAUTH_STATE_SECRET is required"; exit 1; }
grep -q '^ALLOW_UNVERIFIED_LOGIN=false$' .env || { echo "ALLOW_UNVERIFIED_LOGIN=false is required"; exit 1; }
grep -q '^PLATFORM_MFA_REQUIRED=true$' .env || { echo "PLATFORM_MFA_REQUIRED=true is required"; exit 1; }
npm ci 2>&1 | tail -4
npx prisma generate 2>&1 | tail -3

echo "===== 3. Safe migrate ====="
npm run db:backup
npm run db:migrate-startup-safe 2>&1 | tail -8

echo "===== 4. Build server ====="
npm run build 2>&1 | tail -5
echo "server build OK"

echo "===== 5. Build client ====="
cd "$APP/client"
npm ci 2>&1 | tail -2
npm run build 2>&1 | tail -3
echo "client build OK"

echo "===== 6. Build admin ====="
cd "$APP/admin"
npm ci 2>&1 | tail -2
npm run build 2>&1 | tail -3
echo "admin build OK"

echo "===== 7. Pin production webhook URL + register with Meta ====="
cd "$APP/server"
node - <<'NODE'
const fs = require('fs');
const envPath = '/home/samyoj/Samyoj/server/.env';
const want = 'META_WEBHOOK_URL=https://app.samyoj.com/api/whatsapp/webhook';
let env = fs.readFileSync(envPath, 'utf8');
if (!/^META_WEBHOOK_URL=/m.test(env)) env = env.replace(/\n?$/, '\n') + want + '\n';
else env = env.replace(/^META_WEBHOOK_URL=.*/m, want);
fs.writeFileSync(envPath, env);
fs.chmodSync(envPath, 0o600);
console.log('WEBHOOK_URL_OK');
NODE
npm run setup-webhook 2>&1 | tail -8

echo "===== 8. Restart PM2 ====="
$PM2 restart whatsapp-api --update-env
sleep 4

echo "===== 9. Wait for health ====="
for i in $(seq 1 45); do
  if curl -fsS --max-time 5 http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "API healthy after ${i}s"; break
  fi
  if [ "$i" = 45 ]; then echo "API FAILED TO BECOME HEALTHY"; exit 1; fi
  sleep 1
done
echo "DEPLOY_STEPS_DONE"

echo "===== 10. Production smoke ====="
cd "$APP"
APP_DIR="$APP" bash scripts/vps-prod-smoke.sh
