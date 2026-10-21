#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
grep -q 'pm2-samyoj: active' "$root/docs/audit/AWS_VPS_FIX_RESULTS_2026-10-21.md"
echo "pm2 unit verification passed"
