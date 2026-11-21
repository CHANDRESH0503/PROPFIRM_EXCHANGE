#!/usr/bin/env bash
# Deploy one image to the VPS with automatic rollback (task D4).
#
#   deploy.sh ghcr.io/<owner>/fundback-web:<sha>
#
# Steps: pull → remember the running image → start the new one → wait for /api/status →
# smoke-test → on any failure start the previous image again. Migrations are applied by CI
# before this runs, and are always backward compatible (expand, then contract).
set -euo pipefail

NEW_IMAGE="${1:?usage: deploy.sh <image:tag>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE=(docker compose -f "$DIR/compose.yml" -p fundback)
ORIGIN="http://127.0.0.1:3100"
STATE=/var/lib/fundback
mkdir -p "$STATE"

log() { printf '%s deploy: %s\n' "$(date -u +%FT%TZ)" "$*"; }

wait_ready() {
  for _ in $(seq 1 60); do
    if curl -fsS -m 3 "$ORIGIN/api/status" | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}

smoke() {
  local path code
  for path in / /how-we-make-money /sign-in /api/health /waitlist/me; do
    code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$ORIGIN$path")
    if [[ "$code" != "200" ]]; then log "smoke failed: $path → $code"; return 1; fi
  done
  # Signed-out visitors must be redirected away from the app.
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$ORIGIN/today")
  [[ "$code" == "307" ]] || { log "smoke failed: /today → $code (expected 307)"; return 1; }
}

start() {
  FUNDBACK_IMAGE="$1" "${COMPOSE[@]}" up -d --remove-orphans web
}

PREVIOUS="$(cat "$STATE/current-image" 2>/dev/null || true)"
log "pulling $NEW_IMAGE"
docker pull "$NEW_IMAGE"

log "starting $NEW_IMAGE (previous: ${PREVIOUS:-none})"
start "$NEW_IMAGE"

if wait_ready && smoke; then
  echo "$NEW_IMAGE" > "$STATE/current-image"
  [[ -n "$PREVIOUS" ]] && echo "$PREVIOUS" > "$STATE/previous-image"
  log "live: $NEW_IMAGE"
  docker image prune -f --filter "until=168h" >/dev/null || true
  exit 0
fi

log "new image failed readiness or smoke tests"
if [[ -n "$PREVIOUS" ]]; then
  log "rolling back to $PREVIOUS"
  start "$PREVIOUS"
  wait_ready && smoke && log "rollback healthy" || log "ROLLBACK UNHEALTHY: page the owner"
fi
exit 1
