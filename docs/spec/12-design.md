# 12. Design direction

Part of the project brief. The rules in `/CLAUDE.md` §2 override anything here.


Premium fintech that is openly a game: think of a private-bank app with a well-made progression system. Calm surfaces, with reward moments that feel earned.

- **Theme:** the owner can change colours, fonts and corner style in admin (`09-admin.md` §2). The values below are the default theme. Build every component from CSS variables so a theme change applies everywhere. Dark first. Ink `#0B0D10`, surface `#14171C`, raised `#1C2026`, border `#2A2F37`, text `#F2F0EB`, muted `#9AA3AF`.
- **Accents:** gold `#D4AF6A` only for Coins, levels and rewards. Green `#3CCB8D` for safe and positive, amber `#F2B544` for caution, red `#F0566B` for danger and breach.
- **Type:** Sora for headings, Inter for body, JetBrains Mono for codes and figures, loaded with `next/font`. Tabular numbers for all amounts.
- **Game language:** coin, flame, progress ring, level emblem, season banner. Each level has its own emblem and tint.
- **Motion:** 150–300 ms, purposeful. Count-ups for balances, ring fills for progress, a reveal for vouchers. Confetti only for the three celebration moments in `06-engagement.md`.
- **States:** every screen has designed empty, loading (skeleton) and error states. Empty states point to the next useful action.
- **Mobile first:** thumb-reachable primary actions, 44 px minimum touch targets, no hover-only information.

