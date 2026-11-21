---
name: Fundback
description: Dark, candid fintech with a game inside it. Exact figures, hairline structure, gold only where Coins are.
colors:
  ink: "#0b0d10"
  surface: "#14171c"
  raised: "#1c2026"
  hairline: "#2a2f37"
  text: "#f2f0eb"
  text-soft: "#c9cdd3"
  muted: "#9aa3af"
  gold: "#d4af6a"
  gold-soft: "#d4af6a26"
  positive: "#3ccb8d"
  caution: "#f2b544"
  danger: "#f0566b"
typography:
  display:
    fontFamily: "Sora, Inter, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.125rem, 6vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Sora, Inter, ui-sans-serif, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Sora, Inter, ui-sans-serif, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    fontFeature: "\"cv11\", \"ss01\""
  body-small:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  figure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\", \"zero\""
rounded:
  sm: "6px"
  md: "9px"
  lg: "12px"
  xl: "16px"
spacing:
  gutter-phone: "20px"
  gutter-desktop: "32px"
  panel: "20px"
  row: "16px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.raised}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.lg}"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
  button-danger:
    backgroundColor: "#f0566b26"
    textColor: "{colors.danger}"
    rounded: "{rounded.lg}"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "48px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  coin-amount:
    textColor: "{colors.gold}"
    typography: "{typography.figure}"
  tab-bar-item:
    textColor: "{colors.muted}"
    height: "56px"
  tab-bar-item-active:
    textColor: "{colors.text}"
---

# Design System: Fundback

## Overview

**Creative North Star: "The Signed Ledger"**

Fundback reads like a statement from a private bank that happens to keep score. The ground is near-black ink, the text is warm paper, and structure comes from one-pixel hairlines rather than boxes, shadows or colour fills. Numbers are the content: every amount, rate and count is set in JetBrains Mono with tabular figures, so columns align and nothing reads as decoration. The game layer (Coins, the streak flame, the level ring) sits inside this calm frame and is the only place colour carries excitement.

The system is dark-only (the root element carries `dark`; there is no light theme). It is a default theme, not a fixed one: every component reads CSS custom properties from `:root` in `src/app/globals.css`, so a theme the owner saves in admin (09-admin.md §2) restyles the product by overriding those variables, with no rebuild. Never hard-code a palette value in a component.

Density is phone-first and moderate: 20px gutters, 20px panel padding, 16–20px list rows, 44px minimum touch targets everywhere a finger lands. Desktop widens the container but keeps reading text at a measure.

**Key Characteristics:**
- Ink ground, paper text, hairline rules; flat at rest.
- Gold means Coins, levels and rewards, and nothing else.
- Positive, caution and danger mean state, and nothing else.
- Primary action is paper on ink: the brightest thing on screen without a brand colour.
- Every figure is mono and tabular.
- Themeable by variable; dark-only.

## Colors

A near-monochrome cool-ink palette with one warm reward accent and three state signals.

### Primary
- **Warm Paper** (text): body text, headings, and the fill of the primary button. It doubles as the primary action colour (`--primary` maps to it), which is why the system needs no brand hue. It also marks text selection (a 24% wash) and the input caret.

### Secondary
- **Struck Gold** (gold): Coin figures, the Coin glyph, the current level name, level progress rings, and the give-back figure in the home headline. **Gold Wash** (gold-soft, gold at 15%) is the defined tint for reward backgrounds; no shipped surface uses it yet.

### Tertiary (state signals)
- **Safe Green** (positive): safe and positive states, success toasts, Guardian rings within limits.
- **Signal Amber** (caution): caution states, draft notices on legal pages (border at 40%, fill at 10%), and warning toasts.
- **Breach Red** (danger): danger and breach, field errors, destructive buttons (fill at 15%, 25% on hover).

### Neutral
- **Ink** (ink): page ground, the bar behind sticky headers and the bottom tab bar (at 95% with a light backdrop blur), and the primary button's text.
- **Surface** (surface): panels, inputs, secondary buttons.
- **Raised** (raised): hover fills, the active desktop tab, skeletons, popovers.
- **Hairline** (hairline): every border, divider and rule; also the track of progress rings and the scrollbar thumb.
- **Soft Paper** (text-soft): reading paragraphs and secondary labels.
- **Muted Slate** (muted): hints, captions, inactive tabs, pending Coins, unlit icons.

### Named Rules
**The Gold Means Coins Rule.** Gold appears only on Coins, levels and rewards. All gold text comes through the Coin amount component or a level/reward figure. Never use gold for links, buttons, headings or emphasis.

**The State Only Rule.** Green, amber and red describe the state of something (safe, caution, breach, error, success). They are never decoration, brand colour or a call to action.

**The Variables Only Rule.** Components read `var(--ink)`, `var(--gold)` and the rest, or their Tailwind mappings (`bg-surface`, `text-gold`, `border-hairline`). Literal hex lives only in `globals.css`, plus the places that cannot read CSS (the `themeColor` meta, the global error fallback, email templates).

## Typography

**Display Font:** Sora (fallback Inter, ui-sans-serif)
**Body Font:** Inter (fallback ui-sans-serif, system-ui), with `cv11` and `ss01`
**Figure Font:** JetBrains Mono (fallback ui-monospace), tabular with slashed zero

**Character:** Sora's geometric confidence carries the headlines; Inter does the reading; Mono marks every number as a fact you can check. All three load through `next/font`; Mono is not preloaded so it never delays first paint.

### Hierarchy
- **Display** (700, 2.125rem phone to 3rem at sm and 3.5rem at lg, line-height 1.06, max 14ch): the one page headline. A key figure inside it may switch to Mono, gold if it is a reward figure.
- **Headline** (600, 1.5rem to 1.75rem): section headings on public pages; legal page titles run 1.875–2.25rem at 700.
- **Title** (600, 1.125rem; 1rem or 0.9375rem in lists): panel and list-item titles, always Sora.
- **Body** (400, 1rem, line-height 1.65; 1.125rem from sm on the letter): reading text in Soft Paper, held to a measure (65ch utility, 62ch letter column, 68ch legal article).
- **Body Small** (400, 0.875rem, relaxed): hints, empty-state bodies, captions in Muted Slate.
- **Label** (500, 0.875rem): field labels in Soft Paper, button text (0.9375rem on the default button), tab labels (0.6875rem under icons in the bottom bar).
- **Figure** (Mono, tabular): every amount, XP count, rate and code, at whatever size its context needs.

### Named Rules
**The Every Figure Is Mono Rule.** Money, Coins, XP, percentages and codes are set in JetBrains Mono with the `tabular` utility. A number in Inter is a bug.

**The Tight Heading Rule.** Headings h1–h4 are Sora with -0.02em tracking and balanced wrapping; paragraphs use pretty wrapping.

## Layout

Single column first. Page gutters are 20px on phones and 32px from 640px. The public site sits in a 72rem container; the signed-in app in 64rem; admin pages and auth forms in narrower 28rem columns. On the home page the letter is a 62ch column, and from 1024px a second column (sticky) holds the worked arithmetic beside it.

The signed-in app has a sticky ink header (56px, 64px from 768px). Navigation is a fixed bottom tab bar on phones (five 56px targets, safe-area aware) and moves into the header as tabs from 768px; main content reserves bottom padding for the bar.

Rhythm: 40px between page sections in the app, 48–112px between public sections (each opened by a hairline rule), 20px inside panels, 16–20px per list row.

## Elevation & Depth

Flat. Page surfaces carry no shadows; depth comes from tonal steps (Ink, Surface, Raised) and hairline borders. There is one elevation in the system, the overlay token (`--shadow-overlay` in `globals.css`), used by the sheet because it floats above the page.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.6), 0 2px 6px rgb(0 0 0 / 0.4)`): floating overlays only, read through `var(--shadow-overlay)`. Nothing that sits in the page flow uses it.

### Named Rules
**The Hairline Not Box Rule.** Group related figures into one bordered panel split by 1px hairline gaps (a grid with a 1px gap over a hairline fill), or into a ruled list (`divide-y` with a top and bottom rule). Never put a card inside a card, and never stack empty boxes.

**The Ledger Rule.** A worked calculation is a ruled statement: a strong top rule (paper at 70%), hairline rows, and a double rule above the total.

## Shapes

One radius family driven by `--radius` (0.75rem), so the admin theme's corner setting reaches everything. Controls (buttons, inputs, selects, tabs, nav links) use 12px; panels, tables and empty states use 16px; small parts use 6–9px. Borders are always 1px hairline; empty states use a dashed hairline. Rings and the Coin glyph are the only circles.

## Components

### Buttons
Quiet and certain; the press nudges down 1px.
- **Shape:** gently rounded (12px).
- **Primary:** Warm Paper fill, Ink text, 44px tall (48px large), 16px side padding. Hover mixes 12% ink into the paper.
- **Secondary:** Surface fill, hairline border; Raised on hover.
- **Ghost:** Soft Paper text, Raised fill on hover. **Danger:** red at 15%, 25% on hover. **Link:** underlined with a hairline decoration that brightens on hover.
- **Focus:** 2px ring in paper at 70%, offset 2px from the ink ground. Transitions 150ms on the expo ease-out.
- **Pending:** inline spinner, `aria-busy`, repeat submits blocked. Disabled is 50% opacity.
- The small 36px size is for dense desktop tables only.

### Inputs / Fields
- **Style:** 48px tall, Surface fill, hairline border, 12px radius, 16px text (no zoom on iOS).
- **Focus:** the border brightens toward paper and a soft paper ring appears.
- **Error:** red border with a red ring at 25%; the message below is announced politely. Label above in Soft Paper, hint below in Muted Slate.
- **Select:** a native `<select>` styled like the input (48px, Surface, hairline, 12px radius) with a muted chevron drawn on the right. No custom dropdown.
- **Checkbox:** a native checkbox (20px, `appearance: none`, Ink fill, brightened hairline border, 5px radius; checked fills with Paper and an Ink tick) inside a full-width label row that is at least 48px tall, Surface fill with a hairline border, so the whole row is the touch target.

### Panels
- **Corner Style:** 16px. **Background:** Surface on Ink. **Border:** hairline (the Card primitive uses the same hairline border). **Shadow:** none. **Padding:** 20px (24px from 640px).
- Multi-stat panels split into cells with 1px hairline gaps, not separate cards.

### Navigation
- **Phone:** fixed bottom bar on Ink at 95% with a top hairline; icon over label; active is Paper with a heavier icon stroke, inactive is Muted Slate.
- **Desktop:** header tabs, 44px tall; active tab gets a Raised fill. The in-page tabs primitive is also 44px tall.
- **Public header:** text wordmark (Sora 700) and two text links, each 44px tall.

### Coin Amount (signature)
A Mono, tabular figure in gold, preceded by the Coin glyph (a milled rim and struck centre drawn to read at 12px) and followed by the unit in Inter at 0.75em. Pending Coins render in Muted Slate with the word "pending": they are not spendable yet. Sizes run from 0.875rem to 2.25rem.

### Progress Ring (signature)
Hairline track, round-capped arc. Gold for levels; positive, caution or danger for Guardian risk. Fills on mount over 700ms on the expo ease-out; instantly under reduced motion. On Today the level ring (56px, 6px stroke) is empty in the centre and sits beside the level name in gold and one Mono line of progress ("0 / 1,000 XP to Silver"); figures are not crammed inside the ring.

### Streak Flame
Outline in Muted Slate until the first check-in; lit is filled Warm Paper. The flame is a game mark, not a state, so it takes no state colour.

### Empty State
Dashed hairline, 16px radius, Sora title, a body at reading measure that says what will appear, and the next useful action.

## Do's and Don'ts

### Do:
- **Do** read every colour, radius and font from the CSS variables in `globals.css`, so an admin theme applies everywhere.
- **Do** set every figure in JetBrains Mono with the `tabular` utility.
- **Do** keep touch targets at 44px or larger (inputs 48px, bottom tabs 56px).
- **Do** separate content with hairlines: one bordered panel with hairline gaps, or a ruled list.
- **Do** design the empty, loading (skeleton in Raised) and error state of every screen.
- **Do** keep motion to 150–300ms on the expo ease-out for controls; ring fills and count-ups may run longer, and all of it collapses under `prefers-reduced-motion`.

### Don't:
- **Don't** use gold for anything except Coins, levels and rewards.
- **Don't** use green, amber or red as decoration or as a call to action.
- **Don't** fill the primary button with a colour; it is paper on ink.
- **Don't** nest cards or give page surfaces drop shadows; the overlay shadow is for floating layers only.
- **Don't** add a light theme or light sections; the product is dark-only.
- **Don't** hard-code hex values in components.
- **Don't** build custom dropdowns or checkboxes; theme the native controls.
