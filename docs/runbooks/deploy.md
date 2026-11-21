# Deploy to the VPS

Status: **written, not yet run.** Docker is not available on the development machine, so the image build, `compose.yml` and `deploy.sh` are syntax-checked only. The first real run is task D1–D4 in `docs/SYSTEM_DESIGN.md`.

## One-time setup on the VPS

1. **Secrets file** `/etc/fundback/env` (owner root, mode 600), from `.env.example`, with the environment's real values. `APP_ENV=staging` or `production`. Production refuses to start without `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` and `CRON_SECRET`.
2. **Copy** `deploy/vps/compose.yml` and `deploy/vps/deploy.sh` to `/opt/fundback/`.
3. **Caddy:** add `deploy/vps/Caddyfile.fundback` (with the real domain) to the host Caddyfile and reload. The container listens only on `127.0.0.1:3100`.
4. **Cloudflare:** proxy the domain (orange cloud), SSL mode **Full (strict)**. On the VPS firewall, allow 443 only from Cloudflare's published IP ranges, so `CF-Connecting-IP` cannot be forged.
5. **Cache rules** in Cloudflare: cache `/_next/static/*` always; cache everything else only when there is no `sb-` auth cookie and no `fb_wl` cookie.
6. **Uptime monitors** (free UptimeRobot or similar) on `/` and `/api/status`, alerting the owner's Telegram.

## Each release

1. CI is green on `main` (typecheck, lint, unit and database tests, build, end-to-end on staging).
2. Migrations: `pnpm db:status` against the target, then `pnpm db:migrate`. Every migration is backward compatible with the running code (add columns and tables first; remove them a release later).
3. Build the image for the environment (public values are inlined at build time):
   ```sh
   docker build $(sed 's/^/--build-arg /' deploy/production.build.env) \
     --build-arg DEPLOYMENT_ID=$(git rev-parse --short HEAD) \
     -t ghcr.io/<owner>/fundback-web:$(git rev-parse --short HEAD) .
   docker push ghcr.io/<owner>/fundback-web:<sha>
   ```
4. On the VPS: `/opt/fundback/deploy.sh ghcr.io/<owner>/fundback-web:<sha>`. It waits for `/api/status`, smoke-tests six URLs, and starts the previous image again if anything fails.

## Rollback by hand

`/opt/fundback/deploy.sh "$(cat /var/lib/fundback/previous-image)"`

## Logs

`docker logs fundback-web` prints JSON lines with an `event` code and request id, never emails, IPs or tokens.
