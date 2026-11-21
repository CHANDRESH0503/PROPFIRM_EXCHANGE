# 9. Admin panel

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.

**Goal:** the owner runs the whole website from the admin panel without touching code: brand, look, content, firms, offers, rewards, users, Coins and alerts. If something on the public site can change over time, it must be editable here.

---

## General rules for every admin screen

- Lives at `/admin`, role-gated on the server: `owner` (everything), `finance` (claims, Coins, commissions, redemptions), `support` (users, claims, redemptions), `content` (firms, offers, banners, pages, news). The owner assigns roles.
- Every create, edit, delete and approval is written to `audit_log` with who, when, before and after.
- Lists have search, filters, sort, pagination and CSV export. Bulk actions where useful.
- Anything public has **draft / scheduled / published / archived** status, with start and end dates, and a **Preview** button that opens the public page as visitors will see it.
- Image uploads: drag and drop, automatic resize and WebP conversion, alt text required, stored in the `public-assets` bucket.
- Deleting public content is a soft delete (archive). Coins, claims and ledger rows are never deleted.
- Mobile-usable, so the owner can approve claims from a phone.
- Admin sessions require two-factor authentication.

## 1. Dashboard (home)

Today at a glance: pending claims (with oldest waiting time), pending redemptions, new sign-ups, active users, Coins pending and available, coin liability ratio, low voucher stock, failed jobs, and the latest audit entries. Each card links to its queue.

## 2. Brand and appearance

- **Brand:** site name, promo code, tagline, logo (light and dark), favicon and app icon, social share image, social links, support email and Telegram. Overrides the defaults in `src/config/brand.ts`.
- **Theme:** colour pickers for background, surface, text, primary accent, Coin/gold accent, success, warning and danger, with a live preview of buttons, cards and a Coin badge. A contrast checker blocks saving colours that fail WCAG AA. Choose heading and body font from a fixed list of 6 loaded fonts. Corner style (sharp, soft, round). Save named themes and switch between them; "Reset to default".
- **Seasonal themes:** schedule a theme for a date range (e.g. Black Friday, a season launch). It switches back automatically.
- Implementation: theme values are CSS variables written into the root layout from the database and cached; changes go live within a minute without a redeploy.

## 3. Homepage and navigation

- **Homepage sections:** reorder, show or hide each section (hero, best deals, how it works, Coin calculator, Guardian preview, journal preview, payout feed, levels, FAQ, disclosure). Edit the hero headline, subheadline, button text and background image.
- **Navigation:** header menu, mobile tab bar labels, and footer links.
- **FAQ editor** with drag-to-reorder.

## 4. Banners, announcements and breaking offers

- **Announcement bar** (top of every page): text, link, colour, dismissible or not, schedule, target pages.
- **Breaking offer ticker:** a scrolling or rotating strip of live deals ("FirmX 40% off + 90% back, ends Sunday"). Items pull from active offers or are written by hand. Each item shows its real end date. A countdown is allowed only when it shows the offer's true end time and never resets.
- **Hero and page banners:** image (desktop and mobile versions), headline, button, link, placement (home hero, deals page, firm page, dashboard, rewards page), schedule, audience (everyone, signed in, signed out, level, country), priority.
- **Pop-up / modal:** one at a time, with frequency limit (e.g. once per user per campaign). Never on first page load for new visitors.
- **Sponsored banners** carry a forced "Sponsored" label that can't be removed (rule §2.7).
- Click and view counts on every banner.

## 5. Prop firms and programs

- **Firm:** name, slug, logo, cover image, brand colour, short and long description, country, year founded, platforms, asset classes, website link, affiliate tracking link template, our promo code, commission rate, rebate permission (yes/no with evidence file), status (active, watch, delisted) with a public note, featured flag, display order.
- **Programs:** account sizes, steps, price, profit target, daily loss, max loss, drawdown type, profit split, payout frequency, minimum days, consistency rule, news rule, weekend holding, EA allowed, refund policy. "Duplicate program" for quick entry.
- **Price history** recorded automatically on price change.
- **Change history:** log rule or price changes with a source link; they appear on the firm page and trigger alerts to users holding that firm.
- **Firm sorting** on public pages never uses commission or sponsorship (rule §2.7).

## 6. Offers and promo codes

- **Offers:** firm, programs covered, title, details, discount %, promo code, start and end, exclusive flag, banner image, terms. Shown on deals page, firm page, ticker and alerts.
- **Our promo codes per firm** (the code users enter at checkout), with notes on where each is valid.
- **Site promo codes** for our own platform: e.g. a sign-up code that gives XP or a booster, or a Pro trial code. Settings: code, reward (XP, booster, Pro days; never Coins unless funded by a campaign budget), max uses, per-user limit, dates, country limits. Usage report.
- **Coupon notifications:** when an offer is published, choose whether to notify watchers by Telegram, push and email.

## 7. Purchase claims (manual review)

Users upload proof of purchase: screenshot or PDF of the receipt, order ID, firm, program, amount paid, checkout email.

Review screen:
- Receipt viewer with zoom, beside the claim details and the user's history (past claims, rejections, risk score, linked accounts).
- **Automatic checks shown to the reviewer:** duplicate order ID, same image already uploaded (hash match), order date outside the allowed window, amount not matching the program price, promo code not visible, too many claims recently, matching commission found in imported reports (yes/no).
- Actions: **Approve** (Coins credited as *pending*), **Reject** with a reason from a list plus a note (the user sees it), **Ask for more info** (the user gets a message and can reply), **Flag for fraud**.
- **Coins after approval:** pending until the firm's commission report confirms the sale and the hold period passes, then released automatically. The owner can choose "release on approval" per firm only when that firm doesn't provide reports; those Coins come from a capped campaign budget. *Why: screenshots are easy to fake; matching with the firm's report protects the business.*
- Keyboard shortcuts and a "next claim" button for fast review. Target: decide within 24 hours; the queue shows waiting time.

## 8. Commissions

CSV import per firm with saved column mapping; statuses reported, confirmed, paid, clawed back; automatic matching to claims; reconciliation report showing claims without commission and commission without claims. Server-to-server postbacks in Phase 3.

## 9. Users

- Search by name, email, ID, referral code, order ID.
- **User profile:** details, country, level, XP, Coin balance (available, pending, spent), full ledger, claims, redemptions, referrals, streaks, Pro status, devices and IP history (hashed), risk score, linked accounts, notes from staff.
- **Actions:**
  - **Add or remove Coins:** amount, reason (required, from a list plus a note), visible note to the user optional. Written to the ledger as an adjustment; never edits a balance directly. Adjustments above a set amount need a second admin's approval (or a confirmation step while there is one admin).
  - **Add or remove XP**, grant a badge or booster, grant Pro days.
  - **Freeze rewards** (can use the site, can't claim or redeem), **suspend** (can't sign in, with a message), **ban** (permanent, with reason), and **unban**. Banned users' pending Coins are frozen, not deleted.
  - Reset streak, send a message, export or delete their data on request.
- Every action requires a reason and is audit-logged.

## 10. Shop (rewards)

- **Shop items:** type (free challenge voucher, discount voucher, booster, Pro membership, merchandise, donation), name, image, description, Coin price, firm and program, stock count or "unlimited", per-user limit, level required, countries, dates, featured flag, display order.
- **Voucher codes:** upload codes in bulk (CSV or paste), encrypted at rest, expiry dates, low-stock alert threshold.
- **Redemptions queue:** pending, fulfilled, cancelled (Coins refunded through the ledger), with target timer, and a button to send the code manually.
- **Merchandise** (when enabled): shipping address capture, status (ordered, shipped with tracking, delivered).

## 11. Lucky draw and spin wheel

Built behind a feature flag that is off by default; turned on per country after legal review (rule §2.9).

- **Spin wheel:** prizes (XP, booster, streak freeze, draw ticket, rarely a voucher from a funded budget), odds per prize (must add up to 100%, shown publicly), daily spin limit, budget cap per prize.
- **Lucky draw:** title, prize (firm-donated voucher), entry methods (free: check-in streak, missions, journal streak; never purchases), entries per user cap, start and end, countries, draw button that uses a server-side random generator and records the result, winners list published on the site, winner notification.
- Full audit table of every spin and draw.

## 12. Economy settings

Give-back rates by level, Founding Season, caps, hold period, XP table, level thresholds, boosters, campaign budgets with auto-stop, Coin expiry, Pro prices. Each save creates a new version and shows its effect on a sample purchase before saving.

## 13. Engagement content

Missions, badges (image upload), seasons (banner, theme, dates), leaderboards, lessons and quizzes, polls, share card templates, onboarding steps.

## 14. Breaking news and market data

- **Breaking news posts:** short posts for firm news (rule changes, closures, payout problems, new firms) and platform news. Title, body, firm link, severity (info, important, urgent), push to Telegram and app. Urgent posts can show in the announcement bar.
- **Economic calendar:** provider status, last sync, manual override of an event (e.g. mark rescheduled), and test-send an alert. Data comes from a licensed provider, never copied from another site.
- **Firm news rules** per program (used for news-window alerts).
- **Holidays** table.
- **Price data:** provider status, last daily-bar import, pairs list shown in correlation and volatility tools.
- **Partner tools page:** recommended tools with affiliate links, category, description and order (labelled as affiliate links).

## 15. Content pages and SEO

- Page editor (rich text with images) for about, how it works, how we make money, disclosures, terms, privacy, rewards terms, blog and guides. Draft and publish, with version history.
- **SEO per page:** title, description, share image, canonical URL, noindex. Redirects manager. Sitemap regenerates automatically.
- **Legal pages** show "Last updated" and keep previous versions.

## 16. Notifications and messages

- Send an announcement to a segment (all, level, country, Pro, inactive 14+ days, holds firm X) by in-app, email, Telegram and push, with preview, test-send and schedule. Promotional messages only go to users who opted in.
- Edit email and Telegram message templates (with placeholders such as name, Coins, firm).
- Delivery report: sent, opened, clicked, unsubscribed.

## 17. Moderation

Reviews and firm replies, payout and milestone proofs, change reports, user display names and avatars. Approve, reject with reason, or hide.

## 18. Fraud console

Risk scores, linked-account clusters (shared device, IP, checkout email, receipt), claim velocity, refund-after-reward cases, freeze and unfreeze, and a blocklist (emails, domains, devices).

## 19. Sponsorships

Sponsored slots, dates, price, firm, placement and performance. The "Sponsored" label is forced.

## 20. Settings

Feature flags; geo rules by country; maintenance mode with a message; sign-up open or closed (waitlist mode); integrations status (email, Telegram bot, calendar provider, price provider, payments) with test buttons; admin users and roles; two-factor enforcement.

## 21. Reports

- **Finance:** commission reported, confirmed, paid, clawed back; Coins pending, available, spent, expired; coin liability ratio with alert above 1.0; redemption cost; Pro revenue; margin per firm.
- **Growth:** sign-ups by source and campaign, day 1/7/30 retention, check-in and journal activity, claim funnel, repeat-purchase rate, top firms, banner and offer clicks.
- Export any report to CSV.

## 22. Owner alerts on Telegram

Coin liability ratio above limit, claim queue older than 24 hours, redemption target missed, claim spike, low voucher stock, failed calendar or price sync, failed scheduled jobs, large Coin adjustment, new admin login from a new device.

## 23. Support inbox

Tickets from the "Get help" form, assigned to staff, with status (open, waiting on user, resolved), priority, linked claim or redemption, saved replies, internal notes, and response-time targets. Help centre article editor. Changelog editor.

## 24. Claim appeals

Queue of appealed claims with the original decision, the new evidence and the first reviewer's note. Decided by a different admin when there is more than one.

## 25. Data requests

Export and deletion requests with due dates, status, and a button to run them. Deletion keeps ledger and claim rows with personal fields removed (`18-data-and-operations.md` §9).

## 26. View as user (read-only)

Support staff can open a read-only view of a user's dashboard, wallet, claims and redemptions to help them. Journal content stays hidden unless the user has granted support access. Every view is audit-logged and the user can see a list of staff access in Settings.

## 27. System health

Scheduled job runs and errors, calendar and price sync status, email delivery stats, database and storage size, storage use per user (top 50), backup status and last restore test date, error-tracking link.

## 28. Bulk tools

CSV import for firms, programs, offers and voucher codes with a preview and error report; CSV import of previous PropFirmKarma users (`18-data-and-operations.md` §11); bulk Coin grants for a campaign (one reason, capped by the campaign budget, preview before running).

## 29. Feature rollout

Feature flags with percentage rollout and per-user overrides, so a new feature can be tested with a few users first.

## 30. Partners (Phase 3)

- **Firm partner accounts:** a firm logs in to a limited portal to update its own offers and programs (each change goes to admin approval), reply to reviews, upload voucher codes and see anonymised click and claim counts. They never see user identities or affect rankings.
- **Creators:** personal codes, landing pages, referred users and revenue share (inside the give-back cap), monthly statements.
