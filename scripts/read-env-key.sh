#!/usr/bin/env bash
# Usage: read_env_key <env-file> <KEY>
# Prints the value (no export). Safe with CRLF, quotes, and Windows paths via node.
set -euo pipefail
file="$1"
key="$2"
node - "$file" "$key" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const key = process.argv[3];
if (!file || !key) process.exit(1);
let value = '';
for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  if (!line || line.trimStart().startsWith('#')) continue;
  if (!line.startsWith(`${key}=`)) continue;
  value = line.slice(key.length + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  break;
}
process.stdout.write(value);
NODE
