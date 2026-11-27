/**
 * Coin arithmetic (docs/spec/05-economy.md). Integers only: cents, Coins and basis points.
 * The database crediting function (Phase 1) is the authority; this mirror exists for display
 * (worked examples, calculators) and is tested against the same worked examples.
 */
export const BPS = 10_000;

export function assertInt(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${name} must be a non-negative integer`);
}

/** commission = floor(price × commission_bps / 10000), in cents. */
export function commissionCents(priceCents: number, commissionBps: number): number {
  assertInt("priceCents", priceCents);
  assertInt("commissionBps", commissionBps);
  return Math.floor((priceCents * commissionBps) / BPS);
}

/** coins = floor(commission_cents × share_bps / 10000). */
export function coinsForShare(commission: number, shareBps: number): number {
  assertInt("commission", commission);
  assertInt("shareBps", shareBps);
  return Math.floor((commission * shareBps) / BPS);
}

export interface GivebackInput {
  commissionCents: number;
  /** Level rate, or the season override when a season is active. */
  baseShareBps: number;
  /** Give-back booster; ignored during a season override. */
  boosterBps?: number;
  seasonOverride?: boolean;
  referralBps?: number;
  creatorBps?: number;
  maxTotalBps: number;
}

export interface GivebackSplit {
  userCoins: number;
  referralCoins: number;
  creatorCoins: number;
  userShareBps: number;
  referralShareBps: number;
  creatorShareBps: number;
}

/**
 * Splits a confirmed commission under the cap: user share first, then referral, then creator,
 * each clipped so the total never exceeds `maxTotalBps` (CLAUDE.md §2.4).
 */
export function splitGiveback(input: GivebackInput): GivebackSplit {
  const booster = input.seasonOverride ? 0 : (input.boosterBps ?? 0);
  let remaining = input.maxTotalBps;
  const take = (bps: number) => {
    const granted = Math.max(0, Math.min(bps, remaining));
    remaining -= granted;
    return granted;
  };
  const userShareBps = take(input.baseShareBps + booster);
  const referralShareBps = take(input.referralBps ?? 0);
  const creatorShareBps = take(input.creatorBps ?? 0);
  return {
    userShareBps,
    referralShareBps,
    creatorShareBps,
    userCoins: coinsForShare(input.commissionCents, userShareBps),
    referralCoins: coinsForShare(input.commissionCents, referralShareBps),
    creatorCoins: coinsForShare(input.commissionCents, creatorShareBps),
  };
}
