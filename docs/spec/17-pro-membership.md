# 17. Pro membership

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.

**Goal:** a subscription that is worth paying for, payable with Coins or cash. Pro is the cheapest way for users to spend Coins: it costs us almost nothing to deliver, while a voucher costs real money. It also earns income that doesn't depend on prop firms.

---

## What stays free

Everything needed to trade safely and to earn rewards stays free: firm status warnings, rule-change alerts for firms the user holds, all calculators, the basic journal, the basic economic calendar with daily digest and 15-minute high-impact alerts, weekend alerts, Guardian for up to 3 accounts, check-in, missions and rewards.

*Why: charging for safety information would contradict our trust positioning.*

## What Pro adds

| Area | Pro feature |
|---|---|
| Rewards | +5% give-back booster on every verified purchase (still inside `max_total_giveback_bps`); priority redemption with a 12-hour target; 2 streak freezes per month; Pro-only monthly contest |
| Guardian | Unlimited accounts; live limit alerts on Telegram and push; multi-account exposure |
| News | Custom news alerts; prop news-window alerts; actual-result alerts |
| Journal | MT5 statement import; unlimited screenshots (free: 50 per month); advanced breakdowns (hour, holding time, rule-follow); weekly written summary; PDF export |
| Tools | Save and compare pass simulations; read-only MT5 sync (when built) |
| Deals | Deal alerts a few hours before free users. Never time-pressure copy, never "buy now" countdowns |
| Status | Pro badge and profile frame |

The weekly written summary uses only the user's own journal data. It describes patterns (e.g. "Your London-session trades had a 0.4R average; your Friday trades lost money 4 weeks in a row") and never suggests trades, pairs or market direction.

## Price

| Plan | Cash | Coins |
|---|---|---|
| Monthly | $9 | 900 |
| Yearly | $79 | 7,900 |

Prices are stored in `pro_plans` and editable in admin.

## Rules

1. **Only available Coins** can pay. Pending Coins never can.
2. Paying with Coins is one database transaction: check balance, write a ledger debit (`type = pro_purchase`), create or extend the subscription. Idempotency key required.
3. Pro bought with Coins has no cash refund. Pro bought with cash follows the payment provider's refund policy.
4. **Auto-renew with Coins** is opt-in and off by default. Remind the user 3 days before renewal. If the balance is short at renewal, Pro ends quietly; it never charges a card unless the user set up a card subscription.
5. Free trials come from XP milestones (no cost to us): 7 days at a 30-day check-in streak, 7 days on reaching Gold, 14 days for the 30-Day Journaler badge. One trial per milestone; trials do not stack beyond 30 days.
6. The +5% Pro booster does not stack with a +5% streak booster beyond the cap; apply the larger of the two, and respect the cap.
7. During a Founding Season override, the Pro give-back booster does not apply (the season rate is already the highest).
8. When Pro ends: data is kept; Pro-only features become read-only (e.g. extra Guardian accounts are visible but not updated by alerts) and nothing is deleted.

## Cash payments (Phase 3)

Use a merchant-of-record payment provider (one that handles global sales tax and VAT) behind an adapter in `src/lib/billing/`. The owner chooses the provider after the company setup is decided. Webhooks are verified and idempotent; subscription status in our database is the source of truth for features.

## Admin and metrics

- Plans and prices, trial rules, manual grant or extend with a reason (audit-logged).
- Finance panel: active Pro users by payment type (Coins, cash, trial), Coins spent on Pro (liability removed), monthly recurring revenue, trial-to-paid conversion, churn.

## Data

`pro_plans` (code, interval, price_cents, currency, price_coins, active), `subscriptions` (user_id, plan_id, source coins|cash|trial|grant, status, current_period_start, current_period_end, auto_renew_coins, provider_ref), `subscription_events`, `pro_trials_granted` (user_id, milestone, granted_at).

A helper `isPro(userId)` on the server is the only way features check access. Never check Pro status only on the client.
