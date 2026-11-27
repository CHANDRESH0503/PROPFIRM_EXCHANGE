---
name: Fundback
description: Arcade Night. An indigo night lit by aurora, where every challenge is an item card, colour names the place you are in, and gold is only ever Coins.
colors:
  ink: "#120c32"
  ink-deep: "#0d0929"
  surface: "#1c1449"
  surface-2: "#231858"
  raised: "#2c2068"
  hairline: "#3d3086"
  text: "#f8f5ff"
  text-soft: "#d9d2f7"
  muted: "#aca2de"
  brand: "#7b4dff"
  brand-2: "#e0338f"
  brand-deep: "#5a33e6"
  brand-deep-2: "#c22277"
  cyan: "#2fd6ff"
  pink: "#ff5fae"
  lime: "#c6f432"
  violet: "#b094ff"
  gold: "#ffc94a"
  gold-2: "#ff9d2e"
  gold-soft: "#ffc94a24"
  common: "#a9adcf"
  rare: "#4fa8ff"
  epic: "#c084ff"
  legendary: "#ff9a3c"
  xp: "#8b5cff"
  xp-2: "#2fd6ff"
  positive: "#3ef0b0"
  caution: "#ffc24a"
  danger: "#ff5c7a"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 3.6rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.025em"
    fontVariation: "\"wdth\" 112"
  headline:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontVariation: "\"wdth\" 112"
  title:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.025em"
    fontVariation: "\"wdth\" 112"
  item-title:
    fontFamily: "Archivo, ui-sans-serif, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.25
    fontVariation: "\"wdth\" 108"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    fontFeature: "\"cv11\", \"ss01\""
  body-small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.4
  tag:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "0.14em"
  figure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\", \"zero\""
rounded:
  sm: "7px"
  md: "10.5px"
  lg: "14px"
  xl: "18.6px"
  2xl: "23.2px"
  3xl: "24px"
  pill: "9999px"
spacing:
  gutter-phone: "20px"
  gutter-desktop: "32px"
  panel: "20px"
  panel-wide: "24px"
  section-app: "40px"
  section-public: "80px"
  section-public-wide: "96px"
components:
  button-primary:
    backgroundColor: "{colors.brand-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
    typography: "{typography.label}"
  button-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "#7b4dff1f"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "#7b4dff38"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.pill}"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "#7b4dff26"
    textColor: "{colors.text}"
  button-danger:
    backgroundColor: "#ff5c7a1f"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    height: "44px"
  input:
    backgroundColor: "#0d092999"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "48px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  item-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "24px 16px 16px"
  chip:
    backgroundColor: "#1c1449b3"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.brand-deep}"
    textColor: "#ffffff"
  coin-amount:
    textColor: "{colors.gold}"
    typography: "{typography.figure}"
  xp-pill:
    backgroundColor: "{colors.xp}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  tab-bar-item:
    textColor: "{colors.muted}"
    height: "56px"
---

# Design System: Fundback

## Overview

**Creative North Star: "Arcade Night"**

Fundback is a game hall at night that keeps honest books. The ground is an indigo night, never black, lit from behind by a fixed aurora (violet top left, cyan top right, pink bottom right, a faint mint bottom left) over a faint 44px chart grid that fades out down the page. On that night sit lit panels and item cards: every challenge is an item with a rarity frame and a stat block, every deal is a drop with a stamped discount affix, Coins are gold loot, and progress is an XP beam beside a hexagonal level badge. Colour is plentiful, but every colour has a job: the violet-to-pink beam means "the main thing to do", gold means Coins, rarity means account size, each area of the product owns one hue, and green, amber and red mean state.

This record replaces the "Signed Ledger" world (ink #0b0d10, Sora and Inter, paper-on-ink buttons, gold-only colour, flat and gradient-free). It was replaced first by "Item Cards" (22 Nov 2026) and then, on 23 Nov 2026, the owner asked for a much more colourful, gamified UI with no plain black background, taking craft cues from prop-firm sites (propfirmmatch.com, FTMO, FundingPips, FundedNext, E8, The5ers, Alpha Capital). Arcade Night is that evolution of Item Cards; the item card, rarity, stat block and stamp devices carry over, the palette, type and buttons do not.

The system is dark-only and themeable by variable: every component reads the CSS custom properties on `:root` in `src/app/globals.css`, so a theme saved in admin (09-admin.md §2) restyles the product with no rebuild. Density is phone-first: 20px gutters, 44px minimum touch targets, 48px inputs, 56px bottom tabs.

**Key Characteristics:**
- Indigo night with an aurora and a faint grid behind every page; never plain black.
- The brand beam (violet into hot pink) marks the primary action, the active chip and the brand mark.
- Gold means Coins, levels and rewards; the gold button is only for Coins actions.
- Rarity frames are fixed by account size, never by commission or sponsorship.
- Each area owns a hue: Today violet, Deals pink, Rewards gold, Accounts cyan, Profile mint.
- Archivo at a wide stretch for display, Archivo for body, JetBrains Mono tabular for every figure.
- Lit panels with soft, coloured glows; no gradient text, no fake counts or presence.

## Colors

A saturated night palette: indigo neutrals, one violet-to-pink brand beam, a gold reward pair, four rarity hues, an XP beam, area accents and three state signals.

### Primary
- **Violet Beam** (brand) into **Hot Pink Beam** (brand-2): the brand gradient. Its deep pair (brand-deep, brand-deep-2) fills primary buttons, the active filter chip, the public header's "Open app" pill and the directory title tile; the bright pair draws the brand mark and the brand frame border. Violet also tints secondary and ghost buttons, hover fills on links and chips, and text selection (55%).

### Secondary
- **Coin Gold** (gold) into **Ember Orange** (gold-2): Coins and levels. Coin figures and the Coin glyph, the level badge, the level name on Today, the wallet pill in the player bar, the reward-goal bar, the gold button, the gold frame around the Coins example and the reward goal, and the give-back figure in the landing headline. **Gold Wash** (gold-soft) backs Coin pills ("Earn about N Coins back").

### Tertiary
- **Rarity hues**: **Common Pewter** (common), **Rare Blue** (rare), **Epic Orchid** (epic), **Legendary Flame** (legendary). The 2px item-card border, the wash across the card top, its glow and the rarity tab.
- **XP Beam**: **XP Violet** (xp) into **XP Cyan** (xp-2), for XP bars and the "+N XP" pills.
- **Area accents**: **Arcade Cyan** (cyan) is also the focus ring, the input caret and link colour; **Arcade Pink** (pink) is Deals and the discount affix; **Arcade Violet** (violet, #b094ff) is the readable violet for text and icons (Today's tab, accent cycles); the XP violet #8b5cff is only a fill. **Arcade Lime** (lime) is a decorative accent in icon cycles, the stat block's split cell and the tools fact chip.

### Neutral
- **Indigo Night** (ink): page ground (with a vertical deepening to #160e3c mid-page), the theme-color meta.
- **Deep Night** (ink-deep): sticky headers and the bottom tab bar (80–95% with backdrop blur), input fills, recessed tracks.
- **Surface** (surface) and **Surface Lift** (surface-2): the top-lit panel gradient (surface-2 at the top edge into surface).
- **Raised** (raised): popovers, skeletons, scrollbar thumb.
- **Hairline** (hairline): every border and divider.
- **Star White** (text), **Lilac Mist** (text-soft) for reading text and labels, **Dusk Lilac** (muted) for hints, inactive tabs and pending Coins.

### State
- **Mint** (positive), **Amber** (caution), **Breach Red** (danger): safe, caution and breach; success and error; a cleared mission and its DONE stamp; a check-in day on the calendar.

### Named Rules
**The Never Black Rule.** The ground is Indigo Night with the aurora and grid behind it. No page, section or panel sits on #000 or a neutral grey.

**The Gold Means Coins Rule.** Gold appears only on Coins, levels and rewards. The gold button is only for Coins actions (redeem, claim, spend, browse rewards). Never gold for links, headings, navigation or general emphasis.

**The Rarity Is Size Rule.** An item's rarity frame and tab come from its account size alone (`rarityFor(account_size)`), never from commission rate, sponsorship or any paid placement (CLAUDE.md §2.7). A rarity frame is never used on anything that is not an item.

**The Area Hue Rule.** Each area owns one hue, carried by its tab and its title tile: Today violet (violet), Deals pink, Rewards gold, Accounts cyan, Profile mint (positive). Within lists, icon tiles cycle the accent hues (cyan, pink, violet, lime) so neighbours never match. Gold, the state colours and the rarity colours are left out of every cycle; a cleared quest turns mint because cleared is a state.

**The State Rule.** Green, amber and red describe the state of something. Mint's one second job is Profile's area hue; red and amber have none.

**The Variables Only Rule.** Components read `var(--brand)`, `var(--gold)` and the rest, or their Tailwind mappings. Literal hex lives in `globals.css` and in the few places that cannot read CSS (the `themeColor` meta, the global error fallback, email templates).

## Typography

**Display Font:** Archivo with the width axis (fallback ui-sans-serif), stretched to 112% for h1 to h4
**Body Font:** Archivo at normal width, with `cv11` and `ss01`
**Figure Font:** JetBrains Mono (fallback ui-monospace), tabular with slashed zero; not preloaded

**Character:** One family doing two voices. Stretched and heavy, Archivo reads like an arcade marquee; at normal width it reads plainly. Mono turns every number into a checkable fact.

### Hierarchy
- **Display** (800, 2.25rem phone, 3rem sm, 3.6rem lg, line-height 1.02, max 15ch): the landing headline only. Its key figure switches to Mono 900 in gold.
- **Headline** (800, 1.875rem to 2.25rem): page titles on the directories (led by a title tile), and public section headings (1.5rem to 1.875rem).
- **Title** (800, 1.25rem): section headings inside the signed-in app and panel headings.
- **Item title** (800, 1.125rem, width 108%): the firm name on an item card.
- **Body** (400, 1rem, line-height 1.65; 1.125rem from sm on the landing letter): reading text in Lilac Mist, held to 60–65ch.
- **Body Small** (400, 0.875rem): hints, item subtitles, empty-state bodies.
- **Label** (700, 0.9375rem): button text; chips and tabs run 600 at 0.875rem, bottom-tab labels at 0.6875rem.
- **Tag** (900, 0.625rem, 0.14em tracking, uppercase): only the rarity tab, the loot-card tab and the rotated DONE stamp. Stat-block labels use the same idea at 700 and 0.1em.
- **Figure** (Mono, tabular): every price, Coin amount, XP count, rate, code and date figure. Prices on item cards run 1.65rem at 900.

### Named Rules
**The Every Figure Is Mono Rule.** Money, Coins, XP, percentages and codes are JetBrains Mono with the `tabular` utility. A figure in Archivo is a bug.

**The Solid Type Rule.** Text is filled with a solid colour. Gradients fill buttons, bars, badges and frames, never letters.

## Layout

Single column first. Gutters are 20px on phones and 32px from 640px. Public pages and the signed-in app share a 72rem container (max-w-6xl). The landing page sets the letter in a 60ch column beside a sticky Coins loot card from 1024px; the directories run item cards in one column, two from 768px, three from 1280px, with 24–28px between rows so the rarity tabs clear the card above.

The signed-in app has a sticky Deep Night header (56px, 64px from 768px) with the wordmark, the desktop tabs and the player bar (level badge with a small XP bar, and the Coin pill). On phones navigation is a fixed bottom tab bar (five 56px targets, safe-area aware); focus scrolling keeps clear of it.

Rhythm: 40px between sections in the app, 80–96px between public sections, 20–24px inside panels, 10px between quest rows.

## Elevation & Depth

Layered and lit. Panels are lifted off the night by a top-edge highlight (an inset 1px white at 6%), a surface gradient that is lighter at the top, and a soft shadow that falls below. Meaningful surfaces add coloured light: the brand frame glows pink, the gold frame glows orange, an item card glows in its rarity hue, buttons glow in their beam colour, and soft radial light sources sit behind the player card and the closing panel.

### Shadow Vocabulary
- **Panel** (`--shadow-panel`: `0 10px 30px -14px rgb(5 2 20 / 0.8)`, plus `inset 0 1px 0 rgb(255 255 255 / 0.06)`): every panel and card.
- **Overlay** (`--shadow-overlay`: `0 16px 40px -10px rgb(5 2 20 / 0.75), 0 2px 8px rgb(5 2 20 / 0.5)`): sheets and floating layers.
- **Brand frame glow** (`0 18px 44px -18px rgb(224 51 143 / 0.55)`) and **Gold frame glow** (`0 18px 44px -18px rgb(255 157 46 / 0.5)`).
- **Rarity glow** (`0 14px 34px -18px` in the rarity hue at 70%, 90% on hover).
- **Beam button glow** (`0 8px 22px -8px rgb(194 34 119 / 0.75)` with a top highlight and a 2px bottom inner shade); it tightens to 2px on press.

### Named Rules
**The Glow Means Something Rule.** Coloured light comes from meaning: the brand action, Coins, an item's rarity, an area's hue. Neutral panels cast only the dark panel shadow.

**The Frames Are Few Rule.** Brand and gold frames mark a screen's key surfaces (Today: the player card and the reward goal; landing: the waitlist form, the loot card, the drops and the closing reply). Everything else is a plain panel.

## Shapes

Round and friendly. One radius root (`--radius`, 0.875rem) drives the scale. Every button, chip, tab, pill and badge is a full pill; inputs and small tiles use 18.6px (xl); panels, item cards and icon tiles use 23px (2xl); the hero panels (player card, frames, quest log) use 24px. Borders are 1px hairline, 1.5px on brand and gold frames, 2px on item cards. Two shapes break the curve on purpose: the hexagonal level badge, and the rotated stamps (the dashed pink discount affix at -3°, the DONE stamp at -6°).

## Components

### Buttons
Glossy and pressable; every size is a pill.
- **Primary:** the brand beam (brand-deep into brand-deep-2 at 135°), white bold text, 44px tall (48px large, 36px small for dense tables only), pink glow; hover brightens 10%, press drops 1px into a tighter shadow.
- **Gold:** the gold beam with Indigo Night text. Only for Coins actions.
- **Secondary:** violet tint (brand at 12%) with a violet border at 45%; 22% and 80% on hover.
- **Ghost:** Lilac Mist text, violet 15% fill on hover. **Danger:** red at 12% with a red border. **Link:** cyan with a cyan underline at 40%.
- **Focus:** 2px cyan ring offset 2px from the night. **Pending:** inline spinner and `aria-busy`. Transitions 150ms on the expo ease-out.

### Chips
- **Filter chip:** 44px pill, surface at 70% with a hairline border, Lilac Mist text; active fills with the brand beam and white text. Sort chips are the 36px size.
- **Fact chip (landing):** a pill tinted with its hue at 12%, a round icon tile inside; each states a real value from config or the tool registry, never an invented count.
- **XP pill:** the XP beam with Indigo Night Mono text ("+20 XP"). **Coin pill:** Gold Wash with a gold border.

### Cards / Containers
- **Panel:** 23px radius, top-lit surface gradient, hairline border, panel shadow, 20px padding (24px from 640px). Ruled lists inside a panel split rows with hairlines.
- **Brand frame:** a 1.5px violet-pink-orange gradient border around the panel fill; for the main action surface on a screen.
- **Gold frame:** the same with gold into orange into pink; for Coins and rewards.

### Inputs / Fields
- **Style:** 48px, Deep Night at 60%, hairline border, 18.6px radius, 16px text.
- **Hover / Focus:** violet border on hover; on focus a cyan border and a cyan ring. **Error:** red border and red ring at 25%.
- Selects are native, styled like the input; the compare checkbox is native with a violet accent colour.

### Navigation
- **Phone:** fixed bottom bar on Deep Night at 95% with a top hairline; the active tab turns its area hue and gains a pill-shaped hue wash with a glow behind the icon.
- **Desktop:** header tabs are 40px pills with the icon in the area hue; the active tab takes a hue border and a hue wash.
- **Public header:** wordmark, text links as pills, and a brand-beam "Open app" pill.

### Item Card (signature)
A challenge as an item. A 2px rarity border, a radial wash of the rarity hue across the top, a rarity glow beneath; it lifts 4px with a brighter glow on hover or focus within. A rarity tab sits on the top edge (gem, rarity word, size). Inside: the firm name, a one-line program summary, a four-cell stat block (target, daily, max, split: each cell tinted in its own hue with a Mono value), the checkout price in large Mono with the list price struck through, the net price, a Coin pill when Coins apply, and the deal action at the foot.

### Level Badge and XP Bar (signature)
A gold hexagon with the tier number in heavy Archivo, glowing orange. The XP bar is a recessed Deep Night track with a violet-to-cyan beam and a top highlight, filling over 700ms on the expo ease-out; the gold tone measures progress toward a reward in Coins.

### Title Tile
A 44px rounded tile tinted with the area hue (20% fill, 55% border, hue glow) leading each page title, so the tile tells you where you are.

### Streak Flame
Outline in Dusk Lilac until the day's check-in; lit, it burns pink into flame with a pink glow.

### Stamps
Status that must not rely on colour alone is printed: the rotated dashed discount affix on a deal, the rotated DONE stamp on a cleared quest.

## Do's and Don'ts

### Do:
- **Do** keep the night indigo with the aurora and grid layers behind it, on every page.
- **Do** use the brand beam for the one main action, and the gold button only for Coins actions.
- **Do** derive rarity from account size only, and show it with the frame, tab and gem.
- **Do** give each area its hue on its tab and title tile, and cycle hues across list tiles, leaving gold out.
- **Do** set every figure in JetBrains Mono with the `tabular` utility.
- **Do** print status as a stamp or word as well as a colour.
- **Do** keep touch targets at 44px or larger (inputs 48px, bottom tabs 56px).
- **Do** keep control motion to 150–200ms on the expo ease-out; bar fills run 700ms; all of it collapses under `prefers-reduced-motion`.
- **Do** read every colour, radius and font from the variables in `globals.css`.

### Don't:
- **Don't** use plain black or neutral grey grounds.
- **Don't** use gold for anything except Coins, levels and rewards.
- **Don't** let commission, sponsorship or paid placement change a rarity, frame, glow or order.
- **Don't** fill text with a gradient.
- **Don't** show invented counts, live presence, "someone just bought" activity or resetting timers; the only live activity is the member's own.
- **Don't** use green, amber or red as decoration or a call to action.
- **Don't** frame ordinary panels; frames are for the key brand and Coins surfaces.
- **Don't** hard-code hex values in components.
