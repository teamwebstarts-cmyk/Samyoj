#!/usr/bin/env bash
# G1 — P0-1 backup tooling verification.
# Proves the real script end-to-end inside a throwaway Postgres 17 container
# (real pg_dump/pg_restore/peer auth, not mocks):
#   0. syntax, units, safe defaults, single-run lock
#   1. refusal path: missing DB exits 2, never 0, and leaves no file
#   2. happy path: dump -> pg_restore --list -> upload -> prune
#   3. restore drill passes when counts match
#   4. negative control: injected row drift makes the drill exit 5
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/backup-db.sh"
SERVICE="$ROOT/config/systemd/samyoj-db-backup.service"
TIMER="$ROOT/config/systemd/samyoj-db-backup.timer"
BUCKET="samyoj-backups-157328692150"
WORK="$(mktemp -d)"

fail() { echo "G1 FAIL: $*"; exit 1; }

[ -f "$SCRIPT" ] || fail "missing scripts/backup-db.sh"
bash -n "$SCRIPT" || fail "backup script has a syntax error"
[ -x "$SCRIPT" ] || fail "backup script is not executable"
grep -q 'whatsapp_platform' "$SCRIPT" || fail "default DB name is not whatsapp_platform"
grep -q 'pg_restore --list' "$SCRIPT" || fail "missing archive readability check"
grep -q 'MISMATCH' "$SCRIPT" || fail "missing restore row-count comparison"
grep -q 'find "$DIR"' "$SCRIPT" || fail "missing local prune"
grep -q 'aws s3 cp' "$SCRIPT" || fail "missing S3 upload"
grep -q 'gzip' "$SCRIPT" || fail "missing local compression"
for unit in "$SERVICE" "$TIMER"; do
  [ -f "$unit" ] || fail "missing unit $(basename "$unit")"
  grep -q '^\[Unit\]' "$unit" || fail "$(basename "$unit") has no [Unit]"
done
grep -q '^OnCalendar=' "$TIMER" || fail "timer has no OnCalendar"
grep -q '^Persistent=true' "$TIMER" || fail "timer is not Persistent"
grep -q 'flock' "$SERVICE" || fail "service has no single-run lock"

docker info >/dev/null 2>&1 || fail "docker daemon is not reachable"

CONTAINER="samyoj-backup-gate-$$"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=gate -e POSTGRES_DB=whatsapp_platform \
  postgres:17-alpine -c fsync=off -c full_page_writes=off >/dev/null
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1; rm -rf "$WORK"; }
trap cleanup EXIT
for _ in $(seq 1 90); do
  if docker exec "$CONTAINER" psql -U postgres -d whatsapp_platform -tAc 'SELECT 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$CONTAINER" psql -U postgres -d whatsapp_platform -tAc 'SELECT 1' >/dev/null 2>&1 \
  || fail "throwaway postgres did not become ready"

docker exec -i "$CONTAINER" psql -U postgres -d whatsapp_platform -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE organizations (id serial PRIMARY KEY);
CREATE TABLE users (id serial PRIMARY KEY);
CREATE TABLE contacts (id serial PRIMARY KEY);
CREATE TABLE conversations (id serial PRIMARY KEY);
CREATE TABLE messages (id serial PRIMARY KEY);
CREATE TABLE whatsapp_numbers (id serial PRIMARY KEY);
INSERT INTO organizations DEFAULT VALUES;
INSERT INTO users DEFAULT VALUES;
INSERT INTO users DEFAULT VALUES;
INSERT INTO contacts DEFAULT VALUES;
INSERT INTO conversations DEFAULT VALUES;
INSERT INTO messages DEFAULT VALUES;
INSERT INTO messages DEFAULT VALUES;
INSERT INTO messages DEFAULT VALUES;
INSERT INTO whatsapp_numbers DEFAULT VALUES;
SQL

# aws stub: exercises the upload path without touching real S3.
# sudo stub: the container has no sudo, and we already run as root there.
docker exec -i "$CONTAINER" bash -lc 'cat > /usr/local/bin/aws <<"STUB"
#!/usr/bin/env bash
if [ "$1" = "s3" ] && [ "$2" = "cp" ]; then
  test -s "$3" || { echo "stub: empty source $3" >&2; exit 1; }
  echo "$4" >> /tmp/uploads.log
  exit 0
fi
echo "stub aws: unsupported $*" >&2
exit 1
STUB
cat > /usr/local/bin/sudo <<"SUDO"
#!/usr/bin/env bash
[ "$1" = "-u" ] && shift 2
export PGUSER=postgres
exec "$@"
SUDO
chmod +x /usr/local/bin/aws /usr/local/bin/sudo'
docker cp "$SCRIPT" "$CONTAINER:/usr/local/bin/samyoj-db-backup.sh"
docker exec "$CONTAINER" chmod +x /usr/local/bin/samyoj-db-backup.sh

run_backup() { # db_name verify [fault]
  docker exec -i -e BACKUP_DIR=/var/backups/samyoj -e BACKUP_S3_BUCKET="$BUCKET" \
    -e BACKUP_DB_NAME="$1" -e BACKUP_VERIFY="$2" -e BACKUP_FAULT_AFTER_RESTORE="${3:-}" \
    "$CONTAINER" /usr/local/bin/samyoj-db-backup.sh 2>&1
}

# 1. Refusal path.
set +e
out="$(run_backup does_not_exist 0)"
refusal=$?
set -e
printf '%s\n' "$out" > "$WORK/refusal.log"
[ "$refusal" = "2" ] || { cat "$WORK/refusal.log"; fail "missing DB exited $refusal, expected 2"; }
count="$(docker exec "$CONTAINER" bash -lc 'ls /var/backups/samyoj/db-*.dump 2>/dev/null | wc -l')"
[ "$count" = "0" ] || fail "refusal path left a partial dump behind"

# 2. Happy path.
set +e
out="$(run_backup whatsapp_platform 0)"
happy=$?
set -e
printf '%s\n' "$out" > "$WORK/happy.log"
[ "$happy" = "0" ] || { cat "$WORK/happy.log"; fail "happy path exited $happy"; }
grep -q 'dump ok' "$WORK/happy.log" || fail "script did not confirm a readable dump"
grep -q 'uploaded s3://' "$WORK/happy.log" || fail "upload did not run"
uploads="$(docker exec "$CONTAINER" bash -lc 'wc -l < /tmp/uploads.log 2>/dev/null || echo 0')"
[ "$uploads" -ge 1 ] || fail "aws stub recorded no upload"

# 3. Restore drill on matching data.
set +e
out="$(run_backup whatsapp_platform 1)"
drill=$?
set -e
printf '%s\n' "$out" > "$WORK/drill.log"
[ "$drill" = "0" ] || { cat "$WORK/drill.log"; fail "restore drill exited $drill"; }
grep -q 'restore verification ok' "$WORK/drill.log" || fail "drill did not confirm success"

# 4. Negative control: fault injection must make the drill fail with 5.
set +e
out="$(run_backup whatsapp_platform 1 'INSERT INTO contacts DEFAULT VALUES')"
negative=$?
set -e
printf '%s\n' "$out" > "$WORK/negative.log"
[ "$negative" = "5" ] || { cat "$WORK/negative.log"; fail "mismatch drill exited $negative, expected 5"; }
grep -q 'MISMATCH contacts' "$WORK/negative.log" || { cat "$WORK/negative.log"; fail "mismatch was not reported"; }
scratch_left="$(docker exec "$CONTAINER" bash -lc "psql -U postgres -tAc \"SELECT count(*) FROM pg_database WHERE datname='samyoj_restore_check'\"")"
[ "$scratch_left" = "0" ] || fail "scratch DB was left behind"

echo "backup tooling verification passed"
