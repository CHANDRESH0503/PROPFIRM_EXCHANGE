# 18. Data management and operations

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.

**Goal:** user data, journals and Coins are stored safely, stay fast as the site grows, can be recovered after a mistake, and stay private.

---

## 1. Where data lives

| Data | Where | Notes |
|---|---|---|
| Accounts and sign-in | Supabase Auth (`auth.users`) | Passwords never stored by us; magic link and Google |
| Profile, settings, levels | `profiles` and related tables in Postgres | One row per user, `id = auth.uid()` |
| Coins and XP | `ledger_entries`, `xp_events` | Append-only; balances are views |
| Journal trades, tags, reviews | `journal_*` tables | Row Level Security: owner only |
| Receipts, payout proofs | Storage bucket `receipts`, `proofs` (private) | Signed URLs, 10-minute expiry |
| Journal screenshots | Storage bucket `journal` (private) | Path `journal/{user_id}/{trade_id}/{file}` |
| Logos, banners, theme images | Storage bucket `public-assets` | Public, cached by CDN |
| Voucher codes | `voucher_inventory` | Encrypted with `VOUCHER_ENCRYPTION_KEY` |

Every user-owned table has `user_id` with a foreign key to `profiles(id) on delete cascade`, except the ledger, claims and redemptions, which are kept (anonymised) for accounting when a user is deleted.

## 2. Privacy of journals

- A journal belongs to the user. RLS allows only the owner to read or write their rows.
- **Admins cannot see journal content by default.** Admin screens show only counts (trades logged, last activity, storage used).
- A user can press "Share my journal with support" for a chosen time (24 hours or 7 days) when they need help. Access is logged and ends automatically.
- Aggregate statistics (e.g. average pass rate by firm) use only anonymised data from users who left "Help improve stats" switched on (default on, explained clearly, can be turned off).
- Share cards hide money amounts unless the user chooses to show them.

## 3. Keeping it fast

- Indexes on every foreign key, plus `journal_trades (user_id, closed_at desc)`, `journal_trades (user_id, tracked_account_id, closed_at)`, `ledger_entries (user_id, created_at)`, `purchase_claims (status, created_at)`.
- Dashboard numbers come from a summary table `journal_daily_stats` (user, account, day: trades, wins, losses, P&L, R sum, best and worst trade, max intraday drawdown). It is updated by a database trigger when a trade is added, edited or deleted. Charts read summaries, not every trade.
- Lists are paginated with cursors (no offset pagination on large tables).
- Public pages (firms, deals, calculators, calendar) are statically generated or cached and revalidated when admin edits them.
- Heavy work (statement imports, share images, simulations, broadcasts) runs in background jobs or the browser, never during a page request.

**Size estimate:** a trade row is about 1 KB with indexes. 10,000 active users × 500 trades = 5 million rows, about 5 GB. Postgres handles this easily. Screenshots are the real cost.

## 4. Screenshot storage limits

- Compress in the browser before upload: WebP, max 1600 px wide, target under 300 KB.
- Free users: 50 screenshots per month; Pro: unlimited (fair-use cap of 2,000 per month).
- Show each user their storage use in Settings.
- Deleted trades delete their screenshots. Files with no matching database row are cleaned up weekly.
- Receipts and proofs are kept 24 months, then deleted unless tied to an open dispute.

## 5. Backups and recovery

- Production uses a paid Supabase plan with daily backups and point-in-time recovery.
- A weekly encrypted database dump is copied to separate storage owned by the owner (not Supabase), keeping 8 weeks.
- Storage buckets are copied weekly to the same separate storage.
- Restore is tested once a quarter on the staging project, and the steps are written in `docs/runbooks/restore.md`.

## 6. Environments

- Three Supabase projects: **local** (CLI), **staging**, **production**. Never test on production.
- Migrations go local → staging → production through CI. Seed data only on local and staging.
- Production secrets live only in the hosting provider's environment settings.

## 7. Monitoring

- Error tracking (Sentry or similar) on server and browser, with user ID only, no personal data.
- Uptime checks on the home page, API health endpoint, and Telegram webhook, alerting the owner's Telegram.
- Scheduled job runs are recorded in `job_runs` (name, started, finished, status, error) and shown in admin.
- Monthly cost check: database size, storage size, email volume, API usage.

## 8. User account security

- Optional two-factor authentication (authenticator app) for users; required for admins.
- Sign-in alert email for a new device.
- Settings page lists active sessions with "Sign out everywhere".
- Changing the email or redeeming above a set Coin amount requires re-authentication.

## 9. Data rights

- **Export:** the user downloads profile, journal (CSV), ledger, claims and redemptions as a ZIP within 24 hours.
- **Delete:** the user requests deletion, confirms by email, and has a 14-day grace period to cancel. Then the profile, journal, screenshots and personal data are deleted; ledger and claim rows are kept with personal fields removed.
- Requests appear in the admin data-requests queue with due dates.
- The privacy policy states what is kept, why and for how long. Placeholder text is marked DRAFT for lawyer review.

## 10. Email deliverability

Sending domain with SPF, DKIM and DMARC set up before launch; separate sender addresses for transactional and promotional mail; bounces and complaints suppress future sends.

## 11. Migrating PropFirmKarma users

If the owner has users from the earlier PropFirmKarma site: an admin CSV import that creates waitlist entries or invited accounts, carries over Karma Points as a one-time Coin grant from a capped campaign budget (owner sets the rate), and emails each user a claim link. Never import passwords.

## 12. Support and disputes (user side)

- **Help centre:** searchable articles managed in admin, linked from every claim, redemption and Coin screen.
- **Support tickets:** a "Get help" form (topic, linked claim or redemption, message, attachments). The user sees ticket status and replies in their account and by email.
- **Claim appeals:** a rejected claim can be appealed once within 14 days with new evidence. A different admin reviews it when there is more than one.
- **What's new:** a changelog page and a small "new" dot in the menu when features launch.

## Data

`journal_daily_stats`, `job_runs`, `data_requests` (user_id, type export|delete, status, due_at, completed_at), `support_tickets`, `support_messages`, `claim_appeals`, `help_articles`, `changelog_entries`, `journal_support_access` (user_id, granted_until, accessed_by, accessed_at), `user_sessions_view`, `storage_usage` (user_id, bytes, updated_at).
