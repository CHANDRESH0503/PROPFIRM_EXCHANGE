# Astrova — System design and production plan

**Status:** approved plan, 16 November 2026. Supersedes `SD_PROD.md`. `web/ARCHITECTURE.md` remains the description of what is built today; this document lists what is missing for production and the tasks to close each gap.

## Progress (17 November 2026)

Phase S: S1, S2, S3 and S5 done (backups run nightly on GitHub); Phase U done in code (17 Nov 2026), with visual checks on a phone still to do; S4's error tracking verified, uptime monitors wait on the domain; S6 documented. Built and verified locally with `npm run verify` (lint, tests, astronomy checks, production build). **Nothing is deployed.** Everything is in the private repository `CHANDRESH0503/AstrovaWeb`, with CI passing. The deploy scripts are syntax-checked only: no Docker or Caddy was available to run them.

| Task | State | What exists | What is left |
|---|---|---|---|
| S1 Version control | **Done** | One private repository, `CHANDRESH0503/AstrovaWeb`, at the `Astrova/` root (web, docs, design, marketing); old `web/.git` backed up to `~/astrova-web-git-backup-2026-11-17.tgz`; `.github/` at the root, CI runs in `web/` and passes on GitHub; `main` protected (Verify required, no force-push or deletion; the owner may still push directly) | — |
| S2 Backups | **Done** | `deploy/backup/backup.sh` (db, photos, prune; any S3-compatible store), `backup-role.sql` (read-only role with `pg_read_all_data`, since Supabase blocks grants on `auth`), `restore.sh`, `drill.sh`, `load-secrets.sh`; `.github/workflows/backup.yml` nightly at 02:00 IST; RUNBOOK "Backups" and "Restore". Storage is Backblaze B2 (R2 needs a card). **Verified 17 Nov 2026:** production → age → B2 → download → restore into local Postgres: all 45 tables identical (159 rows), policies, functions and triggers match. GitHub secrets loaded; the Backup workflow ran green (database and photo copies in B2, prune) and its file decrypts with the real key | Check the Actions tab weekly; a failed nightly run emails the owner |
| S3 Staging and tracked migrations | **Done** | Staging project built from the files by the CLI; production adopted (17 Nov 2026): a schema comparison showed `20261110_one_time_match` had never been applied, so it was made order-safe and pushed with `20261117_ops_usage`. Both projects: 14 migrations, drift 0, and `npm run db:compare` reports the schemas identical (679 facts). `scripts/db.sh` (list, push, adopt, compare), `migrations.test.ts` (re-run and out-of-order) | Laptop development still points at production's API keys; switch `.env.local` to staging's when convenient |
| S6 Secrets | **Documented** | RUNBOOK "Secrets": where each lives, rotation for every key, staging/prod separation; `.env.local`, `.env.db`, `.env.backup` mode 600 and git-ignored, with tracked `.example` templates | Owner: fresh production values on the VPS. Rotate: the Backblaze master application key (pasted into a tracked file, never committed), and any key pasted outside the password manager |
| B3 Rate-limit coverage | **Done** | Six new policies; every route limited or exempt with a reason; `rateLimitCoverage.test.ts`; photo processing behind a gate of 2 | — |
| S5 Account deletion and export | **Done** | `DELETE /api/account` (needs a fresh emailed code), `GET /api/account/export`, "Your data" on Profile, `/privacy` updated, `account.flow.test.ts` | Tamil copy review. Uses the auth-user cascade rather than a `delete_account` SQL function, since every personal table already cascades |
| B1 Search | **Partly** | Candidates read in pages of 1,000, so none are dropped | Incremental `id,updated_at` cache; `updated_at` trigger; timing of `rankCandidates()` |
| B2 Photos | **Partly** | Thumbnail at upload and on first view of older photos; `?size=thumb`; one-week immutable browser cache; cards use thumbnails | Disk cache on the VPS |
| S4 Errors and uptime | **Sentry verified; uptime waits on deploy** | `@sentry/nextjs` with `lib/sentryScrub.ts` (tested), `instrumentation*.ts`, server.mjs reporting; every `console.*` moved onto `log()` with request ids and no error messages; hourly `ops-check` (`/api/ops/check`, `ops_usage` migration) emailing `OPS_ALERT_EMAIL`; `/api/ops/test-error`; RUNBOOK "Error tracking", "Ops alerts". Sentry project `astrova-web` created (17 Nov 2026); a forced test error from a local server reached it and emailed the owner, with the fake name, date, coordinates, email and phone shown as `[redacted]`. DSN and `OPS_ALERT_EMAIL` set in `.env.local` (environment `development`) | At deploy: same DSN with environment `production` in `.env.production`; UptimeRobot monitors on `/` and `/api/status` once the domain is live; repeat the forced error on the server; the stop-the-container alert test |
| B7 CSP | **Partly** | Full policy sent as Report-Only | Two weeks of clean console, then enforce |
| B8 Housekeeping | **Partly** | Daily job: old sign-in codes, orphaned photo files, keeps the free project awake | Email outbox (with B4) |
| U1 Loading and failure states | **Done in code** | `components/Skeleton.tsx` (line, card, list, panel, block, chart) on every screen in place of "Loading…" lines; `loading.tsx` for /today, /profile, /kundli, /explain, /matching; `global-error.tsx` | Look at it on a throttled 4G phone (CLS under 0.1) |
| U4 Speed | **Done in code** | Fonts self-hosted, only Anek Tamil preloaded; Kundli result and print report, Explain's claim check and diagrams load as their own chunks when the form is first touched; home showcase lookups on the server; `sideEffects` in package.json. First load: /kundli 321 → 217 kB, /explain 217 → 187, home 246 → 216, /matching/find 222 → 195 | Per-route JS budget in CI (Q2) |
| U7 Installable | **Done in code** | Manifest and icons (placeholder sun mark); `public/sw.js`: pages network-first with an offline copy, hashed files cached, never /api or private pages; offline banner; Today opens offline by working out today's panchang on the phone from the kept natal positions (cleared at sign-out), saying when it was last online | Final icons; test install and airplane mode on an Android phone |
| D1 One Caddy | **Written, not run** | Compose starts only `web` on loopback; bundled Caddy moved behind `--profile proxy`; `deploy/vps/install-site.sh` | Run on the VPS |
| D2 CPU isolation | **Written, not run** | `cpus: 3` for web; `install-site.sh` caps Ollama at 200% and adds swap | Run; confirm with Q3 |
| D3 Cloudflare client IPs | **Written, not run** | `install-site.sh CLOUDFLARE=1` fetches Cloudflare's ranges and forwards one client address | Run; test from two networks; firewall; cache rules |
| D4 Deploy and rollback | **Written, not run** | `deploy/vps/deploy.sh` | Run; prove a broken build rolls back |
| D6 Runbook | **Partly** | `web/docs/RUNBOOK.md` | Restore, VPS rebuild, secret rotation, provider outages |
| U2 One data layer | **Done** | `apiTry()` over `api()` (timeout, retry on busy, session expiry, offline message in the page's language, uploads); every client call moved onto it, `dataLayer.test.ts` keeps it so; `useResource()` shares and remembers seekers, board, interests, reports, subscription and the charts list; optimistic send interest, block, save/rename/delete chart, board status, Today settings, rolled back with a message; one toast region | — |
| U3 Tamil first | **Done** | Step 1: language cookie and a head script, so Tamil readers never see the English render. Step 2: `/ta` twins of home, porutham (index, 27 stars, 729 pairs), Rahu kalam (index, cities), privacy, terms, refund, contact, rendered in Tamil on the server from one source per page; `hreflang` and per-language canonical; sitemap lists both (1,638 URLs); the language switch moves between twins | Tamil copy review by a native reader; Tamil town names |
| U5 Search state in the URL | **Done** | Filters and page on /matching/find (readable keys, cleaned by `parseFilters`; Back returns to the previous results), interests tab, board filter; scroll kept per address after Back and reload (`useScrollMemory`) | — |
| U6 Forms | **Done** | Kundli errors beside the field (aria-invalid, announced, focus moves there); other forms use the browser's own required-field checks; drafts for the Kundli form, matching pair, listing and biodata survive a refresh (session storage, cleared on success); input hints; double submission blocked | — |
| U8 Share cards | **Done** | `opengraph-image` for the home page (inherited by others), star pairs and Rahu kalam cities, in English and Tamil, no personal data. Tamil drawn from HarfBuzz-shaped outlines (`scripts/render-og-tamil.mjs`, `lib/ogText.ts`, test), since the card renderer cannot shape Tamil | Check how WhatsApp shows them once the domain is live |
| U9 Accessibility | **Done in code** | Visible focus ring; focus moves to the new page's heading after navigation; smooth scrolling honours reduce-motion; 44 px targets for the small controls found; dialogs use native `<dialog>` | `axe` runs (Q1); check 200% zoom and Tamil at 320 px on a phone |
| U10 Session and payment edges | **Done** | A session that ends mid-task opens sign-in at once and returns to the page, where drafts fill back in; the pay button stays off while a payment is confirming (no double charge); a dropped verify keeps checking instead of failing; Daily keeps checking for five minutes | — |
| D5, B4, B5, B6, Q1–Q4 | Not started | | Need accounts, the VPS, or larger refactors |

## 1. Targets and constraints

| | Decision |
|---|---|
| Scale | Up to 10,000 monthly users; about 1,500 on a busy morning (06:00–09:00 IST peak) |
| Budget | Free tiers until revenue. Only unavoidable cost: a domain |
| Hosting | The existing VPS (4 vCPU / 10 GB), shared with the Ollama model |
| Topology | One Node process (`web/server.mjs`), Supabase for data, Cloudflare free tier in front |

Service targets (measured, not assumed, by task Q3):

| Metric | Target |
|---|---|
| Availability | 99.5% a month (one server; about 3.5 hours of allowed downtime) |
| Chart API p95 | under 1.5 s while the LLM is busy |
| Other API p95 | under 400 ms |
| LCP, 75th percentile | under 2.5 s on a mid-range Android phone over 4G |
| Recovery | Restore from backup within 4 hours; lose at most 24 hours of data |

Estimated load at 10k MAU (assumptions, to be replaced by Q3 measurements): about 5 requests a second at peak, about 5,000 chart calculations a day, under 2,000 matrimony listings. The existing engine gate (2 concurrent, about 150 ms each) covers this with room to spare. **Capacity is not the risk at this scale. Data loss, the single server, email limits and Supabase free-plan limits are.**

## 2. Architecture (target)

```
Phone ──HTTPS──▶ Cloudflare (free: DNS, TLS, cache for static + public pages, DDoS)
                    │  only Cloudflare IPs allowed on 443
                    ▼
        VPS ── host Caddy (already installed for the LLM; one more site block)
                 ├─ astrova domain ──▶ 127.0.0.1:3000  web container (server.mjs, 3 CPUs)
                 │                        ├─ chart engine child processes (gate: 2)
                 │                        ├─ in-process caches, rate limits, cron
                 │                        ├─ ▶ Supabase (Postgres + RLS, Auth, Storage)
                 │                        └─ ▶ email provider, Razorpay
                 └─ sslip.io LLM host ──▶ 127.0.0.1:11434  Ollama (capped at 2 CPUs)

GitHub Actions: CI on every push · nightly encrypted backup ▶ Backblaze B2 (any S3-compatible store)
Outside monitors: uptime check · error tracker
```

Kept as built: the single long-lived process, in-memory caches and limits, in-process cron, Postgres as the home of every durable rule. Not added at this scale: Redis, a job queue service, a second app server, read replicas. Section 10 says when each is worth paying for.

## 3. Findings (verified in the code)

| # | Finding | Evidence | Task |
|---|---|---|---|
| 1 | **Almost nothing is in version control.** One commit ("Initial commit from Create Next App"), no remote; all source, migrations and docs are uncommitted or untracked. A disk failure loses the product. | `git log`, `git status` in `web/` | S1 |
| 2 | **No backups.** Supabase free plan has none. | `OPTIMISE.md` §4, not started | S2 |
| 3 | **No account deletion or data export.** Required by the DPDP Act and promised in the privacy page. | no route or UI found | S5 |
| 4 | **Cloudflare would break IP rate limits.** `server.mjs` trusts only private-network hops, so every user would appear as a Cloudflare address and share one OTP limit (10 an hour per IP). | `clientAddress()` in `web/server.mjs` | D3 |
| 5 | **Port clash on the VPS.** The LLM setup installed a host Caddy on 80/443; `docker-compose.yml` starts a second Caddy on the same ports. | `web/deploy/llm/setup.sh`, `web/docker-compose.yml` | D1 |
| 6 | **The model and the chart engine share 4 cores.** Ollama runs 2 parallel requests and can use all cores. | `setup.sh` (`OLLAMA_NUM_PARALLEL=2`) | D2 |
| 7 | **Sign-in depends on Gmail's ~500 emails a day**, shared with interest alerts and renewal reminders. A festival-day spike locks people out. | `web/src/lib/mailer.ts` | B4 |
| 8 | **Search silently drops listings past 1,000.** The query asks for 5,000 rows; the hosted API returns at most about 1,000. | `candidatePool()` in `web/src/lib/server/matrimony.ts`; `MATRIMONY.md` "Scale" | B1 |
| 9 | **Photos are downloaded in full from Storage on every view**, with a 10-minute browser cache. About 1,700 page views a month exhaust free egress. | `web/src/app/api/matrimony/photos/[id]/route.ts` | B2 |
| 10 | **Most write routes have no rate limit**, including photo upload (CPU-heavy `sharp`), baby names, payments, listing saves and reports. 7 of 47 routes are limited. | route audit | B3 |
| 11 | **No error tracking, alerts or uptime monitor.** Errors go to `console.error`; nobody is told. | no tracker in `package.json` | S4 |
| 12 | **Migrations are pasted into the Supabase dashboard by hand**, with no record of which ran. One (`20261116000000_matrimony_alerts.sql`) is known to be pending. No staging project. | `SD_PROD.md` §3.3, memory notes | S3 |
| 13 | **Every main screen is a client page that fetches after load** and shows a line of text meanwhile. No skeletons, no `loading.tsx`, no `global-error.tsx`. | 19 `"use client"` pages; 0 skeleton components | U1 |
| 14 | **Two ways of calling the API.** 23 files use raw `fetch`; 5 use `lib/api.ts`, which has the timeout, retry and session-expiry handling. | grep | U2 |
| 15 | **Tamil users see English first.** The server always renders English with `<html lang="en">`; Tamil is applied from `localStorage` after load. No Tamil URLs, so Google indexes English only. | `web/src/lib/i18n.tsx`, `web/src/app/layout.tsx` | U3 |
| 16 | **Five font families load on every page**; four are used only by printed reports. | `web/src/app/layout.tsx` | U4 |
| 17 | **Search state is not in the URL.** Back, refresh and sharing lose filters and page. | `web/src/app/matching/find/page.tsx` | U5 |
| 18 | **Not installable; nothing works offline.** No manifest, icons or service worker, for an audience that opens it every morning on a phone. | `web/public/` holds only `media/` | U7 |
| 19 | **No browser tests and no load test.** 65 unit and flow test files, none drive a browser. | `web/package.json` | Q1, Q3 |
| 20 | **Moderation is done by editing SQL.** A reported listing is restored by changing a row by hand. | `MATRIMONY.md` "Rules" | B6 |
| 21 | **CSP has no script policy.** Only `frame-ancestors`, `base-uri`, `object-src`. | `web/next.config.ts` | B7 |
| 22 | **Each request may call Supabase Auth twice** (middleware and route) unless the project uses asymmetric signing keys. Not verified from here. | `ARCHITECTURE.md` "Data access" | B5 |

Owner items that block public launch and that code cannot fix: Swiss Ephemeris licence, the domain, business details for legal pages, Razorpay approval.

## 4. Rules for whoever implements a task

1. One task per session. Finish with `npm run verify` in `web/` and report failures with their output.
2. Never log birth details, coordinates, names, emails, phone numbers or request bodies. Log ids and fixed reason codes.
3. Durable rules (caps, quotas, once-only actions) go in Postgres functions or constraints. Memory is only an optimisation.
4. Every user-facing string ships in English and Tamil through `localized()` or `STRINGS` in `web/src/lib/i18n.tsx`.
5. No fear wording, no verdicts, nothing to buy (`PRODUCT.md` "Brand Commitments").
6. New migrations: one timestamped file in `web/supabase/migrations/`, idempotent, with a test against `web/src/testing/pgSupabase.ts`.
7. No new npm dependency unless the task names it.
8. Reuse before writing: `TtlCache` (`lib/server/cache.ts`), `Gate` and `RateLimiter` (`lib/server/limiter.ts`), `rateLimited()` (`lib/server/rateLimits.ts`), `json`/`readJson`/`sameOrigin`/`bearerAuthorised` (`lib/supabase/http.ts`), `api()`/`fetchChart()` (`lib/api.ts`).

## 5. Phase S: safety net (before any real user)

**S1. Version control.** Create one private repository at the `Astrova/` root holding `web/`, the docs and `marketing/`. Replace the one-commit repo in `web/.git` (confirm with the owner before deleting it). Move `web/.github/` to the root and set `working-directory: web` in `verify.yml`. Check `.env*` stays ignored. Push to a private GitHub remote; protect `main`; require CI.
Done when: a fresh clone passes `npm ci && npm run verify`.

**S2. Backups** (`OPTIMISE.md` §4). Nightly GitHub Action: `pg_dump` of `public` and `auth` through the session pooler with a read-only role, encrypted with `age`, uploaded to Cloudflare R2. Keep 14 daily and 8 weekly. Weekly copy of the `matrimony-photos` bucket.
Done when: one restore into a local Postgres is completed and its steps are written in `web/docs/RUNBOOK.md`.

**S3. Staging and tracked migrations.** Create a second free Supabase project for staging. Adopt the Supabase CLI: `supabase link`, `supabase migration repair` to mark the 12 applied files, then `supabase db push` for the pending alerts migration. Add `npm run db:push:staging` and `db:push:prod`. Dashboard SQL edits stop.
Done when: `supabase migration list` shows no drift on both projects.

**S4. Error tracking and uptime.**
- Add `@sentry/nextjs` (free plan) with a `beforeSend` that drops request bodies, query strings, cookies and breadcrumbs carrying form data. Wire it into `web/src/app/error.tsx`, a new `global-error.tsx`, and `unhandledRejection`/request errors in `server.mjs`. Off unless `SENTRY_DSN` is set, like the other optional keys.
- New `web/src/lib/server/log.ts`: one JSON `log(level, code, fields)` that carries `x-request-id`; replace the 9 files using `console.*`.
- Record per-route latency (p50, p95, count, 5xx count) in memory and expose it on `GET /api/health`.
- Free uptime monitor on the public home page and on a new public `GET /api/status` that returns only `{ok}` after one cheap Supabase read.
- Daily cron `ops-check`: emails the owner when gate rejections, 5xx rate, emails sent today or Supabase usage cross thresholds.
  Done when: a forced test error appears in Sentry with no personal data, and stopping the container triggers an alert within 5 minutes.

**S5. Account deletion and export.** `DELETE /api/account` after a fresh OTP check: a Postgres function `delete_account(p_user)` removes saved charts, seekers, listings, interests, blocks, biodata pages, reports and the profile in one transaction; the route then deletes Storage photos and the auth user. Purchases and refunds stay, detached from the person, for tax records. `GET /api/account/export` returns the user's own rows as JSON. Add both to the Profile settings tab and update `/privacy`.
Done when: a flow test creates a full account (listing, photos, interest, purchase), deletes it, and finds no personal row or file left.

**S6. Secrets.** `.env.production` exists only on the VPS (mode 600) and in a password manager. Separate values for staging. Rotate any key that has left the laptop. Write the rotation steps in the runbook.

## 6. Phase D: production deployment on the shared VPS

**D1. One Caddy, web on loopback.** Remove the `caddy` service from `docker-compose.yml`; publish web as `127.0.0.1:3000:3000`. Extend `deploy/llm/setup.sh`'s host Caddyfile with the site block from `deploy/Caddyfile` (keep HSTS, body cap, probe blocking, log filter). Keep `LLM_URL` on the existing HTTPS host.

**D2. CPU and memory isolation.** `CPUQuota=200%` on `ollama.service`; `cpus: 3` and the existing 2 GB limit on the web container; `ENGINE_CONCURRENCY=2`; 2 GB swap. Images are built in CI or with `nice` so a build never starves live requests.
Done when: Q3's load test meets the chart p95 target while the LLM answers two requests.

**D3. Cloudflare and real client IPs.** Proxy the domain through Cloudflare (Full strict TLS). In Caddy: `trusted_proxies` set to Cloudflare's published ranges, and `header_up X-Forwarded-For {client_ip}` so `server.mjs` receives exactly one, real, address. Firewall 443 to Cloudflare ranges. Cache rules: `/_next/static/*` and `/media/*` always; `/porutham/*`, `/rahu-kalam/*` and `/` only when no session cookie is present.
Done when: a test from two networks shows two different addresses in the rate limiter, and a forged `X-Forwarded-For` is ignored.

**D4. Deploy and rollback.** `web/deploy/deploy.sh`: pull a commit, build `astrova-web:<sha>`, run migrations (S3), `docker compose up -d`, wait for `/readyz`, smoke-test five URLs, and on failure re-tag the previous image and restart. Caddy's 10-second retry covers the restart gap.
Done when: a deliberately broken build rolls back by itself.

**D5. Server hardening.** SSH keys only, `ufw`, `unattended-upgrades`, `fail2ban`. CI adds `npm audit --omit=dev` and Dependabot.

**D6. Runbook** (`web/docs/RUNBOOK.md`): deploy, rollback, restore, rebuild the VPS from nothing, rotate each secret, Supabase outage, Razorpay outage, email outage.

## 7. Phase B: backend hardening inside free limits

**B1. Search correctness and egress** (`OPTIMISE.md` §2). In `candidatePool()`: page the query with `.range()` in batches of 1,000 so nothing is dropped. Then the incremental cache: fetch `id,updated_at` only, and full rows only for new or changed listings (`lib/server/listingCache.ts`, capped). Add an `updated_at` trigger. Time `rankCandidates()`; if p95 passes 50 ms, move ranking to a `worker_threads` pool.
Done when: a test with 2,500 listings returns the same ranking with and without the cache, and the second search fetches under 5% of the bytes.

**B2. Photos** (`OPTIMISE.md` §3). 320 × 400 thumbnail at upload; `?size=thumb|full`; `Cache-Control: private, max-age=604800, immutable`; a disk cache on the VPS with the access check before every read; a backfill script. Cards use thumbnails with fixed `width`/`height`.

**B3. Rate-limit coverage.** Add policies `write` (all signed-in mutations), `upload`, `pay` and `report` to `lib/server/rateLimits.ts` and apply them to the 40 unlimited routes. Put `processPhoto()` behind a `Gate` of 2.
Done when: a table-driven test asserts every route file under `src/app/api` either calls `rateLimited()` or is on an explicit allowlist (webhook, cron, health).

**B4. Email that survives growth.** Split `lib/mailer.ts` into a transport interface with Gmail and one provider on the real domain (Amazon SES is about ₹10 per 1,000; Brevo has a free daily allowance; check current terms when the domain exists), chosen by env, with SPF, DKIM and DMARC. Sign-in codes send first and fall back to the second transport. Alerts and reminders go through an `email_outbox` table drained by cron with retries. Count sends per day. Make "Continue with Google" the first button on `/login`.

**B5. Local JWT verification.** Turn on asymmetric signing keys in Supabase and confirm `auth.getClaims()` makes no network call per request (measure middleware time before and after).

**B6. Moderation and support page.** `/admin`, limited to an allowlist of owner emails checked on the server: reported listings (restore or remove), recent refunds, emails sent today, the `/api/health` numbers. Every action is written to an `admin_actions` table.

**B7. Content Security Policy.** Add `script-src`, `connect-src`, `img-src`, `frame-src` for self, Razorpay, PostHog and Supabase. Ship as `Content-Security-Policy-Report-Only` for two weeks, then enforce.

**B8. Housekeeping cron** in `server.mjs`: drain the email outbox, delete expired OTP rows, remove Storage files with no row, and a daily Supabase read so the free project never pauses.

## 8. Phase U: user experience to production standard

**U1. Loading and failure states.** A small skeleton set (`components/Skeleton.tsx`: line, card, chart, list) sized like the real content, so nothing jumps. `loading.tsx` for `/today`, `/profile`, `/kundli` and `/matching/*`. `global-error.tsx`. Replace the "Opening…" text lines.
Done when: on a throttled 4G profile no screen shows a blank area or shifts layout (CLS under 0.1).

**U2. One data layer.** Move the 23 raw-`fetch` files onto `api()`. Add `useResource(url)` on top of it: cached last value shown at once, refresh in the background, shared between components. Mutations get a pending state that disables the button, an optimistic update where the result is predictable (send interest, save chart, block), and rollback with a message on failure. Add one toast region (`role="status"`).

**U3. Tamil first, without the English flash.**
- Step 1: store the language in a cookie as well as `localStorage`; an inline script in `<head>` sets `<html lang>` before paint; client pages show skeletons until the language is known.
- Step 2: static Tamil versions of the public pages under `/ta` (home, `/porutham/**`, `/rahu-kalam/**`, legal pages) with `hreflang` links and sitemap entries, so Tamil searches land on Tamil pages. The language switch moves between the two URLs.

**U4. Speed on a cheap phone.** `preload: false` on the four print-only fonts. Lazy-load print templates, chart chat, remedy tools and the home video with `next/dynamic`. Set a per-route JavaScript budget in CI (Q2).

**U5. Search state in the URL.** Filters, page and selected seeker live in the query string on `/matching/find`, `/matching/interests` and `/matching/board`. Back and refresh restore them; scroll position is kept.

**U6. Forms.** Errors appear beside the field and are announced; focus moves to the first error; correct `inputmode` and `autocomplete`; an unfinished birth form or listing survives a refresh (extend `lib/pending.ts`); double submission is impossible.

**U7. Installable, and useful offline.** Web manifest, icons, theme colour. A service worker that caches the app shell and the last "Today" reading, so the morning check opens without a network and says when it was last updated. An offline banner. Web push stays a later step.

**U8. Share cards.** `opengraph-image.tsx` for porutham pair pages, Rahu kalam city pages and the home page, in Tamil and English, with no birth details. WhatsApp previews are the main growth loop (`MARKETING_PLAN.md`).

**U9. Accessibility.** Adopt WCAG 2.2 AA. Visible focus on every control, focus moved on route change and into dialogs, 44 px targets, text readable at 200% zoom, reduced-motion respected, Tamil text checked for wrapping at 320 px. Automated `axe` checks run in Q1.

**U10. Session and payment edges.** Session expiry mid-task keeps the user's input and resumes after sign-in (extends the existing `AUTH_EXPIRED` flow). Payment screens cover closed tab, slow confirmation and duplicate payment with a plain status, using the existing `/api/pay/order/verify` and reconcile paths.

## 9. Phase Q: quality gates

**Q1. Browser tests.** Playwright (dev dependency) for six journeys in both languages on a phone viewport: make a Kundli; sign in with a code; save a chart and open Today; list a profile and upload a photo; search, send and accept an interest; delete the account. `axe` runs on each screen.

**Q2. Performance budget in CI.** Lighthouse CI on home, `/kundli`, a porutham page and a city page. Fail on LCP over 2.5 s, CLS over 0.1, or a route's JavaScript growing more than 10%.

**Q3. Load test.** A `k6` script against staging on the VPS: 1,500 virtual morning users (Today, chart, search, photos) for 15 minutes with the LLM under load. Record p95 per route, engine queue depth, memory and Supabase egress. Replace the estimates in section 1 with the results.

**Q4. Release checklist** in the runbook: verify green, migrations listed, backup under 24 hours old, smoke test passed, rollback image present.

## 10. When to spend, after revenue

| Order | Buy | When (first trigger) |
|---|---|---|
| 0 | Domain | Before launch. Cloudflare, email and Razorpay all need it |
| 1 | Supabase Pro ($25/month) | Public matrimony launch, or egress over 3 GB, storage over 700 MB, database over 350 MB (`OPTIMISE.md` §7) |
| 2 | Email provider on the domain | More than 300 emails on any day |
| 3 | Second VPS for the web app | Chart p95 over 1.5 s or CPU over 70% for an hour, two days running |
| 4 | Redis and a second web container | Past about 50k MAU, or when deploys must have no gap. `TtlCache` and `RateLimiter` keep their interfaces; cron moves to one instance |
| 5 | SMS or WhatsApp codes and alerts | When phone verification becomes a trust requirement for matrimony |
| 6 | Separate engine workers, read replica | Chart volume far above page traffic, or search queries slow the database |

## 11. Order of work

| Step | Tasks | Why this order |
|---|---|---|
| 1 | S1, S2, S6 | Nothing else matters if the code or data can be lost |
| 2 | S3, S4 | Safe changes and visibility before going live |
| 3 | D1–D6 | A real, monitored deployment |
| 4 | B1, B2, B3, S5 | Correctness, free-plan limits, legal duty |
| 5 | U1, U2, U4 | The largest visible quality jump |
| 6 | Q1, Q3 | Lock in behaviour; measure before tuning further |
| 7 | B4–B8, U3, U5–U10, Q2, Q4 | By need |

Related documents: `web/ARCHITECTURE.md` (how it is built today), `OPTIMISE.md` (detail for S2, B1, B2), `PAYMENTS_PLAN.md`, `MATRIMONY.md`, `PRODUCT.md`.
