/**
 * Prop-firm loss limits. Firms word these rules differently, so each choice is an explicit input
 * and the page explains which reading the calculator applies.
 */

export const DRAWDOWN_TYPES = ["static", "trailing", "eod"] as const;
export type DrawdownType = (typeof DRAWDOWN_TYPES)[number];

export const DAILY_BASES = ["initial", "dayStart"] as const;
export type DailyBasis = (typeof DAILY_BASES)[number];

export type DailyRoomInput = {
  /** Account size the challenge started at. */
  initial: number;
  /** Daily loss limit as a percentage. */
  dailyPercent: number;
  /** Whether the daily percentage applies to the starting size or to the day's starting figure. */
  dailyBasis: DailyBasis;
  /** Balance or equity at the firm's daily reset, whichever the firm measures from. */
  dayStart: number;
  maxPercent: number;
  drawdown: DrawdownType;
  /**
   * Highest equity reached (intraday trailing) or highest end-of-day balance (end-of-day trailing).
   * Ignored for a static drawdown.
   */
  peak?: number;
  /** The trailing floor stops rising once it reaches the starting size. */
  lockAtInitial: boolean;
  balance: number;
  /** Open profit or loss, negative for a loss. */
  floating: number;
  /** Commission and swap on open positions, negative for a cost. */
  costs: number;
};

export type DailyRoomResult = {
  equity: number;
  dailyLimit: number;
  dailyFloor: number;
  dailyRoom: number;
  maxLimit: number;
  maxFloor: number;
  maxRoom: number;
  /** The smaller of the two rooms. A trade must fit inside this. */
  room: number;
  binding: "daily" | "max";
  status: "breached" | "close" | "clear";
};

/** Rooms within this share of the daily limit are flagged, matching the journal heatmap rule. */
export const CLOSE_SHARE = 0.2;

export function dailyRoom(input: DailyRoomInput): DailyRoomResult {
  const equity = input.balance + input.floating + input.costs;
  const dailyLimit =
    ((input.dailyBasis === "initial" ? input.initial : input.dayStart) * input.dailyPercent) / 100;
  const dailyFloor = input.dayStart - dailyLimit;
  const maxLimit = (input.initial * input.maxPercent) / 100;

  let maxFloor: number;
  if (input.drawdown === "static") {
    maxFloor = input.initial - maxLimit;
  } else {
    // Intraday trailing follows equity highs as they happen; end-of-day trailing only moves at the
    // daily close, so today's equity never raises it.
    const highs = [input.initial, input.peak ?? input.initial];
    if (input.drawdown === "trailing") highs.push(equity);
    maxFloor = Math.max(...highs) - maxLimit;
    if (input.lockAtInitial) maxFloor = Math.min(maxFloor, input.initial);
  }

  const dailyRoomLeft = equity - dailyFloor;
  const maxRoom = equity - maxFloor;
  const binding = dailyRoomLeft <= maxRoom ? "daily" : "max";
  const room = Math.min(dailyRoomLeft, maxRoom);
  const status = room <= 0 ? "breached" : room <= dailyLimit * CLOSE_SHARE ? "close" : "clear";
  return {
    equity,
    dailyLimit,
    dailyFloor,
    dailyRoom: dailyRoomLeft,
    maxLimit,
    maxFloor,
    maxRoom,
    room,
    binding,
    status,
  };
}

/** Gain needed to get back to the starting figure after losing `lossPercent`. */
export function recoveryPercent(lossPercent: number) {
  if (lossPercent >= 100) return Infinity;
  return (100 * lossPercent) / (100 - lossPercent);
}
