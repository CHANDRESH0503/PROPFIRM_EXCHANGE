# Fundback — System design and production plan

**Status:** draft for owner approval, 21 November 2026. Phase 0 built and verified locally against staging; nothing deployed. `CLAUDE.md` §2 (rules) overrides anything here. Product detail lives in `docs/spec/`; this document covers how the system is built, run, secured and recovered, and the tasks that take it to production.

## Progress

| Task | State | What exists | What is left |
|---|---|---|---|
| S1 Version control | Owner | `.gitignore`, CI workflow ready | Owner initialises and pushes the repository; protect `main`, require CI |
| S2 Backups | Not started | Supabase's own | Nightly encrypted dump to B2, restore drill |
| S3 Environments and migrations | **Staging done** | Staging `fabiunrsxibmyjkfhfsd`: 2 migrations, drift 0; `pnpm db:status/migrate/types`; types generated | Production project; CI migration job |
| S4 Errors and uptime | Partly | Redacting JSON logger with request ids; `/api/health`, `/api/status` | Sentry with scrubbing; uptime monitors after deploy |
| S5 Data rights | Not started | Profiles cascade on user delete | Export and deletion flows (Phase 1.8d) |
| S6 Secrets | Documented | `docs/runbooks/secrets.md`; `.env.local` mode 600 | Production values on the VPS |
| D1–D4 Deploy | **Written, not run** | Dockerfile, `deploy/vps/compose.yml`, Caddy block, `deploy.sh` with rollback, `docs/runbooks/deploy.md` | Run on the VPS once the domain exists |
| B1 Rate-limit coverage | **Done** | Postgres limiter; `src/test/mutation-coverage.test.ts` fails on any unlimited action or route | — |
| B4 CSP | Partly | Full policy report-only; framing/plugins/base-uri enforced | Enforce after two clean weeks |
| U1 Loading/error states | **Done in code** | Skeletons in every Suspense boundary, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `forbidden.tsx` | Throttled 4G check |
| U2 Forms | **Done in code** | Errors beside fields and announced, focus to error, `inputmode`/`autocomplete`, pending blocks double submit, works without JS | — |
| Q0 CI | Done in code | Typecheck, lint, unit + DB tests, build, audit; e2e on staging | Runs once pushed |
| Q1 Browser tests | **Partly** | 14 Playwright journeys (phone + desktop) with axe, against staging | Economy flow arrives with Phase 1 |

Update this table as tasks land. `docs/PROGRESS.md` tracks product phases; this table tracks production readiness.

## 1. Targets and constraints

| | Decision |
|---|---|
| Scale (year one) | Up to 50,000 monthly users, about 10,000 daily. Spiky: a creator post or a big deal can send 5,000 visitors in 10 minutes |
| Budget | Free tiers until revenue. Unavoidable costs: a domain, Supabase Pro at launch (backups and no pausing) |
| Hosting | The owner's existing VPS, behind Cloudflare, shared with other services. Fundback runs in its own container with its own CPU and memory cap |
| Topology | One Next.js Node process (standalone build) in Docker; Supabase for Postgres, Auth and Storage; Cloudflare in front |

Service targets (measured, not assumed, by Q3):

| Metric | Target |
|---|---|
| Availability | 99.5% a month (one origin server; about 3.5 hours of allowed downtime). Cached public pages stay up when the origin is down |
| Public page TTFB at the edge | under 200 ms (Cloudflare cache hit) |
| Signed-in API and Server Action p95 | under 400 ms |
| Economy functions (claim, credit, redeem) p95 | under 150 ms in Postgres |
| LCP, 75th percentile | under 2.5 s on a mid-range Android over 4G |
| Recovery | Restore within 4 hours; lose at most 24 hours of data before point-in-time recovery, 2 minutes after it (Supabase Pro + PITR) |
| Money correctness | Zero double credits. Every Coin traces to a confirmed commission or a capped campaign. Reconciled daily (job `ledger_reconcile`) |

**Load estimate at 50k MAU** (assumptions, to be replaced by Q3): public traffic is mostly cached at the edge. Origin sees signed-in traffic: 10,000 daily users × about 25 requests = 250,000 requests a day, about 10 a second at the peak around the London and New York opens. One Node process on 2 vCPU handles this. **Capacity is not the risk at this scale. The risks are money correctness, fraud, data loss, email limits and the single origin.**

## 2. Architecture

```
Phone ─HTTPS─▶ Cloudflare  (DNS, TLS, WAF + rate rules, cache for public pages & /_next/static, Turnstile)
                  │  firewall: origin 443 accepts Cloudflare ranges only
                  ▼
     VPS ── host Caddy (shared) ── fundback domain ─▶ 127.0.0.1:3100  fundback-web container
                                                         │  Next.js standalone, 2 CPUs, 1.5 GB
                                                         │  Server Components, Server Actions, Route Handlers
                                                         │
             ┌───────────────────────────────────────────┼───────────────────────────────┐
             ▼                                           ▼                               ▼
     Supabase (per environment)                    Resend (email)              Telegram Bot API
       Postgres 17 + RLS  ◀─ economy functions      PostHog (consented)        Sentry (scrubbed)
       Auth (magic link, Google, MFA for staff)
       Storage (receipts, proofs, journal: private; public-assets: public)
       pg_cron (SQL-only jobs)

     host systemd timer ─▶ POST /api/cron/<job> (bearer CRON_SECRET)  for jobs that send email/Telegram
     GitHub Actions: CI · image build to GHCR · migrations to staging/production · nightly encrypted backup ▶ B2
     Outside monitors: uptime checks on /, /api/status ▶ owner Telegram
```

Kept simple on purpose: one app process, Postgres as the home of every durable rule, an outbox table instead of a queue service. Not added at this scale: Redis, a job queue service, a second origin, read replicas. §8 says when each becomes worth paying for.

### Why these choices

- **Postgres functions own money.** Coins, XP, claims and redemptions change only inside `SECURITY DEFINER` functions executable by `service_role`, one transaction each, with idempotency keys. The app cannot express a double credit even if a request is retried or a Server Action is replayed.
- **RLS is the second wall, not the first.** The browser holds the anon key and a user JWT. RLS default-denies every table; users read their own rows; nobody but those functions writes economy tables.
- **Edge cache for everything public.** Firms, deals, tools and calendar pages are static or revalidated by tag when admin edits them, so a traffic spike hits Cloudflare, not the VPS.
- **pg_cron for SQL-only jobs** (release pending Coins, expire Coins, rotate missions, reconcile) runs inside the database, so it works even when the app is down. Jobs that send messages run in the app, called by a host timer, and drain an outbox.

## 3. Trust boundaries and request paths

| Layer | Can do | Cannot do |
|---|---|---|
| Browser (anon key + user JWT) | Read public catalogue; read own profile, wallet view, notifications; update own profile fields allowed by policy | Write any balance, XP, claim status, redemption status, role, flag or geo rule |
| Server (Server Actions, Route Handlers) | Validate with Zod, check Turnstile and rate limits, check roles, call economy functions with the service role, sign Storage URLs | Bypass function checks (the functions re-check every invariant) |
| Postgres functions | Append ledger rows, move claim states, enforce the give-back cap and monthly earn cap, write `audit_log` | UPDATE or DELETE ledger or audit rows (blocked by trigger and revoked privileges) |

Rules that follow from this:

1. `SUPABASE_SERVICE_ROLE_KEY` is read only in modules that import `server-only` (`src/lib/supabase/admin.ts`). A build fails if a client bundle imports it.
2. The user id passed to an economy function comes from verified JWT claims on the server, never from a form field.
3. Admin routes check the role on the server for every request (`requireAdmin(role)`), and staff sessions must be at MFA level `aal2`.
4. Every admin write records who, when, before and after in `audit_log`, which is append-only.

**Client IP.** The origin accepts traffic only from Cloudflare, so `CF-Connecting-IP` is trustworthy; Caddy passes exactly that one header and drops any client `X-Forwarded-For`. The app reads it in one place (`src/lib/http/client-ip.ts`) and stores only `hash(ip || salt)`, where the salt rotates monthly.

**Rate limits.** Durable limits (sign-up, waitlist, claims, redemptions) use a Postgres function `rate_limit_hit(key, window, max)` so they hold across restarts and containers. Cloudflare rate rules on `/api/*` and auth endpoints are the coarse outer layer. Every mutating route is either limited or on an explicit, tested allowlist (webhooks, cron, health).

## 4. Money integrity (the economy)

Full rules: `docs/spec/05-economy.md`. How they are made unbreakable:

- **Append-only ledger.** `ledger_entries` has signed `amount` (integer Coins), `bucket` (`pending` or `available`), `type`, `ref_type`/`ref_id`, `idempotency_key unique`, `config_version`, `created_by`. A trigger raises on UPDATE and DELETE, and those privileges are revoked from every role. A state move (pending → available) is two rows in one transaction.
- **Balances are a view** (`wallet_balances`) over the ledger. Nothing stores a balance that could drift.
- **Idempotency.** Every write carries a deterministic key, such as `claim:{id}:credit` or `redeem:{request_id}`. A retry returns the original result instead of writing twice.
- **Concurrency.** Redemption takes `pg_advisory_xact_lock` on the user before reading the balance, so two taps cannot spend the same Coins.
- **Give-back cap in the function.** User share + booster + referral + creator ≤ `max_total_giveback_bps` of the confirmed commission, computed in integer basis points with `floor`, in that order, inside the crediting function.
- **Backed Coins only.** Crediting requires a confirmed `commissions` row or a `campaign_budgets` row whose remaining budget covers the grant (checked under a row lock).
- **Versioned config.** `economy_config` rows are immutable versions; each ledger row records the version used.
- **Daily reconciliation.** A job checks that the sum of ledger Coins per source equals confirmed commission × the applied share, and that the coin liability ratio is under 1.0. Any mismatch alerts the owner on Telegram.

## 5. Data and storage

The data model is in `docs/spec/10-data-model.md`; privacy and retention are in `18-data-and-operations.md`.

- Money is integer minor units with a currency code; rates are basis points; Coins and XP are integers. No floats in economy code.
- Every table has RLS enabled. A database test fails if any table in `public` has RLS off or has no policy and is not explicitly listed as service-only.
- Indexes on every foreign key and on the hot paths named in `18-data-and-operations.md` §3. Cursor pagination on large lists.
- Storage: private buckets are read through signed URLs with 10-minute expiry. Receipts are hashed (SHA-256) at upload to catch reuse. Journal screenshots are compressed in the browser before upload.
- Deleting a user cascades personal tables; ledger, claims and redemptions are kept with personal fields removed, for accounting.

## 6. Background work

| Job | Where | Schedule | Notes |
|---|---|---|---|
| `release_pending_coins` | pg_cron | every 15 min | Confirmed and past the hold period → available |
| `expire_coins` + warnings | pg_cron + app | daily | Warnings at 30 and 7 days go through the outbox |
| `rotate_daily_missions` | pg_cron | daily 00:00 UTC; per-user day uses their timezone | |
| `ledger_reconcile` | pg_cron | daily | Alerts on mismatch |
| `drain_outbox` | app (timer) | every minute | Email and Telegram with retries, backoff and per-day counters |
| `streak_at_risk` | app (timer) | hourly, per timezone | Respects quiet hours and preferences |
| `housekeeping` | app (timer) | daily | Expired rate-limit rows, orphaned Storage files, receipts past retention |
| `backup` | GitHub Actions | nightly 02:00 UTC | `pg_dump` with a read-only role, `age`-encrypted, to Backblaze B2 |

Every job records a `job_runs` row (name, started, finished, status, error code) and is shown in admin under System health. A job that has not succeeded within twice its interval alerts the owner.

## 7. Operations

**Environments.** Three Supabase projects: local for tests (a throwaway Postgres 17 with Supabase's `auth` shim, built by `pnpm test:db`), **staging** and **production**. Migrations move local → staging (CI, on merge to `main`) → production (CI, on a release tag, with manual approval). Seed data only on local and staging. Never test on production.

**Migrations.** One timestamped file per change, never edited after it has been applied. Expand-then-contract, so the running app version always works with the next schema. DB types regenerate after each migration (`pnpm db:types`).

**Deploy (D1–D4).** CI builds `ghcr.io/<owner>/fundback-web:<sha>`. `deploy/vps/deploy.sh` on the VPS pulls the image, applies migrations, starts the new container, waits for `/api/status`, smoke-tests five URLs, and on failure starts the previous image again. Caddy retries during the restart gap.

**Observability.**
- Sentry on server and browser, with a `beforeSend` that drops request bodies, cookies, query strings and email addresses. User id only.
- One logger (`src/lib/log.ts`) writes JSON lines with a request id and fixed reason codes. It never logs emails, IPs, receipts or journal content.
- `GET /api/health` (liveness, no dependencies) and `GET /api/status` (readiness: one cheap database read, returns only `{ok}`).
- Uptime checks on `/` and `/api/status` alert the owner's Telegram.

**Backups and recovery.** Supabase Pro daily backups plus point-in-time recovery in production. Our own nightly encrypted dump to B2 (keep 14 daily and 8 weekly), weekly Storage copy, and a quarterly restore drill into staging. Steps live in `docs/runbooks/restore.md`.

**Secrets.** Only in `.env.local` (development, mode 600, git-ignored), the VPS's `/etc/fundback/env` (mode 600) and GitHub Actions secrets. Separate values per environment. The rotation steps for every key are written in `docs/runbooks/secrets.md`.

**Security headers.** HSTS, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a CSP covering self, Supabase, Turnstile, PostHog and Sentry. The CSP ships as report-only for two weeks, then is enforced.

## 8. When to spend, after revenue

| Order | Buy | First trigger |
|---|---|---|
| 0 | Domain | Before launch: email, Cloudflare and Google sign-in all need it |
| 1 | Supabase Pro ($25/month) for production | Public launch. Free projects pause and have no backups, which is unacceptable for a ledger |
| 2 | Resend paid plan | More than 80 emails on any day (free: 100 a day), or before a creator campaign |
| 3 | Dedicated VPS for Fundback | Origin p95 over 400 ms, or CPU over 70% for an hour, two days running |
| 4 | Second origin + Redis | Past about 100k MAU, or when deploys must have no gap. Rate limits are already in Postgres; cron moves to one leader |
| 5 | Read replica | Admin reports or journal analytics slow the primary |

## 9. Production task list

Each task is one session, finished with `pnpm verify` (typecheck, lint, unit tests, database tests, build).

**Phase S: safety net (before any real user)**
- **S1 Version control.** The owner's repository, `main` protected, CI required.
- **S2 Backups.** The nightly backup workflow, a read-only backup role, `restore.sh`, and one restore into local Postgres that is verified table by table.
- **S3 Environments.** Link staging, push migrations, `pnpm db:push:staging` / `db:push:prod`; no dashboard SQL edits.
- **S4 Errors and uptime.** Sentry with scrubbing (and a test for the scrubbing), the logger, health and status endpoints, monitors.
- **S5 Data rights.** Export and deletion flows (`18-data-and-operations.md` §9).
- **S6 Secrets.** The runbook and per-environment separation.

**Phase D: deployment on the VPS**
- **D1** Dockerfile (Next.js standalone, non-root user, health check), compose file publishing only on `127.0.0.1:3100`, and a Caddy site block.
- **D2** CPU and memory caps so Fundback cannot starve the other services on the VPS.
- **D3** Cloudflare: Full (strict) TLS, origin firewall limited to Cloudflare ranges, real client IP, cache rules (static always; public pages when there is no session cookie).
- **D4** `deploy.sh` with automatic rollback; proven with a deliberately broken build.
- **D5** Server hardening: SSH keys only, `ufw`, unattended upgrades, `fail2ban`; Dependabot and `pnpm audit` in CI.
- **D6** Runbook: deploy, rollback, restore, VPS rebuild, Supabase/Resend/Telegram outages.

**Phase B: backend hardening**
- **B1** Rate-limit coverage test over every route and action.
- **B2** Email outbox with retries, daily counters and a suppression list for bounces.
- **B3** Local JWT verification (asymmetric signing keys; `getClaims()` without a network call per request).
- **B4** CSP enforced after the report-only period.
- **B5** Daily ledger reconciliation and liability alert.

**Phase U: user experience floor**
- **U1** Skeletons, `loading.tsx`, `error.tsx`, `global-error.tsx` on every route group.
- **U2** Forms: errors beside fields and announced, focus on the first error, correct `inputmode`/`autocomplete`, no double submit.
- **U3** PWA manifest, icons, offline shell (Phase 2 adds push).
- **U4** Per-route JavaScript budget.

**Phase Q: quality gates**
- **Q1** Playwright journeys on a phone viewport with `axe`, including the end-to-end economy flow in `CLAUDE.md` §4.
- **Q2** Lighthouse CI on home, a firm page, deals and a calculator: fail on LCP over 2.5 s or CLS over 0.1.
- **Q3** A `k6` load test against staging: a creator spike (5,000 visitors in 10 minutes) plus 1,000 signed-in users checking in. Replace the estimates in §1 with the results.
- **Q4** Release checklist: verify green, migrations listed, backup under 24 hours old, smoke test passed, rollback image present.

**Order of work.** S1, S3 and the Q0 CI come with product Phase 0. S2, S4, S6 and D1–D4 follow before the waitlist is shared publicly. B1, B5, S5, U1, U2 and Q1 come with Phase 1, before any Coin is credited. The rest come as needed.

## 10. Risks specific to this product

| Risk | Mitigation |
|---|---|
| Coin farming (bots, multi-accounts, fake receipts) | Coins are minted only from confirmed commission; Turnstile; hashed device and IP signals raise `risk_score`; order references are unique; receipt hashes; velocity limits route to manual review |
| Buy → earn → refund abuse | Hold period; reversal on clawback; negative balances freeze redemption |
| Liability exceeds commission received | Coins stay pending until confirmed; daily reconciliation; liability ratio alert above 1.0 |
| A prop firm collapses or stops paying commission | Per-firm status (`watch`, `delisted`); pending Coins for that firm are held, not released |
| Regulatory exposure (gambling, investment advice, forex promotion) | Chance features off by flag; no-advice rule; geo rules on the server; honest copy; DRAFT legal pages until a lawyer reviews them |
| Email limits during a waitlist spike | Outbox with throttling; Resend upgrade trigger (§8) |
| Shared VPS contention | Container CPU and memory caps; public pages cached at the edge |
