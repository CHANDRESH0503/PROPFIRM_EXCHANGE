/** Consistency rule and challenge cost arithmetic. Amounts are in one currency. */

export type ConsistencyInput = {
  /** Total profit before today. */
  profit: number;
  /** Largest single-day profit so far. */
  bestDay: number;
  /** Largest day allowed, as a percentage of total profit (for example 30). */
  limitPercent: number;
};

export type ConsistencyResult = {
  share: number;
  passes: boolean;
  /** Total profit needed for the best day to fit the rule. */
  neededTotal: number;
  moreNeeded: number;
  /** Most profit today can make before today itself breaks the rule. */
  maxToday: number;
};

export function consistency(input: ConsistencyInput): ConsistencyResult {
  const c = input.limitPercent / 100;
  const share = input.profit > 0 ? (input.bestDay / input.profit) * 100 : Infinity;
  const neededTotal = input.bestDay / c;
  // Today (X) breaks the rule only as the new largest day: X > bestDay and X / (profit + X) > c.
  // Up to the larger of bestDay and c·profit / (1 − c), today itself is never the problem.
  const todayCap = (c * input.profit) / (1 - c);
  return {
    share,
    passes: share <= input.limitPercent,
    neededTotal,
    moreNeeded: Math.max(0, neededTotal - input.profit),
    maxToday: Math.max(0, todayCap, input.bestDay),
  };
}

export type ChallengeCostInput = {
  fee: number;
  discountPercent: number;
  attempts: number;
  /** Whether the firm refunds the fee with the first payout. */
  refund: boolean;
  /** Profit split as a percentage, used for the break-even profit. */
  splitPercent: number;
};

export type ChallengeCostResult = {
  perAttempt: number;
  total: number;
  /** Payout the trader must receive to cover every attempt. */
  breakEvenPayout: number;
  /** Funded-account profit that produces that payout at the split. */
  breakEvenProfit: number;
};

export function challengeCost(input: ChallengeCostInput): ChallengeCostResult {
  const perAttempt = input.fee * (1 - input.discountPercent / 100);
  const total = perAttempt * input.attempts;
  // A refund returns the passing attempt's fee, so only the other attempts need covering.
  const breakEvenPayout = input.refund ? perAttempt * (input.attempts - 1) : total;
  return {
    perAttempt,
    total,
    breakEvenPayout,
    breakEvenProfit:
      input.splitPercent > 0 ? breakEvenPayout / (input.splitPercent / 100) : Infinity,
  };
}
