# Product

<!-- impeccable:product-schema 1 -->

Derived from `CLAUDE.md` and `docs/spec/` with the owner's approval (21 Nov 2026). Those files remain the authority; this is the design-facing summary.

## Platform

web

## Stack

Next.js (App Router) + TypeScript strict, Supabase (Postgres, Auth, Storage), Tailwind CSS, shadcn/ui primitives. Self-hosted on the owner's VPS behind Cloudflare (owner decision, 21 Nov 2026).

## Users

Prop-firm traders: people who pay a proprietary trading firm tens to hundreds of dollars for a simulated "challenge" that can lead to a funded account. They buy challenges repeatedly and usually hold accounts at several firms at once. Mostly on a phone, often a mid-range Android on a slow connection. Price-sensitive and sceptical, because many prop firms have collapsed or denied payouts.

Secondary: the owner and a small staff (roles owner, finance, support, content) who run the catalogue, review claims and fulfil rewards, often from a phone.

## Product Purpose

Help traders pay less for challenges and stay inside their firms' rules. They find the real lowest price (discount code plus rebate), buy through the affiliate link, claim the purchase and earn Coins backed by the confirmed commission, then redeem Coins for free challenge accounts. A free journal, a multi-account rule tracker (Guardian) and forex tools that know each firm's rules bring them back daily.

Success: a trader trusts the numbers enough to buy through us, gets a reward in minutes rather than weeks, and opens the app most days for reasons that have nothing to do with buying.

## Positioning

Competitors already have comparison tables, points and firm scores. Fundback wins on four things, and every feature is judged against them:

- **Most back:** the highest and clearest give-back.
- **Fastest reward:** Coins become an account in minutes, not weeks.
- **Useful every day:** a free journal, multi-account tracker, forex tools and news alerts that know each firm's rules.
- **Fun to return to:** a polished game loop that respects the user and never pushes buying.

## Operating Context

- A trader checks prices before buying, copies a code, buys on the firm's site in another tab, then returns to claim with an order reference and receipt.
- Daily: a check-in, three missions, risk rings on tracked accounts, the economic calendar before trading sessions, journalling after trades.
- Alerts arrive by email, Telegram and later web push. Trading happens on MT4/MT5 and firm dashboards, never here.
- Staff review claims and match commission CSVs from affiliate dashboards.

## Capabilities and Constraints

- Two currencies: **Coins** (redeemable, backed only by confirmed commission or a capped campaign budget) and **XP** (progress, levels). Engagement never mints Coins.
- Coins are `pending` until the commission is confirmed and the hold period has passed. The ledger is append-only.
- Never gamify buying: no mission, streak, timer, leaderboard or draw requires or pushes a purchase.
- No trading advice: no signals, buy/sell calls, predictions or copy trading.
- Sponsored placement is labelled and never affects ranking. Affiliate disclosure on every page with an outbound link.
- Chance features (spins, draws) are built behind flags that stay off. Geo rules are enforced on the server (India: no forex/CFD prop offers). Adults only, 18+.
- Undecided: the final name (working name Fundback, code FUNDBACK), domain, legal entity, Founding Season dates, and final legal text. All brand strings live in `src/config/brand.ts`.

## Brand Commitments

- Honest copy: never "guaranteed", "risk-free", "easy money" or income promises. Say plainly that challenges are simulated evaluations, that most traders do not pass, and that we earn a commission.
- Exact numbers and visible statuses over hype. Trust comes from clarity.
- Currency names: Coins and XP. Tagline (working): "Get funded. Get more back."

## Evidence on Hand

None yet: no users, reviews, payout proofs or firm partnerships. Do not invent testimonials, user counts, "someone just bought" toasts, payout proofs or resetting countdowns. Seed data uses obviously fictional firms flagged `is_sample`. Real firm prices, rules and commission rates are entered by the owner in admin, never written from memory.

## Product Principles

1. Exact over exciting: every number shown can be traced to a rule or a ledger row.
2. Rewards are earned by verified events, never by pressure to spend.
3. Useful without buying: everything daily works for a trader who never buys through us.
4. Phone first, slow network first.
5. Every state is designed: pending, empty, loading, error and refused are first-class screens.

## Accessibility & Inclusion

WCAG 2.2 AA, keyboard reachable, 44 px touch targets, `prefers-reduced-motion` respected, no hover-only information. LCP under 2.5 s on a mid-range Android over 4G.
