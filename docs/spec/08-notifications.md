# 8. Notifications

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.


- Channels: in-app centre, email, Telegram bot (linked with a one-time code), web push in Phase 2.
- Types: Coins released, claim status, redemption status, deal on a watched firm, streak at risk (check-in and journal), tracker alerts, rule change at a held firm, weekly recap, Coins expiring, economic calendar digest, high-impact news alert, firm news-window alert (Pro), actual-result alert (Pro), weekend-close reminder, weekly journal review reminder, Pro renewal reminder.
- Every alert is de-duplicated through `alerts_sent` so it is never sent twice. Telegram bot commands are in `16-trader-tools.md`.
- Each user sets preferences per type and channel, with quiet hours in their timezone and a frequency cap. Transactional messages about money are on by default; everything promotional is opt-in. One-tap unsubscribe.
- Weekly recap email: Coins earned and pending, streak, level progress, distance to the reward goal, account status, three relevant deals.

