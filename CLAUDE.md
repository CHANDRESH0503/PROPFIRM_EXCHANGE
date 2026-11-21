# CLAUDE.md — Prop Firm Rewards Platform

Working brand name: **Fundback** (not final, see §3). Owner: Venkat, a solo founder and full-stack developer.

This file is your brief. It explains what the product is, the rules that must always hold, what to build, and in what order. Read this file every session, and the spec files for the area you are working on. Where a rule has a reason, the reason is given so you can make good calls in cases this file does not cover.

---

## 1. The product in one page

**What it is.** A global web platform for prop-firm traders: people who pay a proprietary trading firm a fee (tens to hundreds of dollars) for a "challenge", a simulated trading evaluation that leads to a funded account and a share of profits if passed. Traders buy challenges repeatedly and usually hold accounts at several firms at once.

**What traders do here.**
1. Find the real lowest price for a challenge (discount code plus our rebate).
2. Buy through our affiliate link and code, then claim the purchase.
3. Earn Coins on every verified purchase and redeem them for free challenge accounts.
4. Track all their prop accounts and rule limits in one place.
5. Journal their trades and see which setups and mistakes make or lose money.
6. Use forex tools that know their firm's rules: lot size, daily room, economic calendar with news alerts on Telegram and push.
7. Come back daily for streaks, missions, levels, deal alerts and community events.
8. Optionally pay for Pro with Coins or cash.

**How it earns.** Firms pay us an affiliate commission (typically 10–25% of the fee) per purchase. We return most of it to the trader as Coins and keep the rest. Secondary income: Pro membership, labelled sponsored placements, firm-sponsored contests, and affiliate links for trading tools.

**Why users choose us.** Competitors already have comparison tables, points and firm scores. We win on four things. Judge every feature against them:
- **Most back:** the highest and clearest give-back.
- **Fastest reward:** Coins become an account in minutes, not weeks.
- **Useful every day:** a free journal, multi-account tracker, forex tools and news alerts that know each firm's rules.
- **Fun to return to:** a polished gamified loop that respects the user.

**Who the user is.** Mostly on a phone, often a mid-range Android on a slow connection. Price-sensitive and sceptical, because many prop firms have collapsed or denied payouts. Trust comes from clarity: exact numbers, visible statuses, no hype.

---

## 2. Rules that must always hold

These protect the business from fraud, legal trouble and loss of trust. If a request or an idea conflicts with one of them, stop and ask the owner.

1. **Coins are backed.** Redeemable Coins are minted only from (a) a share of a commission the firm has confirmed, or (b) a funded campaign budget with a hard cap. Check-ins, spins, missions and streaks never mint Coins; they pay XP and boosters. *Why: Coins cost real money. Unbacked Coins get farmed by bots and bankrupt the program.*
2. **Pending until confirmed.** Coins from a purchase are `pending` until the commission is confirmed and the hold period has passed. Only then are they `available`. Refunds and chargebacks reverse them.
3. **The ledger is append-only.** No UPDATE or DELETE on ledger rows. Corrections are new rows. Balances are derived from the ledger, never stored and edited. Every write carries a unique idempotency key. *Why: auditability, and a retried request must never credit twice.*
4. **Total give-back is capped.** For any purchase: user share + booster + referral bonus + creator share ≤ `max_total_giveback_bps` of the confirmed commission. Enforce this in the database function, not only in the UI.
5. **Never gamify buying.** No mission, streak, timer, leaderboard or draw may require a purchase, add time pressure to buy, or reward re-buying after a failed challenge. A purchase earns Coins and XP by flat published rules (earn rate and level thresholds), and that is the only purchase incentive. *Why: most challenges are failed and our revenue rises when traders re-buy. Pushing that harms users and invites regulators.*
6. **Nothing fake.** No invented reviews, testimonials, payout proofs, user counts, "someone just bought" toasts, or countdown timers that reset. Seed data uses obviously fictional firms flagged `is_sample`. Do not write real firms' prices, rules or commission rates from memory. The owner enters them in admin.
7. **Paid placement is labelled and never affects ranking.** Sponsored slots show a "Sponsored" label. Sort orders and scores never read commission rate or sponsorship.
8. **Honest copy.** Never "guaranteed", "risk-free", "easy money" or income promises. Say plainly that challenges are simulated evaluations, that most traders do not pass, and that we earn a commission. Every page with an outbound affiliate link shows the affiliate disclosure.
9. **Chance-based features start switched off.** Spins and draws sit behind a feature flag that defaults to off. They are free to enter, never tied to purchases, publish their odds, and respect a region exclusion list. *Why: chance plus a prize can be a regulated lottery. The owner turns them on per region after legal review.*
10. **Geo rules are enforced on the server.** Offers and outbound links are filtered by `geo_rules`. Seed rule: India blocks forex/CFD prop offers, because India's central bank warns against promoting unauthorised forex platforms. Adults only: 18+ confirmation at sign-up.
11. **No trading advice.** Tools help traders manage risk, follow rules and review their own trading. Never build signals, buy/sell calls, trade ideas, copy trading or market predictions, including in AI-written summaries. *Why: that is investment advice in many countries.*
12. **Rewards are non-cash.** Coins have no cash value and are non-transferable. One account per person. No cash-out, crypto payout or gift-card path.
13. **Privileged work stays on the server.** Row Level Security on every table, default deny. The service-role key is server-only. The client never writes balances, XP, claim status or redemption status.

---

## 3. Brand and configuration

The name is not final. Keep every brand string (name, promo code, tagline, domain, social handles) in `src/config/brand.ts` and nowhere else, so a rename is a one-file change.

- Working name `Fundback`, working promo code `FUNDBACK`, tagline "Get funded. Get more back."
- Currency names: **Coins** (redeemable) and **XP** (progress).

---

## 4. Stack and engineering conventions

**Fixed stack:** Next.js (App Router), TypeScript (strict), PostgreSQL on Supabase (Auth, RLS, Storage, cron, Edge Functions where useful), Tailwind CSS.

**Default choices:** shadcn/ui primitives, Zod at every input boundary, React Hook Form, Motion for animation, next-intl (English only at launch, all strings through it), Resend for email, Telegram Bot API, Cloudflare Turnstile, PostHog, Vitest and Playwright. Ask before adding any other paid service.

Follow the conventions of the versions actually installed. Check the docs for the installed Next.js, Tailwind and Supabase versions instead of assuming.

**Conventions**
- Money is integer minor units (`amount_cents`) with a currency code. Coins and XP are integers. Rates are basis points (`_bps`). No floats in economy code.
- Timestamps are `timestamptz` in UTC. Streak days use the user's stored IANA timezone.
- Anything that touches Coins, XP, claims or redemptions runs in a Postgres function called from the server (Server Action or Route Handler), one transaction per operation.
- Every table has RLS enabled with explicit policies. Users read their own rows, public catalogue tables are read-only to everyone, and admin access goes through role checks.
- Schema changes are migrations in `supabase/migrations/`. Never edit an applied migration. Regenerate DB types after each migration.
- Feature flags and economy numbers live in the database and are editable in admin, not in code.
- Server Components by default. Client Components only where there is interaction.
- Accessibility: WCAG AA, keyboard reachable, `prefers-reduced-motion` respected.
- Performance budget: LCP under 2.5 s on a mid-range Android over 4G. Public pages are statically rendered or cached where possible.
- Tests are required for economy maths, ledger functions, claim → confirm → release, redemption, streak day boundaries and the give-back cap. One Playwright flow covers sign-up → check-in → claim → admin confirm → redeem.

**Layout**

```
src/
  app/(public)/    marketing, firms, deals, tools, learn
  app/(app)/       signed-in area: today, wallet, rewards, accounts, missions, profile
  app/admin/       admin dashboard (role-gated)
  app/api/         webhooks, cron endpoints, Telegram bot
  components/      ui/ (primitives) and feature folders
  config/          brand.ts, nav.ts
  lib/             supabase/, economy/, geo/, notifications/, validation/
  messages/        en.json
supabase/
  migrations/  seed.sql  tests/
docs/              spec/, DECISIONS.md
```

**Commands** (create these scripts): `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm db:migrate`, `pnpm db:types`, `pnpm db:seed`. Run typecheck, lint and tests before calling any task done.

---

## 5. Detailed spec (read the file for the area you are working on)

| Area | File |
|---|---|
| Economy: Coins, XP, levels, boosters, redemption, worked examples | `docs/spec/05-economy.md` |
| Engagement: Today screen, streaks, missions, badges, seasons, referrals, spins | `docs/spec/06-engagement.md` |
| Features: public site, signed-in app, Guardian tracker | `docs/spec/07-features.md` |
| Notifications | `docs/spec/08-notifications.md` |
| Admin dashboard | `docs/spec/09-admin.md` |
| Data model, storage, scheduled jobs | `docs/spec/10-data-model.md` |
| Fraud and security | `docs/spec/11-fraud-security.md` |
| Design direction | `docs/spec/12-design.md` |
| SEO, sharing, analytics | `docs/spec/13-seo-analytics.md` |
| Build order and phase "done" criteria | `docs/spec/14-build-order.md` |
| Trading journal | `docs/spec/15-trading-journal.md` |
| Trader tools: calculators, economic calendar, news alerts, Telegram bot, MT5 tools | `docs/spec/16-trader-tools.md` |
| Pro membership (Coins or cash) | `docs/spec/17-pro-membership.md` |
| Data storage, journal privacy, backups, environments, monitoring, support and disputes | `docs/spec/18-data-and-operations.md` |

Before starting a task, read the spec files it touches. If a spec file and §2 disagree, §2 wins; tell the owner about the conflict.

---

## 6. How to work with the owner

- Start each phase with a short plan: the slices, the migrations and your open questions. From Phase 1 onward, wait for the owner's OK on the plan.
- Ask before: changing anything in §2 or `docs/spec/05-economy.md`, destructive schema changes, adding a paid service, writing final legal text, or switching on a flag that defaults to off.
- Decide yourself: component structure, naming, internal refactors, test layout. Record notable decisions in `docs/DECISIONS.md` with the date and the reason.
- Keep this file short. New detail goes in the matching `docs/spec/` file, not here.
- Update `docs/PROGRESS.md` at the end of every work session: what is done, what is next, known issues.
- If earlier prototype files are present (for example `PropFirmKarma_v4.jsx` or an old admin panel), use them as visual reference only. This brief replaces their data model and reward rules.
- When something is ambiguous and low-risk, choose the simplest option that serves the four advantages in §1 and note it. When it affects money, legal exposure or user trust, ask.
- Report plainly: what was built, what was not, and what is untested.

---

## 7. Decisions that belong to the owner

Do not decide these. Build so that each is a setting or a one-file change.

- Final name, domain and promo code.
- Legal entity and jurisdiction.
- Written rebate permission from each firm.
- Legal review of spins and draws, and of the India geo rule.
- Final legal text for terms, privacy and rewards terms.
- When the Founding Season starts and ends.
- Hosting, email sender domain and Telegram bot identity.
