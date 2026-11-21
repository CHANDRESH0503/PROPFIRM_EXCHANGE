#!/usr/bin/env bash
# Nightly encrypted database backup (docs/SYSTEM_DESIGN.md task S2).
#
#   SUPABASE_DB_URL=... BACKUP_AGE_RECIPIENT=age1... BACKUP_REMOTE=b2:fundback-backups/prod deploy/backup/backup.sh
#
# 1. pg_dump (custom format) of the schemas we own plus auth and the migration history.
# 2. Encrypt with age to the owner's public key. The private key never touches CI or the VPS.
# 3. Upload with rclone to any S3-compatible store (Backblaze B2 by default), then prune:
#    keep 14 daily and 8 weekly (Sunday) copies.
# Without BACKUP_REMOTE it writes the encrypted file locally and stops (used by the drill).
set -euo pipefail

: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL}"
: "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT (age public key)}"
OUT_DIR="${BACKUP_OUT_DIR:-$(mktemp -d)}"
STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
KIND="daily"; [[ "$(date -u +%u)" == "7" ]] && KIND="weekly"
FILE="$OUT_DIR/fundback-$KIND-$STAMP.dump.age"

log() { printf '%s backup: %s\n' "$(date -u +%FT%TZ)" "$*"; }

log "dumping"
pg_dump "$SUPABASE_DB_URL" \
  --format=custom --compress=9 --no-owner --no-privileges \
  --schema=public --schema=private --schema=auth --schema=supabase_migrations \
  | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$FILE"

SIZE=$(wc -c < "$FILE" | tr -d ' ')
[[ "$SIZE" -gt 1024 ]] || { log "dump suspiciously small ($SIZE bytes)"; exit 1; }
log "encrypted dump: $FILE ($SIZE bytes)"

if [[ -z "${BACKUP_REMOTE:-}" ]]; then
  log "BACKUP_REMOTE not set: kept locally"
  exit 0
fi

rclone copyto "$FILE" "$BACKUP_REMOTE/$KIND/$(basename "$FILE")" --s3-no-check-bucket
log "uploaded to $BACKUP_REMOTE/$KIND/"
rclone delete "$BACKUP_REMOTE/daily" --min-age 14d
rclone delete "$BACKUP_REMOTE/weekly" --min-age 56d
log "pruned (daily 14d, weekly 8w)"
