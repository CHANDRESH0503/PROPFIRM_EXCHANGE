# 15. Trading journal

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.

**Goal:** the best free trading journal for prop traders. Users log trades, see what works, and catch the mistakes that breach accounts. It gives a daily reason to open the app and it is the main thing we promote on Reels and TikTok (see "Growth" below).

It is forex-first: pips, lots, R-multiple and sessions, with gold (XAUUSD), indices and crypto also supported. It is linked to the user's prop accounts in Guardian (`07-features.md`), so every trade can be checked against that account's rules.

Build our own design and wording. Do not copy any existing template.

---

## Logging trades

**Manual entry** (fast, mobile-first, under 20 seconds for a basic trade):
- Required: account (or "personal"), symbol, direction, open date and time, close date and time, lots, entry, exit, result in account currency.
- Optional: stop loss, take profit, commission, swap, strategy, setup tags, mistake tags, emotion before and after (1–5), confidence (1–5), notes, up to 4 screenshots.
- Calculated: pips, R-multiple (when a stop loss is given), % of account, holding time, session (Asia, London, New York, overlap) in the user's timezone, day of week.
- "Quick log" mode: symbol, direction, result, one tag. Details can be added later.
- "No trades today" button, which counts for the journal streak.

**MT5 / MT4 statement import** (Phase 2, Pro):
- Upload the HTML or CSV statement exported from the terminal. Parse it on the server, show a preview, de-duplicate by ticket number, then import.
- Imported trades are assigned to a tracked account. Missing fields (strategy, tags, notes) are filled in later from an "Untagged trades" inbox.
- Keep the parser in `src/lib/journal/import/` with fixture files and tests for each statement format. Reject files over 5 MB.

**Later:** read-only platform sync (Phase 3, see `16-trader-tools.md`).

## Strategies and tags

- Users create strategies (name, description, rules checklist, example screenshot). When logging, they tick which rules they followed.
- Setup tags: user-defined (e.g. "London breakout", "order block").
- Mistake tags, preset and editable: moved stop loss, no stop loss, oversized lot, revenge trade, traded during news, broke daily plan, chased entry, closed early, held over weekend. Each mistake shows its total cost.
- Emotion tags: calm, confident, fearful, greedy, frustrated, bored.

## Dashboard

All figures for a chosen period and account filter:
- Rings: net P&L, win rate, profit factor, average R.
- Equity curve, and a daily P&L bar chart.
- Calendar heatmap of daily P&L. Days that came within 20% of the daily loss limit get an amber border; breach days get red.
- Breakdowns by strategy, symbol, session, day of week, hour, holding time and direction.
- "Cost of mistakes": a ranked list of mistake tags with total money lost.
- Rule-follow rate per strategy, and the result when rules were followed versus broken.
- Streaks: longest win and loss runs.
- Chart gallery: screenshots in a grid with symbol, result and strategy.

## Prop rules on top

When a trade is linked to a Guardian account:
- Each day shows the lowest point reached against the daily loss limit and the max loss.
- A breach report shows the trades that caused it, with their tags.
- Consistency-rule status shows the biggest day as a share of total profit.

## Weekly review

Every week (the day is user-chosen; default Sunday) the app opens a guided review:
1. The week's stats, generated automatically.
2. Best trade and worst trade, with screenshots.
3. Five short questions: what worked, what didn't, which mistake cost most, did you follow your plan, how did you feel.
4. One rule to follow next week. It appears on the Today screen all week, and the next review asks whether it was kept.

Pro: a written summary of the week generated from the user's own data (see `17-pro-membership.md`). It describes what the numbers show and never gives trade calls or market predictions.

## Gamification (XP only, never Coins)

- **Journal streak:** a day counts if the user logs a trade with at least one tag, or presses "No trades today". The streak is separate from the check-in streak and has one free freeze per week.
- **XP:** see `05-economy.md`. Logged trades earn XP only when they have a tag or a note, with a daily XP cap, so empty entries can't be farmed.
- **Missions:** "Tag all trades this week", "Finish your weekly review", "Add a screenshot to 3 trades", "Write your strategy rules".
- **Badges:** First Entry, 30-Day Journaler, 100 Trades Logged, Mistake Hunter (50 mistakes tagged), Disciplined Week (a week with all trades following strategy rules), Reviewer (8 weekly reviews).

## Sharing

- Share cards for weekly stats and monthly calendar, generated on the server. Money amounts are hidden by default, showing % and R only. Users choose what to show.
- Each card carries the brand and a small sign-up link. These cards are our promotion material.

## Privacy

- Journals are private by default. RLS: only the owner can read their trades.
- Screenshots go to a private storage bucket with signed URLs.
- Export to CSV (free) and PDF (Pro). Deleting the account deletes the journal.

## Growth: how we promote the journal

- Short Reels, TikToks and Shorts showing the dashboard, calendar and chart gallery, ending with "Comment JOURNAL".
- An auto-DM tool (the owner sets this up outside the app) replies with a link to `/journal?ref=journal-reel`. Track it as a campaign in analytics.
- The `/journal` landing page shows the journal, then sign-up, then onboarding that goes straight to logging the first trade.
- Optional lead magnet: a free downloadable spreadsheet version that links to the full app.

## Data

`journal_trades` (user_id, tracked_account_id null, symbol, direction, opened_at, closed_at, lots numeric, entry numeric, exit numeric, sl, tp, result_cents, commission_cents, swap_cents, pips numeric, r_multiple numeric, session, strategy_id, emotion_before, emotion_after, confidence, notes, source manual|import, external_ticket, import_batch_id), `journal_screenshots`, `journal_strategies`, `journal_strategy_rules`, `journal_trade_rule_checks`, `journal_tags` (kind setup|mistake|emotion, user-defined or preset), `journal_trade_tags`, `journal_reviews`, `journal_weekly_rules`, `journal_import_batches`, `journal_streaks`.

Prices and lot sizes are `numeric` (not float); money stays in integer minor units. Unique index on (user_id, tracked_account_id, external_ticket) for imports.
