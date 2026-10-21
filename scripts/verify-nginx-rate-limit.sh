#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
limits="$root/config/nginx/samyoj-limits.conf"
grep -q 'zone=samyoj_api:10m rate=20r/s' "$limits"
grep -q 'zone=samyoj_hook:10m rate=50r/s' "$limits"
grep -q 'server_tokens off' "$limits"
grep -q 'gzip_types' "$limits"
echo "nginx rate limit verification passed"
