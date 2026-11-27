import { quoteToAccount, type AccountCurrency, type Instrument } from "./instruments";

/**
 * Position-size arithmetic. Trading figures are decimals by nature (prices, lots), so these use
 * floating point with explicit rounding at the edges. None of this touches the Coin economy.
 */

/** Rounds down to the broker's lot step so the position never risks more than asked. */
export function floorToStep(value: number, step: number) {
  if (!(value > 0) || !(step > 0)) return 0;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  // The epsilon absorbs binary noise such as 0.3 / 0.01 = 29.999999999999996.
  const steps = Math.floor(value / step + 1e-9);
  return Number((steps * step).toFixed(decimals));
}

export function roundTo(value: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f;
}

export type Conversion = {
  account: AccountCurrency;
  /** Current price of the instrument. Needed when the account currency is the base. */
  price?: number;
  /** Price of the conversion pair, when neither side of the instrument is the account currency. */
  rate?: number;
  /** Broker contract size override, units per 1.00 lot. */
  contractSize?: number;
};

export type MissingInput = { ok: false; missing: "price" | "rate" };

/** Value of one pip for a 1.00 lot, in the account currency. */
export function pipValuePerLot(
  inst: Instrument,
  c: Conversion,
): { ok: true; value: number } | MissingInput {
  const factor = quoteToAccount(inst, c.account, c.price, c.rate);
  if (factor === null) return { ok: false, missing: c.account === inst.base ? "price" : "rate" };
  const contract = c.contractSize ?? inst.contractSize;
  return { ok: true, value: inst.pipSize * contract * factor };
}

export function pipsFromPriceDistance(inst: Instrument, distance: number) {
  return distance / inst.pipSize;
}

export type LotSizeInput = Conversion & {
  balance: number;
  risk: { mode: "percent"; value: number } | { mode: "amount"; value: number };
  stopPips: number;
  lotStep: number;
  /** Remaining daily loss room, if the trader knows it. Used only to warn. */
  dailyRoom?: number;
};

export type LotSizeResult =
  | MissingInput
  | {
      ok: true;
      riskAmount: number;
      exactLots: number;
      lots: number;
      pipValuePerLot: number;
      pipValue: number;
      moneyAtRisk: number;
      riskPercent: number;
      belowMinimum: boolean;
      exceedsDailyRoom: boolean;
    };

export function lotSize(inst: Instrument, input: LotSizeInput): LotSizeResult {
  const pv = pipValuePerLot(inst, input);
  if (!pv.ok) return pv;
  const riskAmount =
    input.risk.mode === "percent" ? (input.balance * input.risk.value) / 100 : input.risk.value;
  const lossPerLot = input.stopPips * pv.value;
  const exactLots = riskAmount / lossPerLot;
  const lots = floorToStep(exactLots, input.lotStep);
  const moneyAtRisk = lots * lossPerLot;
  return {
    ok: true,
    riskAmount,
    exactLots,
    lots,
    pipValuePerLot: pv.value,
    pipValue: lots * pv.value,
    moneyAtRisk,
    riskPercent: (moneyAtRisk / input.balance) * 100,
    belowMinimum: lots === 0,
    exceedsDailyRoom:
      input.dailyRoom !== undefined && Math.max(moneyAtRisk, riskAmount) > input.dailyRoom,
  };
}

export type MarginInput = Conversion & { lots: number; price: number; leverage: number };

export type MarginResult =
  | MissingInput
  | { ok: true; pipValue: number; pipValuePerLot: number; notional: number; margin: number };

export function pipValueAndMargin(inst: Instrument, input: MarginInput): MarginResult {
  const pv = pipValuePerLot(inst, input);
  if (!pv.ok) return pv;
  const factor = quoteToAccount(inst, input.account, input.price, input.rate);
  if (factor === null) return { ok: false, missing: "rate" };
  const contract = input.contractSize ?? inst.contractSize;
  const notional = input.lots * contract * input.price * factor;
  return {
    ok: true,
    pipValuePerLot: pv.value,
    pipValue: pv.value * input.lots,
    notional,
    margin: notional / input.leverage,
  };
}

export function riskReward(loss: number, gain: number) {
  return { ratio: gain / loss, breakevenPercent: (100 * loss) / (loss + gain) };
}
