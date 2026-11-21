/**
 * Every brand string lives here and nowhere else (CLAUDE.md §3).
 * The name, code and domain are working values; renaming is a one-file change.
 * Admin can later override display values from `site_settings` (09-admin.md §2).
 */
export const brand = {
  name: "Fundback",
  promoCode: "FUNDBACK",
  tagline: "Get funded. Get more back.",
  /** Bare domain, used in copy. The canonical origin comes from NEXT_PUBLIC_SITE_URL. */
  domain: "fundback.example",
  supportEmail: "support@fundback.example",
  social: {
    telegram: null as string | null,
    x: null as string | null,
    instagram: null as string | null,
  },
  currency: {
    coins: { singular: "Coin", plural: "Coins" },
    xp: "XP",
  },
} as const;

export type Brand = typeof brand;
