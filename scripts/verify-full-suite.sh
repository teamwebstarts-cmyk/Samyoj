#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$root/server" && npx vitest run)
(cd "$root/client" && npx vitest run)
(cd "$root/admin" && npx vitest run)
echo "full suite verification passed"
