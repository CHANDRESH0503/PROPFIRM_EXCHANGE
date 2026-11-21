/** Navigation structure. Labels come from messages (nav.*, trustNav.*); admin can override later (09-admin.md §3). */

export const APP_TABS = [
  { key: "today", href: "/today" },
  { key: "deals", href: "/deals" },
  { key: "rewards", href: "/rewards" },
  { key: "accounts", href: "/accounts" },
  { key: "profile", href: "/profile" },
] as const;

export type AppTabKey = (typeof APP_TABS)[number]["key"];

export const TRUST_PAGES = [
  "how-we-make-money",
  "how-rewards-work",
  "how-we-rank-firms",
  "affiliate-disclosure",
  "risk-disclosure",
] as const;

export const LEGAL_PAGES = ["terms", "privacy", "rewards-terms"] as const;

export type TrustSlug = (typeof TRUST_PAGES)[number] | (typeof LEGAL_PAGES)[number];

