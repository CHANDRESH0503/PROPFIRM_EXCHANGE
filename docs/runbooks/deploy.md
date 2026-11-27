# Deploy to the VPS

Status: **written, not yet run.** Docker is not available on the development machine, so the image build, `compose.yml` and `deploy.sh` are syntax-checked only. The first real run is task D1–D4 in `docs/SYSTEM_DESIGN.md`.

## One-time setup on the VPS

1. **Secrets file** `/etc/fundback/env` (owner root, mode 600), from `.env.example`, with the environment's real values. `APP_ENV=staging` or `production`. Production refuses to start without `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` and `CRON_SECRET`.
2. **Copy** `deploy/vps/compose.yml` and `deploy/vps/deploy.sh` to `/opt/fundback/`.
3. **Caddy:** add `deploy/vps/Caddyfile.fundback` (with the real domain) to the host Caddyfile and reload. The container listens only on `127.0.0.1:3100`.
4. **Cloudflare:** proxy the domain (orange cloud), SSL mode **Full (strict)**. On the VPS firewall, allow 443 only from Cloudflare's published IP ranges, so `CF-Connecting-IP` cannot be forged.
5. **Cache rules** in Cloudflare: cache `/_next/static/*` always; cache the public trust pages and the query-free homepage only for signed-out requests. Bypass caching for auth callbacks (including callback parameters at the root), waitlist links, API routes, signed-in pages, and the catalogue, deals and comparison routes, which depend on the request country. Honour origin Cache-Control and never cache Set-Cookie.
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

## Email delivery

Apply the outbox migration before starting the app. Configure Resend to send
`email.bounced` and `email.complained` events to `/api/webhooks/resend`. Store the
endpoint signing secret in `RESEND_WEBHOOK_SECRET`. Resend retries a rejected event.

Install the two `deploy/vps/fundback-outbox.*` files in `/etc/systemd/system/`.
Run `systemctl daemon-reload` and `systemctl enable --now fundback-outbox.timer`.
The service uses the container's cron secret and includes no credentials in the unit.
Check the first run in Admin → System health. A failed delivery is retried with
exponential backoff for up to 23 hours. A repeat signup replaces the queued link.
Drain the queue before rotating the IP hash salt, which also keys the confirmation
link derivation. Previously delivered links continue to work after rotation.

## Telegram bot

The bot works without a webhook: the Notifications page and the minute job pull updates with
`getUpdates`. Once the site is live on HTTPS, register the webhook so replies are instant:

```
pnpm telegram webhook     # sets https://<NEXT_PUBLIC_SITE_URL>/api/telegram with TELEGRAM_WEBHOOK_SECRET
pnpm telegram info        # check status and the last delivery error
pnpm telegram test-alert  # confirm owner alerts reach OWNER_TELEGRAM_CHAT_ID
```

Registering a webhook turns pull mode off automatically (checked every minute). For local
development, `pnpm telegram poll` forwards updates to the local server.

## FX prices

`FX_PRICE_PROVIDER=twelvedata` with `FX_PRICE_API_KEY`. One request for eight USD majors per hour
(8 credits); the other pairs are derived. The free plan allows 8 credits a minute, so a restart
storm or manual checks can briefly hit 429: calculators then ask for the price by hand and retry
after five minutes.
