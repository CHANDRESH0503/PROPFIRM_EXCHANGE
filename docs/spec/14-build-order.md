# 14. Build order

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.


Build one phase at a time, in vertical slices: migration → database function → server action → UI → tests.

**Phase 0: Foundation and waitlist**

Implementation verified on staging. The deployed-preview acceptance check remains open.
- Scaffold, tooling, CI running typecheck, lint and tests.
- Supabase wiring, auth (email magic link and Google), profiles, admin roles.
- Design tokens, UI primitives, public shell and signed-in shell.
- `brand.ts`, feature flags, geo rules with a server-side helper, audit log.
- Trust and legal page placeholders.
- Public waitlist page: email capture, a referral link that moves the person up the list, Turnstile.
- Done when: the waitlist works on a deployed preview, a user can sign up and see an empty Today screen, an admin can open the admin shell, and RLS tests pass.

**Phase 1: Core loop (MVP)**

In progress. Per-prompt implementation and verification status is tracked in [PROMPTS.md](../PROMPTS.md) and [PROGRESS.md](../PROGRESS.md).
- Staging and production Supabase projects, backups, error tracking, uptime checks, `job_runs` (`18-data-and-operations.md`).
- Help centre, support tickets, claim appeals, data export and deletion requests, and their admin screens.
- Catalogue admin and public pages: firms, firm page, compare, deals, net price.
- Outbound flow and click logging.
- Claims, commission CSV import and matching.
- [x] Append-only ledger, member wallet, versioned economy settings and Founding Season controls. The finance reconciliation acceptance check remains open.
- XP, levels, daily check-in and streak, onboarding and daily missions.
- [x] Rewards catalogue, encrypted voucher inventory and atomic redemption with fulfillment or queueing. Outstanding alerts and browser acceptance are tracked under prompt 1.7.
- Referrals.
- [x] In-app notifications for claim decisions, redemption status and released Coins, with per-type preferences.
- [x] Transactional member email and Coins-expiry warnings (22 Nov); quiet hours and a daily cap for email, Telegram and push (23 Nov).
- Admin: claims, commissions, ledger, redemptions, economy, users, finance panel.
- Basic trading journal: manual logging, quick log, strategies and tags, dashboard, calendar heatmap, chart gallery, journal streak (`15-trading-journal.md`).
- Free calculators: lot size, daily room, pip value, payout, risk/reward; market sessions clock (`16-trader-tools.md`).
- Economic calendar page and free daily digest by email, using fixture data until a licensed provider key exists.
- `/journal` landing page for the Reels campaign.
- SEO basics and analytics events.
- [x] The finance panel’s source view reconciles to both wallets in a seeded purchase and voucher scenario (`supabase/tests/core-loop.test.ts`).
- [x] Verify the complete sign-up, claim, confirmation and redemption journey in Playwright (`tests/e2e/journey.spec.ts`, phone and desktop, 23 Nov).

**Phase 2: Retention**
- Guardian tracker with alerts; journey milestones, proofs and the payout feed.
- Badges, weekly missions, seasons and leaderboards, share cards.
- Watchlist, deal alerts, Telegram bot, weekly recap.
- Reviews with firm replies, change reports, weekly poll.
- Rule Academy, remaining calculators (risk of ruin, currency converter, correlation matrix), volatility and range table, Firm Match quiz, Pass Probability Simulator.
- Prop rules backtest check (Pro) and the "Tools we recommend" partner page.
- Journal: MT5/MT4 statement import, mistake-cost report, prop-rule overlay, guided weekly review, share cards.
- Telegram bot with all commands in `16-trader-tools.md`; news alerts (15-minute high-impact free; custom and firm news-window alerts Pro); weekend alerts.
- Pro membership paid with Coins, XP-milestone trials, `isPro` gating (`17-pro-membership.md`).
- PWA and web push.
- Spin and weekly draw, built and left switched off.
- Fraud console, sponsorship manager, growth panel.
- User two-factor, session list, journal support-access sharing, view-as-user, system health, bulk tools, feature rollout.
- PropFirmKarma user import, if needed.

**Phase 3: Scale**
- Server-to-server postbacks from firms.
- Creator program (personal codes, revenue share inside the give-back cap).
- Terms snapshots with diffs, and a published firm status method.
- Free demo trading contest with firm-sponsored prizes.
- Pro paid by card through a merchant-of-record provider.
- Multi-account exposure, true trading cost per firm, holiday calendar.
- MT5 Daily Room indicator and read-only sync EA.
- Verified track record pages (opt-in).
- More languages.
- Browser extension that applies the code only after a user action, with the affiliate relationship disclosed.
- Monthly public data report.
- Firm partner portal and creator dashboards (`09-admin.md` §30).

