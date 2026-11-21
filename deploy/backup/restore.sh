#!/usr/bin/env bash
# Restore an encrypted backup into a target Postgres (never production by accident).
#
#   BACKUP_AGE_IDENTITY=~/keys/fundback-backup.agekey TARGET_DB_URL=postgres://... \
#     deploy/backup/restore.sh fundback-daily-2026-11-21T0200Z.dump.age
#
# The target must already have the Supabase roles (a Supabase project, or a local Postgres
# prepared with supabase/tests/support/auth-shim.sql minus its `auth` schema).
set -euo pipefail

FILE="${1:?usage: restore.sh <backup.dump.age>}"
: "${BACKUP_AGE_IDENTITY:?set BACKUP_AGE_IDENTITY (path to the age private key)}"
: "${TARGET_DB_URL:?set TARGET_DB_URL}"
if [[ "$TARGET_DB_URL" == *"${PRODUCTION_DB_HOST:-__none__}"* ]] && [[ "${YES_PRODUCTION:-}" != "1" ]]; then
  echo "restore: target looks like production; set YES_PRODUCTION=1 to continue" >&2
  exit 1
fi

age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$FILE" \
  | pg_restore --dbname "$TARGET_DB_URL" --no-owner --no-privileges --clean --if-exists --exit-on-error
echo "restore: done"
