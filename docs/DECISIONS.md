# Decisions

Record notable decisions here: date, decision, reason. Newest first.

## 2026-11-23 — Phase 1 completion slices (Claude)

- **Owner alerts** are computed in the database (`ops_alert_conditions`) and applied by `sync_ops_alerts`, which returns only transitions (opened or resolved). The owner gets one Telegram message when a condition starts and one when it clears. The minute job runs the sync; the admin dashboard lists open alerts. Thresholds: liability ratio above 1.0 (05-economy.md), a claim waiting more than 24 hours, a redemption past its 48-hour target, and voucher stock at or below the reward's threshold.
- **Commission "paid"** is separate from the member lifecycle. Coins are backed by the confirmed commission; paid only records that the firm's money arrived. Finance marks paid with a payout reference, and the action is audited. Reconciliation is a view: approved claims with no commission after 7 days, reported commissions with no claim, and confirmed commissions unpaid after 45 days.
- **Weekly journal review XP** (100, 05-economy.md) is awarded once per week by idempotency key and sits outside the daily engagement cap, like weekly missions. Only the current review week can be saved, so XP cannot be farmed by backdating. The reminder goes out at 18:00 local on the member's chosen day, only to members who journaled in the last 14 days, and members can switch it off.
- **Quiet hours and the daily cap** apply only to email, Telegram and push; the in-app inbox always gets everything. Quiet hours hold messages until the window ends. The cap limits non-transactional messages (journal reminders, draw results); money, claim, reward, account and support messages are never capped.
- **Calendar digest** is opt-in. Each day is recorded before the email is sent (at most once a day), and the email idempotency key covers retries. Days with no matching high-impact events send nothing. While the provider is the fixture, every digest says the events are fictional.
- **Analytics (PostHog)** starts only after "Accept analytics". The browser SDK is loaded on demand, never loads remote scripts, has autocapture and recordings off, and identifies members by id only. Server events from a member's own request need the consent cookie. Events that happen without the member present (claim confirmed, Coins released, redemption fulfilled, referral converted) need the consent stored on the profile. Events and property shapes are allowlisted, so no email, name or free text can be sent. With no key configured nothing loads or sends. `account_added` and `lesson_completed` wait for Guardian and Academy (Phase 2).
- **E2E fixtures for the core loop**: the journey test creates a published partner firm, because a real one needs the owner's contract. It ends the hold for that one commission through a test-only Postgres helper, so global economy settings are never changed. Afterwards it delists the firm and deactivates the reward through the admin function; ledger history stays.
- `/firms/[slug]` now calls `connection()` first. It is per-request anyway (region and session decide eligibility), and this removed a `Date.now()` prerender error that appeared in production builds.

## 2026-11-23 — Item Cards turned up to "Arcade Night" (owner request)

- The owner found Item Cards too plain ("less colors", "plain black background") and asked for a more colourful, gamified UI with propfirmmatch.com and other prop-firm sites as references. Sites reviewed: propfirmmatch.com, FTMO, FundingPips, FundedNext, E8 Markets, The5ers and Alpha Capital. Patterns taken: a coloured night ground lit by gradient glows, gradient pill actions, framed offer panels, coupon-style discount tags, fact chips and coloured icon tiles. Not taken: propfirmmatch's magenta identity, invented counters (§2.6) and rankings that read sponsorship (§2.7).
- The ground is now an indigo night (#120c32) with a fixed aurora (violet, cyan, pink, mint) and a faint chart grid. The primary action is a violet-to-pink pill, and a gold pill is used only for Coins actions. Each area owns a hue: Today violet, Deals pink, Rewards gold, Accounts cyan, Profile mint. Tools and quests cycle accent hues.
- Rules kept: gold means Coins, levels and rewards. Rarity is fixed by account size. Green, amber and red are state. Figures are mono and tabular. There is no gradient text. The landing page's fact chips read real values (economy settings, tool registry).
- The owner's earlier request to keep the dark theme still holds: the theme is dark, but no longer black.

## 2026-11-22 — Visual world replaced: Item Cards (owner choice)

- The owner replaced the "Signed Ledger" world after two impeccable decision rounds. Item Cards maps programs to items with stat blocks, deals to drops with discount affixes, Coins to gold and progress to XP bars, and it is gamified without chance mechanics.
- Rarity is a fixed function of account size, so it can never encode commission, sponsorship or a quality judgement (CLAUDE.md §2.7).
- What was not taken from propfirmmatch.com: invented counters (§2.6), rankings that read sponsorship (§2.7), and its magenta gradient identity.

## 2026-11-22 — Member operations, data rights and chance features (Claude)

- Restrictions are enforced by BEFORE INSERT triggers on claims and redemptions, so every path (current and future functions) is covered without rewriting them.
- Staff Coin grants require a campaign budget, and the cap is checked under a row lock. Idempotency is checked before the cap, so a retried request returns the original grant instead of failing.
- Deletion confirmation uses a button on the linked page, never a GET side effect, so email link scanners cannot schedule a deletion.
- Spin outcomes use `pgcrypto` random bytes with rejection sampling inside the database function, so the server cannot bias results and every result stores its random value. Prize tables are replaced as a whole so odds always total 100%.
- Data export is built on demand (well inside the 24-hour target) rather than queued.

## 2026-11-22 — Channels and prices (Claude)

- Telegram and web push copy the in-app inbox rather than having their own triggers: one source of truth, the same per-type preferences, and at-most-once delivery (`claim_notification_batch`).
- Telegram works in pull mode until a webhook is registered, because a webhook needs public HTTPS. The pull runs in-process with a single-flight guard, which suits the single VPS instance; with more instances, register the webhook.
- Bot replies are plain text with no parse mode, so member data cannot inject formatting. `/today` and `/next` list scheduled events only (no trading advice, CLAUDE.md §2.11).
- FX prices are cached in the server (`use cache`, hourly) instead of a database table. That is enough for one instance and stays within the provider's free limits; move to a job-filled table if there is ever more than one instance.

## 2026-11-22 — Journal placement and writes (Claude)

- The journal lives in the Accounts tab until Guardian ships; the tab keeps the name from `07-features.md` and the page notes that per-account tracking arrives with Guardian. Trades carry no account yet; adding `tracked_account_id` later is additive.
- All journal writes go through SECURITY DEFINER functions called by the server, because a save also awards XP and moves the journal streak. Members read their own rows through RLS. The service role can read for exports and staff counts; staff screens never show journal content.
- The journal streak counts the day the member logs, not the day the trade closed, so backdated entries can't rebuild a streak.
- Net result = profit + commission + swap (costs negative), stored as a generated column. Daily stats are per currency, so different account currencies are never summed together.
- Types were regenerated from staging after the push (`pnpm db:types`).

## 2026-11-22 — Trader tools structure (Claude)

- Calculators are data in one registry (`src/lib/tools/calculators.ts`) rendered by one form. Results update as you type for slow phones, and the same form posts to a Server Action, so pages still work without JavaScript. Adding a calculator means adding a definition and messages; a test checks every copy key.
- The default instrument conventions are a gold pip of 0.10 ($10 per lot), silver 0.01 on 5,000 oz, and indices at one point per 1.00 contract. Brokers differ, so every calculator accepts a contract-size override and the page says so.
- Prices are typed by the trader when a conversion needs them. There is no FX price feed until the owner chooses one (`16-trader-tools.md` §13).
- The calendar uses fictional fixture events behind `CalendarProvider` and states this on the page until a licensed provider is connected.

## 2026-11-21 — Phase 0 engineering decisions

- **Hosting:** the owner's VPS behind Cloudflare, like Astrova (owner choice), not Vercel. One Next.js standalone container on loopback, host Caddy in front. NEXT_PUBLIC values are build-time, so one image per environment.
- **Database tests on plain Postgres** with a Supabase auth shim that grants everything by default (Supabase's worst case), so RLS tests prove the migrations lock things down on their own. No Docker needed; CI uses a Postgres 17 service.
- **Economy writes only through SECURITY DEFINER functions** executable by `service_role`, which re-check roles and invariants. Clients get column-level grants (profiles: `display_name` only).
- **Rate limits in Postgres** (`rate_limit_hit`, fixed window, unlogged table): durable across restarts and containers, fail closed.
- **Turnstile verified by the app**, not by Supabase's CAPTCHA (tokens are single-use).
- **Waitlist identity by emailed token** (hash stored), exchanged for an httpOnly cookie; joins answer the same for new and existing emails. Position = confirmed members ordered by `seq − boost × confirmed_referrals` (boost in `site_settings`, default 5); a referral counts only on the friend's confirmation and only from a different IP hash.
- **Country is set once at onboarding** (changing it is a support action) so it cannot be used to dodge geo rules; the stricter of declared and Cloudflare country wins.
- **Admin requires TOTP MFA (`aal2`)** from day one; roles are re-checked in every page and in the database function.
- **Trust pages as static routes** with content in messages, marked DRAFT; ready to move to the admin content editor.
- **Waitlist page design:** "founding letter" structure chosen by the owner on the decision page (21 Nov 2026).

## 2026-11-21 — More trader tools (owner)

- Added risk of ruin, currency converter, correlation matrix, volatility/range table, prop rules backtest check and verified track record pages.
- Market replay, full backtesting and charting: partner through labelled affiliate links instead of building.
- Pattern scanners, sentiment indicators and signals: not built (no trading advice).

## 2026-11-21 — Data, privacy, support (owner)

- Journals are private: admins see counts only unless the user grants time-limited support access.
- Separate local, staging and production projects; daily backups plus a weekly off-site copy.
- Added support tickets, claim appeals, data requests, view-as-user (read-only, logged), system health, bulk tools and a later partner portal.

## 2026-11-21 — Journal, trader tools, Pro (owner)

- Added a free built-in trading journal (`15-trading-journal.md`), promoted with "Comment JOURNAL" Reels and auto-DM.
- Added forex tools that know firm rules, an economic calendar with news alerts on Telegram and push, and MT5 tools later (`16-trader-tools.md`).
- Added Pro membership at $9/month or 900 Coins, with free XP-milestone trials (`17-pro-membership.md`).
- No trading signals or trade advice anywhere, including AI summaries.
- Economic calendar data must come from a licensed provider; no scraping.

## 2026-11-17 — Starting decisions (owner)

- Stack: Next.js, TypeScript, Supabase (Postgres), Tailwind.
- Working name Fundback, code FUNDBACK, kept in `src/config/brand.ts` until the name is final.
- Two currencies: Coins (backed by confirmed commission, redeemable) and XP (engagement, levels). Engagement never mints Coins.
- Launch offer: Founding Season at 90% give-back for 90 days or the first 1,000 verified buyers, then 60–75% by level.
- Spins and draws are built in Phase 2 behind a flag that stays off until legal review.
- India is blocked from forex/CFD prop offers by a seed geo rule.
