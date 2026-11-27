---
version: 1
slug: "src-app-public-page-tsx"
primary_target: "src/app/(public)/page.tsx"
related_targets: ["src/app/(market)/deals/page.tsx","src/app/(public)/firms/page.tsx","src/app/(app)/(shell)/today/page.tsx","src/app/(app)/(shell)/rewards/page.tsx","src/app/(app)/(shell)/accounts/page.tsx","src/app/(public)/tools/page.tsx"]
---

# Fundback product world: Item Cards (all surfaces)

Mode: Persuade for `/` and the public deal pages; Operate for Today, Rewards, Accounts, tools and admin, which inherit the world with more restraint. Replaces the "Signed Ledger" world (redesign requested by the owner, 22 Nov 2026). Evolved on 23 Nov 2026 into "Arcade Night" (owner asked for a much more colourful, gamified UI with no plain black background, using propfirmmatch.com, FTMO, FundingPips, FundedNext, E8, The5ers and Alpha Capital as craft references); Arcade Night replaces the Item Cards palette, type and buttons. DESIGN.md is the system of record.

Audience: prop-firm traders on a phone, sceptical and price-sensitive, who enjoy games. Job: find the lowest real price, buy through our code, return daily for streaks, XP and Coins. Owner answers: gamified feel strongest on firms/deals, Today/rewards, landing, tools/journal; keep all copy, numbers, page structure and URLs, and keep the theme dark: an indigo night lit by aurora, never plain black, with colour carrying areas and rarity (Arcade Night, 23 Nov 2026); must not feel casino-like or like a propfirmmatch.com clone. Constraints: CLAUDE.md §2 (no fake counts, no buy-pressure, sponsored labelled, honest copy, chance features off).

## Direction contract

THESIS: Every challenge is an item with a stat block, every deal a drop with a discount affix, Coins are gold spent in a rarity-tiered shop, and progress is an XP bar with a level badge. It refuses the category default of a glowing gradient hero over ranked cards with gradient buttons.

OWN-WORLD: Arcade Night. Indigo night ground #120C32 (deep #0D0929) under a fixed aurora (violet, cyan, pink, faint mint) and a faint 44px grid; never plain black. Top-lit panels #231858 into #1C1449, hairline #3D3086, text #F8F5FF, soft #D9D2F7, muted #ACA2DE. Brand beam violet #7B4DFF into pink #E0338F fills primary pill buttons and the active chip; brand and gold gradient frames mark key surfaces. Gold #FFC94A into #FF9D2E only on Coins, levels and rewards, and the gold button only for Coins actions. Rarity frames fixed by account size: common #A9ADCF, rare #4FA8FF, epic #C084FF, legendary #FF9A3C; XP beam violet into cyan. Each area owns a hue: Today violet, Deals pink, Rewards gold, Accounts cyan, Profile mint. State mint #3EF0B0, amber, red stay state. Archivo (wdth 112 heavy for display, normal for body), JetBrains Mono tabular for every figure; no gradient text. Item cards 23px radius with 2px rarity borders, rarity tab and glow; pill chips and buttons. Raises: every figure traces to its source (tensegrity); glow only where it means something (neon); claimed, expired, done and discounted items carry a printed stamp, not only colour (film bench); no fake presence, only your own activity is live (BBS).

STORY: Visitor sees real drops with stats and net price, understands we take a commission and return Coins, levels up by checking in and using tools, and spends Coins on items.

FIRST VIEWPORT: The owner pinned "Page structure and URLs" to stay, so each page keeps its first block and the world carries it. Landing, phone: headline with the share figure in gold mono, the letter paragraphs, and the waitlist form in a panel; desktop adds the Coins loot panel (gold frame, split bar) on the right. Firm directory and deals: title, asset and sort chips, then item cards, three columns on desktop. Signed-in screens: a header player bar (level badge, XP bar, Coin pill) on every screen; Today opens on the player card.

FORM: Item Cards, my list position 3 of 7, seed:3068f45d1e87d96c. Signature interaction: an item card lifts its rarity frame to a soft glow on focus or hover and the Get code button presses down; Coin and XP gains count up once.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
