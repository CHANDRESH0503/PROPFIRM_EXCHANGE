# Prompts for Claude Code

Copy one prompt at a time into Claude Code, opened in the project folder. Wait for each to finish, check the result in the browser, then send the next. Each prompt is one session's worth of work.

Before you start:
- Install Node 20+, pnpm and the Supabase CLI.
- Create a Supabase project and keep its URL and keys ready.
- Copy `.env.example` to `.env.local` and fill in what you have. Leave the rest empty.

When a session ends, or the context gets long, start a fresh session and say: **"Read CLAUDE.md and docs/PROGRESS.md, then continue."**

---

## Phase 0: Foundation and waitlist

**0.1 Plan** — Done · foundation and waitlist design recorded
> Read CLAUDE.md and docs/spec/14-build-order.md. Plan Phase 0 as vertical slices: list each slice, the migrations, the packages you will install, and any questions for me. Don't write code yet.

**0.2 Scaffold** — Done · scaffold, scripts and CI workflow in repository
> Do the scaffold slice: Next.js with TypeScript strict, Tailwind, shadcn/ui, ESLint, Vitest, Playwright, the pnpm scripts in CLAUDE.md §4, `src/config/brand.ts`, the folder layout, and a GitHub Actions workflow running typecheck, lint and tests. Then create docs/PROGRESS.md.

**0.3 Database and auth** — Done on staging · RLS, onboarding and authentication exercised
> Do the Supabase slice: local Supabase, profiles, admin_roles, feature_flags, geo_rules, audit_log, all with RLS default-deny and tests for the policies. Add email magic link and Google sign-in, the onboarding step with country, timezone and 18+ confirmation, and a server-side geo helper with the India forex/CFD seed rule.

**0.4 Design system and shells** — Done · phone and desktop shells verified
> Read docs/spec/12-design.md. Build the design tokens, fonts, UI primitives (button, card, input, sheet, tabs, toast, skeleton, progress ring, coin amount), the public layout with header and footer, the signed-in shell with the mobile bottom tab bar, and an empty Today screen with designed empty states.

**0.5 Waitlist and trust pages** — Done on staging · waitlist confirmation and referrals verified, legal copy remains draft
> Build the public waitlist page: email capture with Turnstile, a personal referral link, position in the list that moves up for each confirmed referral, and a confirmation email. Add the trust and legal pages as DRAFT placeholders. Add the admin shell with role check and a waitlist table.

**0.6 Check** — Local checks passed · deployed preview pending, VPS is the chosen host
> Run typecheck, lint, all tests and the build. Fix anything failing. Then tell me exactly how to deploy this to Vercel with my Supabase project, and update docs/PROGRESS.md.

**Your job after Phase 0:** deploy, then share the waitlist link with trader communities and creators. It collects users while you build Phase 1.

---

## Phase 1: Core loop (MVP)

**1.1 Plan** — In progress · implementation order and launch dependencies recorded in PROGRESS.md
> Read CLAUDE.md, docs/spec/05-economy.md, 07-features.md, 09-admin.md, 10-data-model.md and 14-build-order.md. Plan Phase 1 as slices with migrations and open questions. Wait for my OK.

**1.2 Catalogue** — Implemented on staging · public directory, compare, deals, sample firms and staff editor verified; detailed gaps in PROGRESS.md
> Build firms, programs, offers, price history and firm changes: migrations, admin CRUD with scheduling, and the public firms directory, firm page, compare page and deals page with net price. Seed three obviously fictional sample firms flagged is_sample.

**1.3 Outbound and claims** — Implemented on staging · database checks passed; full browser purchase journey pending
> Build the "Get this deal" sheet, click logging with click_id, the claim form with receipt upload to the private bucket, the claim status tracker, and the admin claims queue. Add duplicate order-ref and receipt-hash checks.

**1.4 Ledger and wallet** — Implemented on staging · append-only ledger, balances, hold and reversal tested; owner settings editor implemented, funded campaigns and reconciliation pending
> Build economy_config (versioned), the append-only ledger, the wallet_balances view, and Postgres functions for crediting pending Coins, releasing, reversing and the give-back cap. Write the worked examples from docs/spec/05-economy.md as tests first, then make them pass. Then build the wallet screen.

**1.5 Commissions** — In progress · import, matching, confirmation, clawback, release job and liability view implemented
> Build commission CSV import with column mapping, matching against claims with a confidence score, confirm and clawback flows, and the scheduled job that releases Coins after the hold period. Add the finance panel with the coin liability ratio.

**1.6 XP, levels, check-in, missions** — In progress · check-in, streak freezes, levels and initial missions verified; additional mission criteria pending
> Read docs/spec/06-engagement.md. Build xp_events, levels, the daily check-in with streak, freezes and milestones, onboarding and daily missions with server-side criteria, and the full Today screen. Test streak day boundaries across timezones.

**1.7 Rewards and redemption** — In progress · member shop and code reveal, staff inventory and queue, Founding Season settings and profile badge implemented. PostgreSQL tests cover fulfillment, cancellation and refunds. Proactive low-stock alerts remain open
> Build rewards, encrypted voucher inventory, the redemption transaction, the voucher reveal, the out-of-stock queue with 48-hour target, the admin redemption queue and low-stock alerts. Add the Founding Season setting and the Founding Member badge.

**1.8 Referrals and notifications** — In progress · member invite links, referral entry on email and Google sign-in, first-purchase referral credit, claim and reward updates, Coin-release notifications and in-app preferences implemented. Transactional member email and expiry warnings remain open
> Build referrals (paid on the friend's first confirmed purchase), the in-app notification centre, email notifications with preferences, and the Coins-expiry warnings.

**1.8b Admin: site control** — In progress · catalogue and reward editing, encrypted voucher upload, feature flags and audit trail implemented
> Read docs/spec/09-admin.md §1–6 and §9–10. Build the admin dashboard home, brand and theme editor (CSS variables from the database with live preview and contrast check), homepage section manager, navigation and FAQ editor, announcement bar, breaking offer ticker, banners with placements and schedules, firm and program editor with logo upload, offers and promo codes, the users screen with add/remove Coins and XP through the ledger, freeze/suspend/ban/unban, and the shop item editor with voucher upload. Every action audit-logged with a reason.

**1.8c Admin: claim review** — In progress · private receipt viewer, queue, review decisions and user-visible reasons implemented
> Read docs/spec/09-admin.md §7. Build the claim review screen: receipt viewer, the automatic checks (duplicate order ID, image hash, date window, amount vs price, claim velocity, commission match), approve/reject/ask-for-info/flag, reasons the user sees, keyboard shortcuts and next-claim flow, mobile-friendly.

**1.8d Operations and support** — Implemented on staging · help centre, tickets, claim appeals, data export and 14-day deletion with admin queues; browser tests outstanding
> Read docs/spec/18-data-and-operations.md. Set up staging, error tracking, uptime checks and job_runs. Build the help centre, support tickets, claim appeals, data export and deletion requests, and their admin screens (09-admin.md §23–25). Write docs/runbooks/restore.md.

**1.9 Trading journal (basic)** — Implemented on staging · browser journey verified on phone and desktop; weekly review, share cards and CSV export outstanding
> Read docs/spec/15-trading-journal.md. Build the basic journal with RLS owner-only access, the journal_daily_stats summary table updated by trigger, and browser-side screenshot compression: manual and quick logging, strategies, setup/mistake/emotion tags, screenshots, the dashboard with rings, equity curve, calendar heatmap and chart gallery, the journal streak and its XP. Mobile-first: logging a trade must take under 20 seconds. Then build the /journal landing page.

**1.10 Forex tools and calendar** — In progress · eight calculators, sessions clock and fixture-backed calendar verified on phone and desktop; calendar digest email outstanding
> Read docs/spec/16-trader-tools.md. Build the free calculators (lot size, daily room, pip value and margin, risk/reward, payout), the market sessions clock, and the economic calendar page behind a provider adapter using fixture data. Add the daily calendar digest email. Each calculator gets its own indexable page with an explanation section. Write tests for pip values on JPY pairs, XAUUSD and each drawdown type.

**1.11 SEO, analytics, end-to-end** — In progress · catalogue, account, MFA and engagement browser journeys pass. A database scenario reconciles purchase, referral and voucher redemption against finance totals. The full Playwright purchase journey and analytics remain open
> Add metadata, sitemap, JSON-LD, OG images and llms.txt. Add the PostHog events from docs/spec/13-seo-analytics.md with cookie consent. Write the Playwright flow sign-up → check-in → claim → admin confirm → redeem, and make it pass. Update docs/PROGRESS.md.

**Your job before launch:** choose a licensed economic calendar data provider and an FX price API, and add their keys; get written rebate permission from each firm, enter real firm data and codes in admin, upload voucher codes, have a lawyer read the terms and the rewards terms, and set the Founding Season dates.

---

## Phase 2: Retention

Run these one at a time, starting each with "Read CLAUDE.md and the spec files this touches. Plan first, then build."

- **2.1** Guardian tracker: accounts, snapshots, risk rings, limit and payout-date alerts. Link journal trades to Guardian accounts.
- **2.2** Journey milestones, proof uploads, moderation, and the verified payout feed.
- **2.3** Badges, weekly missions, seasons, leaderboards and share cards.
- **2.4** Watchlist, deal alerts, the Telegram bot with every command in 16-trader-tools.md, news alerts and weekend alerts, and the weekly recap email.
- **2.5** Reviews with firm replies, change reports and the weekly poll.
- **2.6** Rule Academy, remaining calculators, the Firm Match quiz and the Pass Probability Simulator (Web Worker, 10,000 runs).
- **2.6a** Risk of ruin, currency converter, correlation matrix, volatility and range table (statistics only, no buy/sell wording), the prop rules backtest check with Monte Carlo reshuffle, and the partner tools page.
- **2.6b** Journal upgrades: MT5/MT4 statement import with fixture tests, mistake-cost report, prop-rule overlay, guided weekly review and share cards.
- **2.6c** Pro membership paid with Coins: plans, Coin purchase transaction, XP-milestone trials, `isPro` gating, renewal reminders (17-pro-membership.md).
- **2.7** PWA and web push.
- **2.8** Spin wheel and lucky draw with their admin screens (09-admin.md §11), built behind a flag that stays off.
- **2.8b** Admin: breaking news posts, broadcasts to segments, message templates, content pages with versions, SEO and redirects, moderation, settings and owner Telegram alerts (09-admin.md §14–22).
- **2.9** Fraud console, sponsorship manager and growth panel.

## Phase 3: Scale

Includes card payments for Pro, the MT5 Daily Room indicator and read-only sync EA, and multi-account exposure. Plan each item with Claude Code when you reach it, using docs/spec/14-build-order.md.

---

## Useful prompts at any time

- **Review:** "Review the last slice against CLAUDE.md §2. List any rule it breaks, any missing RLS policy, and any untested economy code."
- **Fix:** "This is broken: [what you see, error text, steps]. Find the cause before changing code, then fix it and add a test."
- **Design pass:** "Open [page] at 390px and 1440px width. Compare it with docs/spec/12-design.md and fix spacing, contrast, empty and loading states."
- **Rename:** "The brand is now [name], code [CODE], domain [domain]. Update src/config/brand.ts and anything that doesn't read from it."
- **Status:** "Read docs/PROGRESS.md and the codebase. Tell me what's done, what's half done and what's next."
