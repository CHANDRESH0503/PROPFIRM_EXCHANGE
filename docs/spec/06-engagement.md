# 6. Engagement system

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.

**Implementation status, 22 November 2026.** Local-day check-ins, automatic freezes, milestone boosters, initial missions, reward goals on Today and earned badges on Profile are implemented. The full mission pool, reminders and Guardian integration remain open.


The goal is a daily habit that never depends on spending. Build it as one connected loop.

**Today screen (signed-in home).** In order: check-in button with streak flame, Coins (available and pending), level ring with XP to the next level, progress to the user's chosen reward ("2,300 Coins to a free 10K challenge"), today's three missions, account risk rings from the tracker, deals on watched firms, recent activity.

**Daily check-in and streak.** One tap. Optimistic UI, count-up animation. A calendar shows the month. One free streak freeze per week, used automatically. Milestones: day 3 gives a streak freeze, day 7 a +3% booster, day 14 an XP boost, day 30 a +5% booster and a badge, days 60 and 100 a badge and a booster. An optional reminder is sent in the evening if the streak is at risk.

**Missions.**
- Onboarding (once): complete profile, choose interests, link Telegram, add a first account to the tracker, set a reward goal, finish a first lesson.
- Daily (three, rotated from a pool): view today's deals, update an account balance, pass a lesson quiz, compare two programs, use a calculator.
- Weekly: check in five days, keep all tracked accounts updated, report a rule change, review a firm the user has already bought from (shown only to users with a past purchase still unreviewed).
- A mission is only shown to users who can complete it without buying anything.
- Criteria are data (`missions.criteria` JSON) evaluated on the server from events, so admin can add missions without code.

**Journey milestones.** In the tracker a user logs: challenge started → phase passed → funded → payout received, with proof upload for the last three. Verified milestones pay XP, a badge and a shareable card. This rewards progress and discipline, not spending.

**Badges.** First Claim, Funded, First Payout, streaks of 7, 30 and 100 days, Reviewer, Scout (accepted change reports), Scholar (all lessons), Founding Member. Shown on the profile and share cards.

**Seasons and leaderboards.** A season lasts 90 days and has a theme, a banner and a season badge. Leaderboards (weekly and season) rank engagement XP plus milestone XP. Purchase XP is excluded so the board cannot be bought. Users choose a public display name and can opt out. Prizes are firm-donated challenges recorded as a funded campaign.

**Referrals.** Member invite links and codes are available on Profile. Sign-in supports manual entry and invite-link prefill for email and Google. Purchase confirmation retries and subsequent purchases are covered by the database regression test in `supabase/tests/core-loop.test.ts`.

Each user has a link and a code. The referrer is paid when the friend's first purchase is confirmed, never at sign-up. One level only; no multi-level payouts.

**Community contributions.** "Report a change" on any firm page (price, rule, payout policy) with a source link. Admin accepts or rejects. Accepted reports update the firm's change history and pay XP. A weekly one-question poll (for example, which firm to add next) pays a small amount of XP.

**Share cards.** Server-generated images for level-ups, streak milestones, funded and payout badges, sized for X and Instagram stories. Amounts are hidden unless the user opts in.

**Spin and weekly draw (Phase 2, flag off by default).** One free spin a day with prizes of XP, boosters, streak freezes and draw tickets. A weekly draw awards firm-donated challenge vouchers. Outcomes come from a server-side cryptographic RNG and each one is written to an audit table. Odds are shown next to the wheel. Tickets are never earned from purchases.

**Celebration, used sparingly.** Full-screen moments only for a level-up, a fulfilled redemption and a verified payout. Everything else is a small inline animation.

