# Progress

Claude Code updates this at the end of every session.

## Current phase

Phase 0 (foundation and waitlist): **built and verified locally against the staging Supabase project. Not deployed.**

## Done (21 Nov 2026)

**0.1 Plan and system design**
- `docs/SYSTEM_DESIGN.md`: targets, architecture (VPS + Cloudflare + Supabase), trust boundaries, money integrity, jobs, operations, spend triggers, production task list (S/D/B/U/Q), risks.
- `PRODUCT.md` (design-facing product record, derived from CLAUDE.md).

**0.2 Scaffold**
- Next.js 16.4 (App Router, Cache Components, typed routes, Proxy), TypeScript strict, Tailwind 4, shadcn/ui (radix), next-intl (English, every string in `src/messages/en.json`), Zod, Vitest, Playwright + axe.
- `src/config/brand.ts` (all brand strings), `src/config/nav.ts`, the folder layout from CLAUDE.md §4.
- Scripts: `dev build typecheck lint test test:unit test:db test:e2e db:migrate db:status db:types db:seed admin:grant verify`.
- CI: `.github/workflows/ci.yml` (typecheck, lint, unit + database tests on Postgres 17, build, `pnpm audit`; e2e on staging for `main`).

**0.3 Database and auth**
- Migrations `20261121000100_foundation.sql`, `20261121000200_waitlist.sql`, **applied to staging** (`fabiunrsxibmyjkfhfsd`, drift 0). Types generated from staging.
- Tables: `profiles`, `admin_roles`, `feature_flags`, `geo_rules`, `site_settings`, `audit_log` (append-only), `waitlist_signups`; `private.rate_limits`. RLS on all, explicit grants, column-level profile grants, SECURITY DEFINER functions with pinned `search_path` and EXECUTE revoked from API roles.
- Seed rules in the migration: India blocks forex and CFD; chance flags `spins`/`draws` off.
- Auth: email magic link (token-hash and PKCE), Google, onboarding (country once, IANA timezone, 18+), staff gate with TOTP MFA (`aal2`) for `/admin`, sign-out (local/global).
- Server geo helper (`src/lib/geo`), flags with cache tags, durable Postgres rate limits, Turnstile verification, IP hashing with monthly rotation, structured redacting logger, request ids, `/api/health` and `/api/status`.
- Verified on staging through the public API as anon: every table and privileged function refused; only public flags readable.

**0.4 Design system and shells**
- Tokens as CSS variables (theme-ready), Sora/Inter/JetBrains Mono, browser surfaces themed (selection, caret, focus, scrollbars), reduced motion.
- Primitives: button (44 px), input, field (announced errors), card, sheet, tabs, toast, skeleton, select, checkbox, progress ring, coin amount, streak flame, empty state.
- Public layout (header, footer with the affiliate and risk disclosure), signed-in shell (bottom tab bar on phones, top tabs on desktop), Today with designed empty states, placeholders for Deals/Rewards/Accounts, Profile.

**0.5 Waitlist, trust pages, admin**
- Home is the waitlist ("founding letter" direction, chosen on the decision page; contract in `.impeccable/surfaces/`). Worked example computed with the tested economy arithmetic (`src/lib/economy/coins.ts`).
- Waitlist: Turnstile, durable rate limits, email-enumeration-safe responses, confirmation email (Resend or local dev sink), token link → httpOnly cookie → `/waitlist/me` with place, referral count and invite link. Referral counts only when the friend confirms and is on a different network.
- Eight trust and legal pages, each marked DRAFT for lawyer review.
- Admin: shell, dashboard (counts + latest audit), waitlist table (search, cursor pagination, CSV export with formula-injection guard), feature flags (owner only, reason required, audited), audit log, MFA enrolment.

**0.6 Check**: see "Verification" below.

## Verification (last run 21 Nov 2026)

- `pnpm typecheck` clean · `pnpm lint` clean (0 warnings).
- `pnpm test`: 41 unit tests + 39 database tests (RLS invariants, profiles, onboarding, roles, flags, audit append-only, rate limits, waitlist position/referrals), all passing.
- `pnpm build` passes; home and trust pages fully static, app/admin partially prerendered.
- `pnpm test:e2e`: 14 tests on phone and desktop, run against a **production build** (`next build && next start`) on staging data, green three runs in a row: waitlist join → email → confirm → place; invalid email; bad link; guards; sign-in → onboarding (18+ refusal) → empty Today (axe clean) → sign-out; non-staff 403; owner reaches MFA enrolment with a scannable QR.
- Design: impeccable finish review on the waitlist page (founding letter) and Today/Onboarding. Round 1 returned 8 material fixes (two truth issues in the copy: the 90% claim and "Coins in minutes"). All were applied; the verdict pass scored 7 resolved and Today's level block partial, which was then fixed (ring without a figure, one progress line). DESIGN.md and `.impeccable/design.json` record the system.

## Next

1. **Owner:** initialise the git repository and push; add the `staging` environment secrets in GitHub for the e2e job (see ci.yml).
2. **Owner:** Supabase dashboard settings in `docs/runbooks/supabase-setup.md` (redirect URLs, magic-link template, MFA on, CAPTCHA off, asymmetric JWT keys).
3. **Owner:** Turnstile keys, Resend account + domain (needed before the waitlist goes public), domain name.
4. Deploy (tasks S2, S4, S6, D1–D4): `docs/runbooks/deploy.md`. Needs the VPS and the domain.
5. Phase 1 plan (prompt 1.1): wait for the owner's OK before building.

## Known issues

- Economy numbers on the home page (90% Founding Season, 60–75% by level, 75% for 12 months, the 15% example rate) are literals in `en.json` and `page.tsx` until `economy_config` exists (Phase 1.4); they must then read from it.

- **Not deployed.** Dockerfile, compose, Caddy block and `deploy.sh` are syntax-checked only (no Docker on the dev machine).
- Waitlist emails are sent after the response with `after()`; if the provider fails, the member resubmits for a new link. An outbox with retries is task B2.
- Sign-in emails use Supabase's built-in mailer (a few per hour) until SMTP is set to Resend.
- CSP ships report-only (except framing/plugins/base-uri, enforced) until two weeks of clean reports (task B4).
- No error tracker yet (Sentry, task S4) and no backups beyond Supabase's (task S2).
- A Google sign-up does not record a referral code (email sign-up does). Referrals are paid only in Phase 1, so this is attribution only.
