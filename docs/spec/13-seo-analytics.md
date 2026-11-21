# 13. SEO, sharing and analytics

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.


- Static, indexable pages for firms, programs, comparisons, deals, tools, lessons and glossary. Metadata, canonical URLs, sitemap, JSON-LD (Organization, FAQ, Breadcrumb).
- Firm-versus-firm comparison pages generated only from catalogue data that exists.
- An `llms.txt` describing the site and its methodology pages.
- Open Graph images generated per firm, deal and share card.
- PostHog events: `signup`, `checkin`, `mission_completed`, `outbound_click`, `claim_submitted`, `claim_confirmed`, `coins_released`, `redemption_requested`, `redemption_fulfilled`, `account_added`, `lesson_completed`, `referral_converted`. Respect cookie consent.

