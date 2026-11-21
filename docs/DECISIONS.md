# Decisions

Record notable decisions here: date, decision, reason. Newest first.

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
