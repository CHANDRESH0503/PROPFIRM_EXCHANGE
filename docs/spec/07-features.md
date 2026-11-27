# 7. Features by surface

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.

**Implementation status, 22 November 2026.** The public directory supports filters, comparison and region-aware deals. Firm pages show recent list prices. Members can track claims, view their wallet and redeem rewards. The remaining feature work is listed by prompt in [PROGRESS.md](../PROGRESS.md).


### Public site
- **Home.** Headline and search/compare box → today's best net prices → how it works (Buy → Claim → Redeem) with a Coin calculator slider → the tracker preview → wallet and levels preview → verified payout feed (when live) → how we make money and risk disclosure.
- **Firms directory.** Filters: asset class, account size, steps, price, drawdown type, payout frequency, platform. Sort by net price, list price, newest or name. Cards show list price, net price and Coins earned.
- **Firm page.** Programs table, rules summary, active offers, net price, change history, verified-buyer reviews with firm replies, verified payout stats once at least 20 proofs exist (otherwise "Not enough data yet"), a status banner for `watch` or `delisted`.
- **Compare.** Up to four programs side by side with a shareable URL.
- **Deals.** Live offers with real end dates, a deal calendar and a "watch" button.
- **Tools.** Net Price Finder, Challenge Cost calculator (break-even and cost per attempt), Firm Match quiz (style, budget, markets → shortlist). Forex calculators, economic calendar, sessions clock and simulator are in `16-trader-tools.md`; the journal is in `15-trading-journal.md`.
- **Learn.** Rule Academy: two-minute lessons on drawdown types, consistency rules, payout rules and common breach causes, each with a three-question quiz. A glossary.
- **Trust pages.** How we make money, How rewards work, How we order and score firms, Affiliate disclosure, Risk disclosure, Terms, Privacy, Rewards terms. Write legal pages as placeholders clearly marked DRAFT for lawyer review.

**Outbound flow.** "Get this deal" opens a sheet with the code and a copy button, the two steps (buy with the code, come back and claim), the disclosure, and "Continue to firm". Continuing logs a click with a `click_id` and opens the firm in a new tab. Signed-out visitors are invited to sign up to earn but can still continue.

### Signed-in app
- **Onboarding.** Three short steps: country, timezone and 18+ confirmation; interests (markets, account sizes); notification choices. Ends on Today with the onboarding missions.
- **Wallet.** Available and pending Coins, a timeline where each entry shows its status and expected release date, and XP history.
- **Claim a purchase.** Firm, program, order reference, amount paid, checkout email, receipt upload. A status tracker shows Submitted → Matched → Commission confirmed → Coins available, with expected dates.
- **Rewards.** Catalogue filtered by firm and size, "you can afford this" highlighting, "Set as my goal", redeem flow with confirmation and voucher reveal, redemption history.
- **Accounts (the tracker, called Guardian).** See below.
- **Missions, badges, leaderboard, season.**
- **Referrals.** Link, code, invited friends and their status, earnings.
- **Watchlist and alerts.**
- **Profile and settings.** Notification preferences, Telegram link, public display name, leaderboard opt-out, data export and account deletion.

**Guardian.** One screen for every prop account the user holds.
- MVP of the tracker is manual entry: firm, program, size, phase, start date, starting balance, current balance, daily loss limit, max loss and drawdown type (static, trailing, end-of-day), profit target, next payout date. The program's rules pre-fill these fields.
- Each account shows three rings: room left before the daily loss limit, room left before max loss, and progress to target. Colours move from green to amber to red.
- Alerts: nearing a limit after an update, payout date approaching, subscription renewal due, a rule change at a firm the user holds.
- It only monitors. It never places or copies trades.
- Later: CSV import and read-only platform sync.

**Mobile shell.** Bottom tab bar: Today, Deals, Rewards, Accounts, Profile. Installable as a PWA. Command palette search on desktop.

