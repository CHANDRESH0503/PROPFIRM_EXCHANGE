# Fundback

Prop-firm rewards platform: best net price on challenges, Coins backed by confirmed commission, and free tools traders use every day. Working name; all brand strings are in `src/config/brand.ts`.

- **Brief and rules:** `CLAUDE.md` (the rules in §2 override everything)
- **Specs:** `docs/spec/`
- **System design and production tasks:** `docs/SYSTEM_DESIGN.md`
- **Status:** `docs/PROGRESS.md` · decisions: `docs/DECISIONS.md` · runbooks: `docs/runbooks/`

## Run it

Requirements: Node 24, pnpm (via corepack), PostgreSQL 15+ binaries on PATH for database tests (`brew install postgresql@17`).

```sh
corepack enable
pnpm install
cp .env.example .env.local   # fill in the staging Supabase values; see docs/runbooks/supabase-setup.md
pnpm dev                     # http://localhost:3000
```

Without a Resend key, emails print to the dev console (and to `DEV_MAIL_DIR` if set). Without a Turnstile secret, verification is skipped outside production.

## Check it

```sh
pnpm verify        # typecheck, lint, unit + database tests, production build
pnpm test:e2e      # Playwright on phone and desktop, against the Supabase project in .env.local
```

Database tests start a throwaway Postgres cluster, apply `supabase/migrations/` behind a Supabase auth shim, and give each test file its own copy. Set `TEST_DATABASE_URL` to use an existing server instead (CI does).

## Database

```sh
pnpm db:status     # migrations applied vs local
pnpm db:migrate    # apply pending migrations (staging by default; production needs APP_ENV=production and --yes-production)
pnpm db:types      # regenerate src/lib/supabase/database.types.ts
pnpm admin:grant you@example.com   # first owner (sign in once first)
```

Never edit an applied migration; add a new one.

## Deploy

`docs/runbooks/deploy.md` (VPS + Cloudflare, Docker image per environment, automatic rollback).
