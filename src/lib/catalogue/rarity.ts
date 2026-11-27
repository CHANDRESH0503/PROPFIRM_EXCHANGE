/**
 * Item rarity for a challenge program. It is fixed by account size and nothing else, so it can
 * never encode commission, sponsorship or a quality judgement (CLAUDE.md §2.7).
 */
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export function rarityFor(accountSize: number): Rarity {
  if (accountSize > 100_000) return "legendary";
  if (accountSize > 50_000) return "epic";
  if (accountSize > 25_000) return "rare";
  return "common";
}

/** Compact account size: 50000 → "50K", 1000000 → "1M". */
export function sizeLabel(accountSize: number) {
  if (accountSize >= 1_000_000) return `${+(accountSize / 1_000_000).toFixed(1)}M`;
  if (accountSize >= 1_000) return `${+(accountSize / 1_000).toFixed(1)}K`;
  return String(accountSize);
}
