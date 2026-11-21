# 5. Economy

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.


All numbers here are defaults stored in a versioned `economy_config`. Each ledger entry records the config version it used.

| Setting | Default |
|---|---|
| Coin value | 1 Coin = $0.01 (for display; no cash value) |
| Give-back by level (share of confirmed commission) | Bronze 60%, Silver 64%, Gold 68%, Platinum 72%, Black 75% |
| Season override | Founding Season: 90% for all levels, for 90 days or the first 1,000 verified buyers, whichever comes first |
| Max total give-back | 95% of commission |
| Referral bonus | 10% of the commission on the referee's first confirmed purchase, clipped by the cap |
| Hold period | Coins release once the commission is confirmed and 14 days have passed since purchase |
| Monthly earn cap per user | 50,000 Coins, then manual review |
| Expiry | After 12 months with no sign-in, earn or redemption; warn at 30 and 7 days |
| Engagement XP daily cap | 150 XP |

**Coins earned on a purchase**

`coins = floor(commission_cents × user_share_bps / 10000)`

User share is the season override if one is active, otherwise the level rate plus any active give-back booster. Boosters do not apply during a season override. Referral and creator shares are then added only up to the cap, in that order.

Encode these as tests (commission = 15% of a $150.00 challenge = 2,250 cents):
- Founding Season: 90% → 2,025 Coins. Referral bonus clipped to 5% → 112 Coins.
- Gold, no booster: 68% → 1,530 Coins. Referral 10% → 225 Coins.
- Gold with a +5% booster: 73% → 1,642 Coins.

**Coin lifecycle.** `pending` → `available` → `spent`, `expired` or `reversed`. Each move is a new ledger row. If a commission is clawed back after the Coins were spent, the balance goes negative and the account is flagged for review.

**Campaign budgets.** Any Coins not tied to a commission (for example a payout-proof bonus or a firm-funded promotion) are drawn from a `campaign_budgets` row with a hard cap. When the cap is reached the campaign stops automatically.

**Rebate permission.** A firm's purchases earn Coins only when `firms.rebate_permission = true` (the owner has written permission from that firm to pass commission to users). Other firms can be listed and compared, and show "Rewards not available for this firm".

**XP and levels**

| Action | XP |
|---|---|
| Daily check-in | 10 (×1.5 from day 7 of a streak, ×2 from day 30) |
| Daily mission | 20 each, +30 for completing all three |
| Weekly mission | 100 |
| Onboarding mission | 50 each |
| Lesson with quiz passed | 15 |
| Journal trade logged with a tag or note | 5 (max 10 trades a day) |
| "No trades today" journal entry | 5 |
| Weekly journal review completed | 100 |
| Calculator or simulator used (first time each day) | 5 |
| Verified-buyer review (any star rating) | 50 |
| Accepted rule or price change report | 75 |
| Verified purchase | 500 |
| Verified phase pass / funded | 200 / 300 |
| Verified payout proof | 400 |
| Referred friend's first verified purchase | 300 |

The daily cap applies to check-ins, missions, lessons, journal entries and tools, not to verified events. Journal and tool XP never mints Coins.

| Level | Lifetime XP | Lifetime verified purchases |
|---|---|---|
| Bronze | 0 | 0 |
| Silver | 1,000 | 1 |
| Gold | 4,000 | 3 |
| Platinum | 10,000 | 6 |
| Black | 25,000 | 12 |

Both conditions must be met. Levels never go down, so nobody has to buy to keep a status. Founding Season buyers hold Black for 12 months after the season ends, then return to the level they have earned.

**Pro.** Pro membership can be bought with available Coins; see `17-pro-membership.md`.

**Boosters.** `giveback_boost` (+3% or +5% on the next verified purchase, no expiry, one held at a time), `xp_boost` (2× engagement XP for 24 hours), `streak_freeze`. Boosters come from streak milestones, missions, badges and, once enabled, spins.

**Rewards and redemption**
- Reward types: `free_challenge_voucher` (main), `discount_voucher` (a firm-supplied single-use code with a larger discount), `booster`. `merch` and `donation` exist as types but are inactive.
- Cost in Coins is set per reward by admin.
- Redemption is one database transaction: check the available balance, debit the ledger, create the redemption, assign a code from `voucher_inventory` if one is in stock.
- In stock: the code is revealed immediately with step-by-step instructions. Out of stock: the redemption joins the admin queue with a visible 48-hour target, and the user is notified at every status change.
- Voucher codes are encrypted at rest and shown only to the user they are assigned to.

