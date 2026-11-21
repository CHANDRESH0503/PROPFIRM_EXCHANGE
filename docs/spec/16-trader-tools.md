# 16. Trader tools and news alerts

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.

**Goal:** the tools a forex prop trader uses every day, all of them aware of their firm's rules. Free tools bring visitors from search and keep users coming back; the most valuable ones are Pro (`17-pro-membership.md`).

**Hard line:** our tools help traders manage risk, follow rules and review their trading. They never tell anyone what to trade. No signals, buy/sell calls, "AI trade ideas", copy trading or currency strength buy/sell indicators. *Why: that is investment advice in many countries, and it brings legal liability.*

---

## 1. Economic calendar and news alerts

A calendar like the ones forex traders already use, with prop firm news rules on top.

**Data source:** a licensed economic calendar API whose terms allow showing events on our site and sending them in alerts. Do not scrape any website's calendar. The owner chooses and pays for the provider; build behind an adapter (`src/lib/calendar/provider.ts`) so it can be swapped. Until a key exists, use a fixture file of fictional events.

**Calendar page (free):**
- Events with time in the user's timezone, currency, impact (low, medium, high), forecast, previous and actual (when released).
- Filters: currencies, impact, today, this week. "My pairs" filter based on the pairs in their journal and watchlist.
- **Firm news rules overlay:** for each firm the user holds in Guardian, show whether that firm restricts trading around this event and the blocked window (e.g. "FirmX: no opening or closing trades 2 minutes before to 2 minutes after"). News rules are stored per program in `firm_programs.rules` and entered by admin.
- Countdown to the next high-impact event.

**Alerts (Telegram, web push, in-app):**
- Free: daily morning digest of today's high-impact events for the user's currencies, at a time they choose.
- Free: alert 15 minutes before high-impact events for their currencies.
- Pro: custom alerts by event, currency and impact, with a custom lead time (1–60 minutes).
- Pro: **prop news-window alert**: "In 5 minutes, FirmX's news restriction starts for USD (NFP). Close or don't open USD trades on your FirmX 50K." Sent only for firms with a news rule that the user holds.
- Pro: actual-result alert when the number is released.
- Respect quiet hours, except for alerts the user marks as important.

**Admin:** provider status, last sync time, failed syncs alert to the owner's Telegram.

## 2. Calculators (free, each with its own indexable page)

- **Prop Lot Size Calculator:** pair, account currency, balance, stop loss in pips or price, risk as % or amount. Gives lots, pip value and money at risk. With a Guardian account selected, warns if the loss would exceed the remaining daily room. Correct pip sizes for JPY pairs, XAUUSD, XAGUSD and indices.
- **Daily Room Calculator:** remaining room before the daily loss limit and max loss for each drawdown type (static, trailing, end-of-day trailing), including floating P&L, commission and swap. Shows the maximum lots for a given stop loss.
- **Pip Value and Margin Calculator.**
- **Risk/Reward and Breakeven Win-Rate Calculator.**
- **Consistency Rule Calculator:** the most you can make today without breaking the rule, and how much more profit you need before a payout request.
- **Payout Calculator:** split, minimum payout, fees and buffer, giving the amount received and expected date.
- **Challenge Cost Calculator:** cost per attempt after discount and rebate, and break-even (already in `07-features.md`).
- **Compounding / Drawdown Recovery Calculator:** how much gain is needed to recover a given loss.
- **Risk of Ruin Calculator:** from win rate, reward-to-risk and risk per trade, the chance of losing a chosen % of the account. Links to the Pass Probability Simulator for the prop version.
- **Currency Converter:** convert amounts between account currencies (USD, EUR, GBP, INR shown only as a display currency) using hourly prices.
- **Correlation Matrix (free page):** correlation between major pairs, gold and indices over 1 week, 1 month and 3 months, as a colour grid. Explains that holding the same direction on highly correlated pairs doubles risk. Data from the FX price adapter.

Every calculator: works without sign-in, remembers last inputs for signed-in users, has a "Save to journal plan" button, and explains the maths in a short section below (good for SEO).

## 3. Pass Probability Simulator (free basic, Pro save and compare)

Inputs: win rate, average reward-to-risk, risk per trade, trades per day, the program's target, daily loss and max loss, drawdown type, time limit if any. Runs 10,000 simulated challenges in a Web Worker and shows pass %, breach % (daily vs max), timeout %, and median days to pass. Shows how changing risk per trade changes the result.

The page states clearly that it is a simplified model, that results are not a prediction, and that most real traders do not pass. Pre-fill it from the user's journal stats when available.

## 4. Market sessions clock (free)

- Sydney, Tokyo, London and New York sessions in the user's timezone, with overlaps highlighted and a live "now" marker.
- Daily rollover time, Friday market close and Sunday open countdowns, adjusted for daylight-saving changes.
- **Weekend alert:** a reminder before Friday close for accounts at firms that don't allow holding over the weekend (Telegram/push, free).

## 5. Holiday and low-liquidity calendar (free)

Bank holidays for major currencies, shown on the economic calendar and sessions clock. Same licensed data provider, or a maintained table edited in admin.

## 6. Multi-account exposure (Pro)

From open positions entered in Guardian (or synced later): total exposure per currency across all accounts, and a warning when the same direction is held on correlated pairs across several accounts. Uses a correlation table refreshed daily from FX price data.

## 7. True trading cost per firm (free)

For each program: typical spread on major pairs, commission per lot and swap policy, combined into "cost per standard lot on EURUSD". Data from firm documents and user reports, approved by admin. Shows the date last checked.

## 8. MT5 tools (Phase 3)

- **Daily Room indicator:** a free MT5 indicator the user installs. It shows their remaining daily room and max loss on the chart, using rules they enter or download from their Guardian account. Display only; it never places, modifies or closes orders.
- **Read-only sync:** an MT5 Expert Advisor that sends balance, equity and closed trades to our API with a per-account token, read-only. Feeds Guardian and the journal automatically. Pro.
- Before release: check that each firm's rules allow third-party indicators or EAs, and say so on the download page.
- Code lives in a separate `mt5/` folder with its own README; the API endpoint validates the token, rate-limits, and accepts data only for the linked account.

## 9. Volatility and range table (free)

Statistics, not predictions: for major pairs and gold, the average daily range (ADR) and ATR over 5, 20 and 60 days, average range by session (Asia, London, New York), and today's range so far compared with the average. Helps traders size stops and avoid oversizing on volatile days. Computed from the FX price adapter; shown with the date and time of the data. No arrows, scores or "buy/sell" wording.

## 10. Prop rules backtest check (Phase 2, Pro)

Traders already backtest in other tools (market replay apps, TradingView, MT5 Strategy Tester). We don't rebuild a replay engine. Instead:
- The user uploads a backtest trade list (CSV from common tools, or the MT5 Strategy Tester report).
- We run those trades, in order, against a chosen prop program's rules: daily loss, max loss and drawdown type, profit target, consistency rule, minimum days, news restrictions (using the economic calendar history), weekend holding.
- Result: "Would this strategy have passed FirmX 50K?" with the day it passed or breached, which rule broke, and how often it would pass if the trades were reshuffled (Monte Carlo, 1,000 runs).
- Compare one backtest across several firms' programs side by side. This links naturally to deals and our code.
- Clear note: past results and backtests don't predict future results.

## 11. Verified track record page (Phase 3, Pro, opt-in)

For users with read-only MT5 sync: a public profile page showing verified stats from the synced account (gain %, max drawdown, win rate, months traded, payouts verified by us). Money amounts optional. It is a record of the user's own results, never a signal service: no live positions, no copy button, no "follow" trading. Users can make it private again at any time.

## 12. Tools we will not build, and partner instead

- **Market replay and full backtesting engines:** expensive (historical tick data licensing, charting). Partner with existing tools through affiliate links on a "Tools we recommend" page, clearly marked as affiliate links. Our backtest check (§10) works with their exports.
- **Charting platform:** traders already use their own; we link and embed only where licences allow.
- **Pattern scanners, sentiment indicators, signals and trade ideas:** these tell people what to trade, which breaks rule §2.11. Not built and not promoted.

## 13. Price data

An FX price API (owner chooses; behind an adapter in `src/lib/prices/`) for pip values, currency conversion, correlations and volatility statistics. Daily OHLC history for 3+ years is needed for ADR, ATR and correlation; check the provider's licence allows showing derived statistics publicly. Refresh hourly; cache in the database. Never show prices as live trading quotes.

---

## Telegram bot

One bot handles all Telegram features. The user links their account with a one-time code from Settings.

Commands:
- `/today`: today's high-impact events for my currencies, with firm news windows.
- `/next`: the next high-impact event and countdown.
- `/room`: remaining daily room on each Guardian account (uses the last balance entered or synced).
- `/deals`: current deals on watched firms.
- `/range EURUSD`: today's range compared with its average daily range.
- `/coins`: Coin balance, pending Coins and progress to my reward goal.
- `/streak`: check-in and journal streaks.
- `/log`: quick-log a trade (symbol, direction, result, tag) by guided buttons.
- `/settings`: open the notification settings page.

The bot sends the alerts the user enabled in `08-notifications.md`. It never sends promotions unless the user opted in. Webhook verified with a secret; per-user rate limits.

## Mobile app push

The site is a PWA (Phase 2). Web push works on Android and on iOS when the app is added to the home screen. All alert types above are available as push. A native app is a later decision for the owner.

---

## Data

`calendar_events` (provider_id, currency, title, impact, scheduled_at, forecast, previous, actual, revised), `calendar_sync_runs`, `news_alert_rules` (user_id, currency, impact, event_key, lead_minutes, channels), `alerts_sent` (dedupe key, so an alert is never sent twice), `holidays`, `fx_prices` (pair, price, fetched_at), `fx_correlations`, `calculator_presets`, `simulation_runs`, `fx_daily_bars` (pair, date, open, high, low, close), `volatility_stats`, `backtest_uploads`, `backtest_results` (program_id, passed, breach_rule, breach_day, pass_rate_mc), `track_record_pages` (user_id, slug, visibility, show_amounts), `partner_tools` (name, category, affiliate_url, description, sort_order), `open_positions` (for exposure; manual or synced), `mt5_links` (tracked_account_id, token_hash, last_seen_at), `telegram_links`.

Add news rules to program rules: `firm_programs.rules.news` = `{ restricted: bool, minutes_before, minutes_after, impact_levels, applies_to: "open_close" | "holding" }`.
