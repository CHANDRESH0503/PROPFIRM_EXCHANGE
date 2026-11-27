/** Payout estimate from a firm's split, buffer, fee and minimum. All amounts in account currency. */

export type PayoutInput = {
  profit: number;
  splitPercent: number;
  /** Profit the firm requires to stay in the account above the starting balance. */
  buffer: number;
  /** Fixed fee charged per payout (transfer or processing fee). */
  fee: number;
  minimum: number;
  processingDays: number;
  /** ISO date (YYYY-MM-DD) the request is made, if known. */
  requestDate?: string;
};

export type PayoutResult = {
  withdrawable: number;
  traderShare: number;
  firmShare: number;
  received: number;
  meetsMinimum: boolean;
  /** Further profit needed before the request meets the minimum, 0 when it already does. */
  shortfall: number;
  expectedDate: string | null;
};

export function payout(input: PayoutInput): PayoutResult {
  const split = input.splitPercent / 100;
  const withdrawable = Math.max(0, input.profit - input.buffer);
  const traderShare = withdrawable * split;
  const received = Math.max(0, traderShare - input.fee);
  const meetsMinimum = traderShare > 0 && traderShare >= input.minimum;
  // Profit needed so that the trader's share reaches the minimum.
  const needed = split > 0 ? input.minimum / split + input.buffer : Infinity;
  return {
    withdrawable,
    traderShare,
    firmShare: withdrawable - traderShare,
    received,
    meetsMinimum,
    shortfall: meetsMinimum ? 0 : Math.max(0, needed - input.profit),
    expectedDate: input.requestDate
      ? addBusinessDays(input.requestDate, input.processingDays)
      : null,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Adds Monday–Friday days to an ISO date. Bank holidays are not known here and are not skipped. */
export function addBusinessDays(iso: string, days: number) {
  if (!ISO_DATE.test(iso)) throw new Error("invalid_date");
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error("invalid_date");
  let left = Math.max(0, Math.trunc(days));
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}
