/** Navigation structure. Labels come from messages (nav.*, trustNav.*); admin can override later (09-admin.md §3). */

/**
 * `also` lists nested screens that belong to a tab, so the tab stays highlighted there and the
 * member can see where they are (wallet sits under Rewards, purchase claims under Deals).
 */
export const APP_TABS = [
  { key: "today", href: "/today", also: [] },
  { key: "deals", href: "/deals", also: ["/claims"] },
  { key: "rewards", href: "/rewards", also: ["/wallet"] },
  { key: "accounts", href: "/accounts", also: [] },
  { key: "profile", href: "/profile", also: ["/notifications", "/support"] },
] as const;

export type AppTabKey = (typeof APP_TABS)[number]["key"];

/** Public discovery links in the footer. Labels in messages (footer.links.*). */
export const EXPLORE_LINKS = [
  { key: "firms", href: "/firms" },
  { key: "compare", href: "/compare" },
  { key: "deals", href: "/deals" },
  { key: "tools", href: "/tools" },
  { key: "journal", href: "/journal" },
  { key: "help", href: "/help" },
  { key: "changelog", href: "/changelog" },
  { key: "calendar", href: "/economic-calendar" },
  { key: "sessions", href: "/tools/market-sessions" },
] as const;

export const TRUST_PAGES = [
  "how-we-make-money",
  "how-rewards-work",
  "how-we-rank-firms",
  "affiliate-disclosure",
  "risk-disclosure",
] as const;

export const LEGAL_PAGES = ["terms", "privacy", "rewards-terms"] as const;

export type TrustSlug = (typeof TRUST_PAGES)[number] | (typeof LEGAL_PAGES)[number];
