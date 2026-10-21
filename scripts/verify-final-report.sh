#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
report="$root/docs/audit/AWS_VPS_FIX_RESULTS_2026-10-21.md"
test -f "$report"
for id in P0-1 P1-1 P1-2 P2-1 P2-2 P2-3 P2-4 P3-1 P3-2 P3-3 P3-4 P3-5 P3-6 P3-7 P3-8; do
  grep -q "$id" "$report"
done
grep -q 'Self-score' "$report"
echo "final report verification passed"
