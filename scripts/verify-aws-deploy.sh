#!/usr/bin/env bash
set -euo pipefail
health="$(curl -fsS --max-time 20 https://app.samyoj.com/health)"
printf '%s' "$health" | grep -q '"status":"ok"'
printf '%s' "$health" | grep -q '"commit":"'
printf '%s' "$health" | grep -q '"workersStarted":true'
head_code="$(curl -sS -o /dev/null -w '%{http_code}' -I --max-time 20 https://app.samyoj.com/login)"
test "$head_code" = "200"
bad="$(curl -sS --max-time 20 -X POST https://app.samyoj.com/.env -H 'Content-Type: application/json' --data '0x%5B%5D=DTAB')"
printf '%s' "$bad" | grep -q 'INVALID_JSON'
echo "aws deploy verification passed"
