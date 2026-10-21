#!/usr/bin/env bash
# Nightly Samyoj database backup. Runs as root via samyoj-db-backup.timer.
#
# Design (ponytail: reuse the running pg_dump/pg_restore/aws binaries already on
# the box; peer auth as the postgres OS user means no secret is written to disk):
#   1. pg_dump -Fc into /var/backups/samyoj (mode 600, dir 700)
#   2. prove the archive is readable with `pg_restore --list` (fails on truncation)
#   3. upload to s3://<bucket>/db/<date>.dump (instance role, SSE-S3)
#   4. keep 7 days locally; S3 lifecycle keeps 35 daily
#   5. every Sunday also upload into weekly/ for the 400-day archive rule
#   6. every Sunday (or BACKUP_VERIFY=1) restore into samyoj_restore_check and
#      compare the six core row counts against live; drop the scratch DB after
#
# Exit codes: 0 ok, 2 dump failed, 3 archive unreadable, 4 upload failed,
#             5 restore verification mismatch (only when verification runs)
set -euo pipefail

DB_NAME="${BACKUP_DB_NAME:-whatsapp_platform}"
DB_USER="${BACKUP_DB_USER:-postgres}"
DIR="${BACKUP_DIR:-/var/backups/samyoj}"
BUCKET="${BACKUP_S3_BUCKET:-samyoj-backups-157328692150}"
LOCAL_DAYS="${BACKUP_LOCAL_DAYS:-7}"
SCRATCH_DB="${BACKUP_SCRATCH_DB:-samyoj_restore_check}"
LOG_TAG="samyoj-db-backup"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { local code="$1"; shift; log "FAILED($code): $*"; exit "$code"; }

command -v pg_dump >/dev/null || die 2 "pg_dump not found"
command -v pg_restore >/dev/null || die 2 "pg_restore not found"

[ "$(id -un)" = "root" ] || die 2 "must run as root (systemd runs it as root)"

# postgres must be able to write the target. mkdir is root's, so open the dir
# (and give it to postgres) instead of trying to write as root from pg_dump.
install -d -m 750 -o "$DB_USER" -g "$DB_USER" "$DIR"
chown "$DB_USER:" "$DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
day="$(date -u +%F)"
file="$DIR/db-$stamp.dump"

log "dumping $DB_NAME -> $file"
if ! sudo -u "$DB_USER" pg_dump -Fc --no-owner --no-acl -Z 6 -f "$file" "$DB_NAME"; then
  rm -f "$file"
  die 2 "pg_dump failed"
fi
chmod 600 "$file"

# Never upload a truncated archive: --list parses the whole TOC.
if ! sudo -u "$DB_USER" pg_restore --list "$file" >/dev/null 2>&1; then
  die 3 "archive unreadable: $file"
fi
size="$(stat -c %s "$file")"
log "dump ok ($size bytes)"

upload() {
  local src="$1" key="$2"
  aws s3 cp "$src" "s3://$BUCKET/$key" --sse AES256 --only-show-errors \
    || die 4 "upload failed: $key"
  log "uploaded s3://$BUCKET/$key"
}

upload "$file" "db/$day/db-$stamp.dump"

# Host disk is 30 GB; compress local copies so 7 days of dumps stay tiny.
gzip -9 -f "$file"
file="$file.gz"

# Keep the newest LOCAL_DAYS dumps, delete older ones.
find "$DIR" -maxdepth 1 -type f -name 'db-*.dump.gz' -mtime "+$LOCAL_DAYS" -print -delete \
  | while read -r old; do log "pruned local $old"; done

dow="$(date -u +%u)"
if [ "$dow" = "7" ]; then
  week="$(date -u +%G-W%V)"
  upload "$file" "weekly/$week.dump.gz"
fi

if [ "$dow" = "7" ] || [ "${BACKUP_VERIFY:-0}" = "1" ]; then
  log "restore verification start"
  sudo -u "$DB_USER" dropdb --if-exists "$SCRATCH_DB"
  sudo -u "$DB_USER" createdb "$SCRATCH_DB" || die 5 "createdb $SCRATCH_DB failed"
  if ! gunzip -c "$file" | sudo -u "$DB_USER" pg_restore --no-owner --no-acl --exit-on-error -d "$SCRATCH_DB"; then    sudo -u "$DB_USER" dropdb --if-exists "$SCRATCH_DB"
    die 5 "restore into $SCRATCH_DB failed"
  fi
  # Test-only fault injection so the verification gate can prove the mismatch
  # branch really fires. Unset in production (no-op).
  if [ -n "${BACKUP_FAULT_AFTER_RESTORE:-}" ]; then
    log "BACKUP_FAULT_AFTER_RESTORE set; applying test mutation to $SCRATCH_DB"
    sudo -u "$DB_USER" psql -d "$SCRATCH_DB" -c "$BACKUP_FAULT_AFTER_RESTORE" >/dev/null
  fi
  mismatch=0
  for table in organizations users contacts conversations messages whatsapp_numbers; do
    live="$(sudo -u "$DB_USER" psql -d "$DB_NAME" -tAc "SELECT count(*) FROM $table")"
    restored="$(sudo -u "$DB_USER" psql -d "$SCRATCH_DB" -tAc "SELECT count(*) FROM $table")"
    if [ "$live" != "$restored" ]; then
      log "MISMATCH $table live=$live restored=$restored"
      mismatch=1
    fi
  done
  sudo -u "$DB_USER" dropdb --if-exists "$SCRATCH_DB"
  [ "$mismatch" = "0" ] || die 5 "restored row counts differ from live"
  log "restore verification ok"
fi

log "OK db=$DB_NAME bytes=$(stat -c %s "$file") s3=db/$day"
