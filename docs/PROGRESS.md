# Progress

Claude Code updates this at the end of every session.

## Current phase

**Phase 1 is functionally complete on staging** (the core loop is verified end to end in Playwright, 23 Nov). Launch still needs owner items, deployment and the remaining browser tests listed under Next. The foundation, waitlist, catalogue, claims, wallet, finance, engagement, rewards, settings, notification and journal migrations through `20261122000400_journal.sql` are applied to the Fundback staging project. Production deployment remains pending. The Fundback architecture is in `docs/SYSTEM_DESIGN.md`. The root document describes Astrova.

## Phase 1 implementation, 22 November 2026

| Prompt | Current implementation | Outstanding work |
|---|---|---|
| 1.2 Catalogue | Scheduled firms, programs and offers, automatic price history and recent prices on each program, sourced changes, audited staff editing, public directory filters, four-program comparison, region-filtered deals and integer price estimates. Three clearly labelled fictional staging firms. | Rich media uploads and multiple simultaneous offers per program on the detail page |
| 1.3 Claims and outbound | Server-checked outbound tracking, private receipts, duplicate order and hash checks, claim tracker, staff queue, signed proof URLs and recorded decisions | Full browser purchase-to-reward journey, follow-up evidence and the remaining reviewer checks in 1.8c |
| 1.4 Wallet | Owner settings editor with version checks and an audit reason, versioned rates on the home page, immutable ledger, balance view, pending credit, held release, clawback, Coin and XP history. Database tests exercise the worked examples and concurrent retries. | Funded campaign grants and reconciliation |
| 1.5 Commissions | Atomic mapped USD CSV import, duplicate report handling, order matching, manual confirmation, clawback, finance totals and 15-minute release job | Firm reconciliation report, paid status and liability alerts |
| 1.6 Engagement | Local-day check-ins, weekly and milestone freezes, boosters, badges, server-evaluated mission events, level progress, a monthly check-in calendar and reward-goal progress on Today | Full rotating mission pool, remaining onboarding criteria, and Guardian integration |
| 1.7 Rewards | Encrypted voucher primitives, member eligibility and goals, atomic Coin spend, FIFO stock allocation, 48-hour queue and cancellation refunds. Member reward catalogue, code reveal, staff inventory and queue, low-stock indicators, Founding Season settings and profile badges. | Proactive stock alerts, transactional email and a browser test with stocked vouchers |
| 1.8 Referrals and notifications | Profile invite links and joined counts, optional member codes on email and Google sign-in, and first-confirmed-purchase referral credit. Members receive claim, redemption and Coin-release updates in their inbox. They can mark items as read and choose which types to receive. | Transactional member email, quiet hours, frequency caps, inactivity expiry and 30- and 7-day warnings |
| 1.9 Journal | Migration `20261122000400_journal.sql` (applied to staging 22 Nov 2026; drift 0): owner-only RLS on every journal table, preset mistake and emotion tags, daily stats kept by trigger, and server-only functions for every write. Saving a tagged or noted trade earns 5 XP, capped at 10 trades a day; the journal streak has one weekly freeze; Coins are never minted. The Accounts tab is the journal dashboard: quick log, "No trades today", streak, net P&L, win rate, profit factor, average R, equity curve, daily P&L, calendar heatmap, cost of mistakes, breakdowns and chart gallery. Also built: full trade entry with strategy rule checks, tags and mindset; trade detail with on-device screenshot compression (private bucket, signed URLs) and delete; strategies and tags; the public `/journal` landing page. Pips, R and session are computed with DST-aware helpers. | Guided weekly review, journal missions beyond the first entry, share cards, CSV export |
| 1.10 Tools | `/tools` index; lot size, pip value and margin, daily room (static, intraday trailing, end-of-day trailing), payout, risk/reward, drawdown recovery, consistency rule and challenge cost calculators on one tested registry (`src/lib/tools/`). Each calculator updates as you type, works without JavaScript through a Server Action, produces a shareable URL, has its own indexable page with metadata, JSON-LD and an explanation, and credits the daily calculator mission. A DST-aware market sessions clock and an economic calendar using a provider adapter (`src/lib/calendar/`) with fictional fixture events that are labelled on the page. | Daily calendar digest email, firm news-rule overlay (needs Guardian), "My pairs" filter (needs the journal), remembering inputs for signed-in members |
| 1.8b–1.11 | Scheduled job history, waitlist email retries, a published help centre, member support threads, staff replies and internal notes are present | Remaining admin controls, claim appeals, self-service data export and deletion, SEO/analytics and the economy browser journey |
| Phases 2–3 | See the full retention and scale requirements in `docs/PROMPTS.md` and `docs/spec/14-build-order.md` | Both phases remain open |

Implement the remaining Phase 1 slices in dependency order. Continue with notifications and member operations. Journal, tools, analytics and launch verification follow. Each economy change needs transaction-level isolation and retry tests. The founding dates, licensed feeds, partner permissions and live voucher stock depend on owner-supplied information.

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

## Phase 1 completion slices (23 Nov 2026)

Migrations `20261123000100` through `20261123001000` are applied to staging, and types are regenerated.

- **Core loop verified in a browser.** `tests/e2e/journey.spec.ts` passes on phone and desktop against a production build. It covers sign-up, onboarding, check-in, the deal sheet and outbound click, a claim with receipt, owner MFA and claim approval, commission CSV import and confirmation, recording the firm's payment, release by the real job, reward creation and voucher stock, then redemption and code reveal. This closes the Phase 1 "done" criterion.
- **Owner alerts** (`ops_alerts`, `sync_ops_alerts`, `src/lib/ops/alerts.ts`): liability ratio above 1.0, claims waiting over 24 hours, redemptions past target and low voucher stock. Each sends one Telegram message when it opens and one when it resolves, from the minute job. The admin dashboard now shows the queues and their ages, outstanding Coins, the liability ratio, failed jobs (24 hours) and open alerts, each linking to its screen.
- **Commission payments and reconciliation**: finance marks confirmed commissions paid with a payout reference, which is audited. Finance totals now include paid commission. A reconciliation section lists approved claims with no commission after 7 days, reported commissions with no claim, and commissions unpaid after 45 days.
- **Journal**:
  - Free CSV export (`/accounts/trades/export`). It reads under the member's own RLS, uses keyset paging, exact decimal amounts and formula-safe cells, and is rate-limited.
  - Guided weekly review (`/accounts/review`) with the week's stats, best and worst trades, the costliest mistake tag and five questions.
  - "Did you keep last week's rule?", and one rule for next week, shown on Today all week.
  - 100 XP once per week, the Reviewer badge at 8 reviews, a member-chosen review day, and a reminder at 18:00 local that members can switch off.
- **Notifications**:
  - Quiet hours, which can wrap midnight, hold email, Telegram and push until the window ends.
  - A daily cap limits non-transactional messages; money, claim, reward and account messages are never capped.
  - React no longer clears the preference form after a refused save.
- **Economic calendar digest**: opt-in, the member picks currencies and a local hour. It is sent at most once a day, empty days send nothing, it labels fixture data and states it is a schedule, not advice. The calendar page links to it.
- **Analytics** (PostHog):
  - A cookie banner, with "Cookie settings" in the footer to change the choice.
  - The SDK loads only after consent.
  - Ten allowlisted events: signup, checkin, mission_completed, outbound_click, claim_submitted, claim_confirmed, coins_released, redemption_requested, redemption_fulfilled and referral_converted.
  - Background events use the consent stored on the profile.
  - Nothing loads or sends until `NEXT_PUBLIC_POSTHOG_KEY` is set (it is empty now).
- **Fixed**:
  - A `Date.now()` prerender error on `/firms/[slug]` in production builds.
  - `private.is_transactional` was executable by `authenticated`; the security invariant test caught it.
  - The finance firm selector in tests.
  - Duplicate admin nav entries (duplicate React keys).
- **Verified**: typecheck and lint are clean; 223 unit tests and 96 database tests pass. The full Playwright run is recorded below.

## Visual pass: "Arcade Night" (23 Nov 2026)

The owner asked for more colour, a more gamified feel, and no plain black background, using propfirmmatch.com and other prop-firm sites as references. Item Cards stays as the structure. Its finish is now much louder.

- **Theme** (`globals.css`): indigo night ground with a fixed aurora and grid. New tokens: brand violet and pink, cyan, pink, lime, gold-2, ink-deep and surface-2. New utilities: `panel`, `frame-brand`, `frame-gold`, `bg-beam`, `bg-gold-beam` and `bg-xp-beam`. Every contrast pair was checked: text pairs are at least 4.5:1, and white on the beam is at least 5.5:1.
- **Components:**
  - Buttons: primary is a beam pill, there is a new `gold` variant, secondary is a violet tint.
  - Item cards: rarity light wash and glow, a gradient gem tab, and colour-coded stat tiles.
  - Progress: XP and gold beam bars, a gold level hex, and a lit streak flame.
  - Brand mark: a placeholder until the logo exists.
  - Headers and tabs: sticky public header with a beam sign-in pill. App tabs use per-area hues.
  - `TitleIcon` tiles lead the page titles, and every tool has a coloured tile.
  - Surfaces across the app now use `panel`. Inputs are recessed (`bg-ink-deep/60`).
- **Landing:** fact chips (real values only), a gold-framed loot card with a split legend, a quest list with coloured badges, drops in a brand-framed panel, and a glowing closing panel.
- **Today:** a framed player card with a gold wallet tile, check-in as the primary action, coloured quests with XP beam chips, a gold reward goal and a coloured check-in calendar.
- **Directory:** beam chips, a page icon, and dashed pink coupon tags for discounts.
- **Capture:** `pnpm exec playwright test -c playwright.capture.config.ts` (against `pnpm dev`, `CAPTURE_DIR` optional) screenshots the signed-in screens on phone and desktop. Current shots are in `.impeccable/review/arcade/`.
- **Not yet restyled one by one:** admin pages (they inherit tokens and panels only), the trust/legal article pages and the firm detail page beyond the token change.

## Visual redesign: "Item Cards" world (22 Nov 2026)

The owner asked for a gamified redesign inspired by propfirmmatch.com: their craft bar and patterns, not their brand. The impeccable flow was used: product questions, two decision rounds (the owner re-rolled once for more gamification), and the owner chose **Item Cards**. The direction contract is in `.impeccable/surfaces/src-app-public-page-tsx.md`.

- **World:** night ground, Archivo (wide display, normal body), JetBrains Mono for figures, gold for Coins and levels, violet XP bars, and rarity frames fixed by account size: common, rare, epic, legendary (`src/lib/catalogue/rarity.ts`, tested; never commission or sponsorship). Tokens live in `globals.css`, so admin and every page inherit them.
- **Firm directory and deals:** a grid of item cards with rarity tab, rule stat block (target, daily, max, split), struck list price to checkout, net after Coins, the gold Coins-back line, the discount affix and a full-width Get deal action. Asset-class and sort chips sit above, with the rest of the filters in a drawer.
- **Today:** a player card (level badge, XP bar, Coins, check-in), quests with XP chips and a printed Cleared stamp, a gold goal track, tool tiles and an XP activity log. The signed-in header has a player bar (level, XP, Coins) on every screen.
- **Rewards:** the shop as item cards, with gold progress toward each price and status stamps on orders.
- **Landing:** the founding-letter copy is unchanged, now in the hero with a legendary loot card for the worked example (Coins-back split bar), a promise grid, live item cards from the catalogue, tool tiles and the closing reply slip.
- **Also fixed:** admin `Labelled` now links label and control by id (clean accessible names). This made the appeals Playwright journey pass for the first time.
- **Verified:** typecheck and lint are clean, 292 unit and database tests and 34 of 34 Playwright cases pass, and production-build screenshots are in `.impeccable/review/`.

## Member operations, support, spin and SEO (22 Nov 2026)

Migrations `20261122000600_member_ops.sql`, `20261122000700_support.sql` and `20261122000800_spins_draws.sql` are applied to staging (drift 0).

- **Member operations:** freeze, suspend and ban, enforced by database triggers on claims and redemptions. Suspended and banned members are sent to `/restricted`; frozen members see a notice on Rewards and Claims. Funded campaign budgets with hard caps (`/admin/campaigns`) are the only source of non-commission Coins (CLAUDE.md §2.1). Grants and removals are idempotent per request, write new ledger rows, and need confirmation at or above `economy.adjust_confirm_coins` (5,000). Also XP adjustments, boosters, staff-only notes, and the admin users search and profile (`/admin/users`).
- **Coin expiry:** after 12 months without sign-in, earn or redemption, available Coins expire as an `expiry` ledger row, with in-app and email warnings at 30 and 7 days. The daily job `/api/jobs/daily` (host timer `fundback-daily`, 03:15 UTC) runs it.
- **Support and data rights:**
  - Public help centre (`/help`, 5 starter articles) and changelog, both edited in admin.
  - Tickets (`/support`), with internal staff notes hidden by RLS.
  - One claim appeal within 14 days, decided by a different reviewer.
  - Export: a ZIP of profile, ledger, XP, claims, redemptions, journal, support and notifications (`/profile/data`).
  - Deletion: confirmed by email with a button, not by opening the link. It waits 14 days, erases personal fields and files, keeps ledger and claim rows, then deletes the auth user.
  - Admin queues: support, appeals and data requests.
- **Transactional email:** every inbox notification is also emailed (idempotency key per notification), plus Telegram and push.
- **Spin and draw (flags OFF):** cryptographic RNG in Postgres with rejection sampling, published odds (parts per million, must total 100%), and region exclusion on profile and connection country. Prizes are XP, boosters, freezes and tickets, never Coins. Draws offer one free ticket per member; the owner runs the draw after it ends, and only a winner label is published. Every spin and draw stores its random value. Member UI on Rewards and `/draws`, admin at `/admin/spin`.
- **SEO:** `sitemap.xml` (static pages, published firms, help articles), `robots.txt` (only production indexable), `llms.txt`, and a default Open Graph image.
- **Shared foundations:** `ActionForm` with per-form idempotency keys, `fromDbError` mapping database refusals to translated messages, a CSV helper that guards formulas but keeps negative numbers, and an `isSameOrigin` CSRF guard for cookie POST routes.
- **Verified:** 292 unit and database tests pass, including 28 new database tests for member ops, support and spins. Typecheck and lint are clean, and the production build passes. Playwright for these screens is not yet written.
- **Note:** some files (draws page, admin support and appeals, signup referral) were written outside this session on 22 Nov around 13:00. They were integrated, not replaced.

## Integrations, tools and charts (22 Nov 2026)

- **FX prices (Twelve Data):** `src/lib/prices/`. One hourly request for eight USD majors; crosses and gold are derived. Lot size, pip value and daily room use indicative prices when the price or conversion field is empty, show the source and time, and a typed price always overrides. Failures fall back to manual entry and retry after five minutes.
- **Telegram bot:** migration `20261122000500_channels.sql` (applied to staging). Members connect from Notifications with a one-time, 15-minute code. The verified webhook `/api/telegram` answers `/coins`, `/streak`, `/today`, `/next`, `/help` and `/stop`. Without a webhook (local, or before deploy) the server pulls updates: the Notifications page while waiting, and the minute job. Stale messages are not answered. New inbox notifications go to linked chats. Owner alerts are sent when the minute job starts failing and when it recovers.
- **Telegram connect fixes:** the first attempt showed a dev build error. The `web-push` import has no default export under the bundler, although types allowed it, and the production-build e2e run caught it. Safari on a Mac without the Telegram app cannot open `tg://` links ("address is invalid"). The connect panel now offers the app link, Telegram Web, a QR code for a phone, and a copyable `/start <code>` (a pasted code alone also works). The owner confirmed linking works end to end.
- **Web push (VAPID):** a service worker (`public/sw.js`) and a device toggle on Notifications. Subscriptions are capped at ten devices, and gone or failing endpoints are removed. Notifications are delivered by the minute job. VAPID keys were verified by signing a request locally; real delivery needs a browser outside headless test mode.
- **Tools everywhere:** one `ToolDirectory` lists every calculator, the sessions clock, the calendar and the journal on the landing page, Today (compact) and `/tools`.
- **Interactive charts:** the equity curve, daily P&L and calendar respond to hover, touch and arrow keys with tooltips showing the day, result, running total, trades and wins/losses. Selections are announced to screen readers. Calendar days open that day's trades (`/accounts/trades?day=`).
- **Fixed:** the phone tab bar could cover focused elements; scroll padding now keeps them clear.
- Verified: 248 unit and database tests pass, and Playwright passes 32 of 32 on phone and desktop. That includes Telegram linking, commands and disconnect through the webhook, pull mode draining the real bot queue, chart tooltips and keyboard use.
- **Not configured, so not integrated:** PostHog, billing and MT5 keys are empty. The calendar provider is still `fixture` with no key.
- **Owner action:** `EMAIL_FROM` is a gmail.com address. Resend only sends from a domain verified in Resend, so set it to an address on your domain.

## Member referrals (22 Nov 2026)

- [x] Profile shows a member’s invite code, a copyable sign-in URL and the number of accounts attributed to it. The waitlist keeps its own invite system.
- [x] Sign-in accepts a typed or prefilled member code, normalizes case and shows an error for malformed or unknown codes. Email signup passes the code to the profile-creation trigger. Google signup uses a signed, expiring invitation and verifies the new user at the callback. A temporary profile-write failure carries a recipient-bound retry to onboarding.
- [x] The database suite checks the buyer, referrer and finance totals. A second order and concurrent confirmation retries leave the referrer with one 225-Coin ledger credit and one 300-XP event in the test scenario.
- [x] Production build, typecheck, lint, 194 unit tests, 87 database tests and 32 Playwright cases passed. Browser coverage includes a blank field at direct sign-in, profile invite prefill, invalid-code feedback and the Google handoff on phone and desktop.
- [ ] Complete the Google consent screen with a real account on the deployed site and verify attribution. The provider response is simulated in the callback tests.

## Journal verification (22 Nov 2026)

- 241 unit and database tests pass. That includes 7 journal database tests: privacy, per-currency daily stats, the 10-a-day XP cap, ownership of tags and rules, the weekly streak freeze, screenshot limits and future close times.
- Playwright passes 30 of 30 cases on phone and desktop against a production build on staging. The journal journey covers quick log, the streak, a strategy with rules, a full entry (pips 20.0, 2.00 R, net after commission), dashboard figures, cost of mistakes, edit and delete, with axe checks on every page.
- Fixes found by the browser run: the calendar no longer queries invalid month-end dates, form hints moved out of labels so accessible names are clean, the screenshot input has a label, the calendar uses list markup, and its strongest tint keeps 4.5:1 contrast.

## Navigation fix (22 Nov 2026)

- **Fixed:** members looked signed out after tapping the logo on public pages. The prerendered public header now detects the session in the browser: the logo goes to Today and "Sign in" becomes "Open app".
- **Fixed:** `/wallet`, `/claims` and `/notifications` were missing from the proxy matcher, so their session cookie was never refreshed. After the access token expired, members were sent to sign in. All signed-in routes are now covered, and `src/test/proxy-coverage.test.ts` fails if a new app route is left out.
- Nested screens highlight their parent tab (Wallet → Rewards, Claims → Deals, Notifications → Profile). The tab bars read the URL inside Suspense, which Cache Components requires on dynamic routes.
- The same fix covers onboarding and sign-in (session-aware logo) and the 403/404 pages ("Back to Today" for members). `Wordmark` now requires an explicit `href`, so no screen can default to the landing page again.
- Verified by `tests/e2e/journal.spec.ts` (navigation case) on phone and desktop: onboarding, public pages, the 404 page and nested screens all return a signed-in member to the app.

## Tools verification (22 Nov 2026)

- Typecheck and lint are clean, and all 152 unit tests pass. New tests cover pip values for JPY pairs, crosses, XAUUSD, XAGUSD and EUR indices, lot rounding, margin, every drawdown type, payout dates, session times across DST and weekends, the calendar fixture, and a check that en.json holds every copy key the registry produces.
- Playwright: 24 of 24 cases pass on phone and desktop against a production build. New cases cover lot size (conversion field, error focus, shareable URL reproduced server-side), daily room, calendar filters and the sample-data label, and the sessions clock, each axe-clean. The account journey now reaches the calculator from the Today mission and confirms the mission credit.
- Navigation: the public header links Firms, Deals and Tools. The footer has an Explore column. Today has a Trader tools section. The empty `(shell)/deals` folder was removed; `/deals` lives in `(market)`.

## Phase 1 verification (22 Nov 2026)

- Twelve migrations have been applied to staging. The database suite passed 58 tests including concurrent redemption, queued fulfillment, refunds, economy settings version conflicts, notification deduplication, preferences and member isolation.
- Typecheck, lint and 99 unit tests passed. All 16 Playwright cases passed on phone and desktop against a production build using staging data. Coverage includes recent list prices, onboarding after a validation error, check-in, calculator mission credit, wallet and rewards navigation, saved inbox preferences and MFA access to inventory and economy settings.
- A disposable PostgreSQL scenario now covers onboarding, check-in, tracked purchase, claim approval, commission import, buyer and referral credit, release and voucher redemption. A $22.50 commission leaves 450 buyer Coins and 225 referrer Coins outstanding after a 900-Coin redemption. The finance view reports the matching 0.30 liability ratio. The browser purchase-to-voucher test remains open.

## Phase 0 verification (21 Nov 2026)

- `pnpm typecheck` clean · `pnpm lint` clean (0 warnings).
- `pnpm test`: 41 unit tests + 39 database tests (RLS invariants, profiles, onboarding, roles, flags, audit append-only, rate limits, waitlist position/referrals), all passing.
- `pnpm build` passes; home and trust pages fully static, app/admin partially prerendered.
- `pnpm test:e2e`: 14 tests on phone and desktop, run against a **production build** (`next build && next start`) on staging data, green three runs in a row: waitlist join → email → confirm → place; invalid email; bad link; guards; sign-in → onboarding (18+ refusal) → empty Today (axe clean) → sign-out; non-staff 403; owner reaches MFA enrolment with a scannable QR.
- Design: impeccable finish review on the waitlist page (founding letter) and Today/Onboarding. Round 1 returned 8 material fixes (two truth issues in the copy: the 90% claim and "Coins in minutes"). All were applied; the verdict pass scored 7 resolved and Today's level block partial, which was then fixed (ring without a figure, one progress line). DESIGN.md and `.impeccable/design.json` record the system.

## Next

1. **Owner:** verify branch protection and add the `staging` environment secrets in GitHub for the e2e job (see ci.yml).
2. **Owner:** Supabase dashboard settings in `docs/runbooks/supabase-setup.md` (redirect URLs, magic-link template, MFA on, CAPTCHA off, asymmetric JWT keys).
3. **Owner:** Turnstile keys, Resend account + domain (needed before the waitlist goes public), domain name, and a PostHog project key (`NEXT_PUBLIC_POSTHOG_KEY`, EU host by default) to switch analytics on.
4. Deploy (tasks S2, S4, S6, D1–D4): `docs/runbooks/deploy.md`. Needs the VPS and the domain.
5. Remaining Phase 1 items: Playwright for support tickets, data rights (export and deletion) and admin users; rich media uploads and multiple simultaneous offers per program; the full rotating mission pool.
6. Phase 2 starts with the Guardian tracker (2.1). It unlocks the firm news-rule overlay, journal-to-account links and the `account_added` event.
7. **Owner:** choose a licensed economic calendar provider. Until then the calendar and the digest show fictional sample events, labelled as such.

## Known issues

- The home page reads give-back rates, the Founding Season duration and buyer limit from the active economy settings. The illustrative purchase uses a fixed $150 list price and 15% commission.

- **Not deployed.** Dockerfile, compose, Caddy block and `deploy.sh` are syntax-checked only (no Docker on the dev machine).
- Waitlist signup and delivery intent now commit together. Before launch, install the host timer, register the Resend suppression webhook and verify live mail delivery using the deploy runbook.
- Sign-in emails use Supabase's built-in mailer (a few per hour) until SMTP is set to Resend.
- CSP ships report-only (except framing/plugins/base-uri, enforced) until two weeks of clean reports (task B4).
- Sentry instrumentation and encrypted backup scripts exist. Live alert delivery, off-site backup credentials and a restore drill still need verification.
- Google provider consent with a real identity remains a production smoke check. The browser test stops at the provider handoff. Callback tests use simulated provider responses.
