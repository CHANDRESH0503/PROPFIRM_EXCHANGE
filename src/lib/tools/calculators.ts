import { DAILY_BASES, DRAWDOWN_TYPES, dailyRoom, recoveryPercent } from "./drawdown";
import {
  floorToStep,
  lotSize,
  pipValueAndMargin,
  pipValuePerLot,
  pipsFromPriceDistance,
  riskReward,
} from "./forex";
import {
  ACCOUNT_CURRENCIES,
  SYMBOLS,
  conversionPair,
  instrument,
  needsPrice,
  type AccountCurrency,
} from "./instruments";
import { payout } from "./payout";
import { challengeCost, consistency } from "./rules";

/**
 * Calculator definitions shared by the server page (results from the URL, no JavaScript needed)
 * and the client form (live results while typing). Pure: no I/O, no React.
 */

export const CALCULATORS = [
  "lot-size",
  "pip-value",
  "daily-room",
  "payout",
  "risk-reward",
  "drawdown-recovery",
  "consistency",
  "challenge-cost",
] as const;
export type CalculatorKey = (typeof CALCULATORS)[number];

export function isCalculator(key: string): key is CalculatorKey {
  return CALCULATORS.some((k) => k === key);
}

export type Values = Record<string, string>;

type Shown = (v: Values) => boolean;

export type NumberField = {
  kind: "number";
  name: string;
  group: string;
  min?: number;
  max?: number;
  /** Allows negative amounts (open P&L, swap). */
  signed?: boolean;
  integer?: boolean;
  optional?: boolean;
  when?: Shown;
};
export type SelectField = {
  kind: "select";
  name: string;
  group: string;
  options: readonly string[];
  /** Options are codes shown as they are (symbols, currencies) rather than translated. */
  literal?: boolean;
  when?: Shown;
};
export type DateField = { kind: "date"; name: string; group: string; optional: true; when?: Shown };
export type FieldSpec = NumberField | SelectField | DateField;

export type Format = "money" | "lots" | "pips" | "percent" | "ratio" | "date";
export type Row = {
  key: string;
  value: number | string;
  format: Format;
  emphasis?: boolean;
  tone?: Tone;
  /** Show more decimals (the unrounded lot size). */
  precise?: boolean;
};
export type Tone = "danger" | "warning" | "positive";
export type Note = {
  key: string;
  tone: Tone;
  params?: Record<string, number | string>;
  format?: Format;
};
export type FieldError =
  | { code: "required" | "invalid" | "positive" | "integer" }
  | { code: "range"; min: number; max: number };

export type Outcome =
  | { status: "empty" }
  | { status: "invalid"; errors: Record<string, FieldError> }
  | { status: "ok"; currency: AccountCurrency; rows: Row[]; notes: Note[] };

export type Calculator = {
  key: CalculatorKey;
  fields: readonly FieldSpec[];
  defaults: Values;
  /** A field-level refusal for cross-field rules (a percentage over 100, a missing rate). */
  compute: (
    n: Parsed,
  ) => Omit<Extract<Outcome, { status: "ok" }>, "status"> | { field: string; error: FieldError };
};

/** Parsed numbers and option strings for the visible fields. Hidden or blank optionals are absent. */
export type Parsed = {
  num: (name: string) => number;
  opt: (name: string) => number | undefined;
  str: (name: string) => string;
  /** The selected option of a select field, narrowed to its option type. */
  pick: <T extends string>(name: string, options: readonly [T, ...T[]]) => T;
};

/** Narrows a submitted string to one of the allowed options, falling back to the first. */
export function pickOption<T extends string>(
  options: readonly [T, ...T[]],
  raw: string | undefined,
): T {
  return options.find((o) => o === raw) ?? options[0];
}

const NUMBER = /^-?\d{1,12}(\.\d{1,8})?$/;

export function visibleFields(calc: Calculator, values: Values) {
  return calc.fields.filter((f) => !f.when || f.when(values));
}

function value(calc: Calculator, values: Values, name: string) {
  return values[name] ?? calc.defaults[name] ?? "";
}

export function withDefaults(
  calc: Calculator,
  input: Record<string, string | string[] | undefined>,
): Values {
  const out: Values = { ...calc.defaults };
  for (const f of calc.fields) {
    const raw = input[f.name];
    if (typeof raw === "string") out[f.name] = raw.slice(0, 40);
  }
  return out;
}

/**
 * Indicative market prices keyed by symbol (EURUSD, USDJPY…). When the trader leaves the price or
 * conversion-rate field empty, the matching indicative price is used; typed values always win.
 */
export type PriceBook = Record<string, number>;

/** The indicative value an empty field would fall back to, if any. */
export function fallbackFor(name: string, values: Values, prices?: PriceBook) {
  if (!prices) return undefined;
  if (name === "price") return prices[pickOption(SYMBOLS, values.symbol)];
  if (name === "rate") {
    const pair = rateNeeded(values);
    return pair ? prices[pair] : undefined;
  }
  return undefined;
}

export function evaluate(calc: Calculator, values: Values, prices?: PriceBook): Outcome {
  const fields = visibleFields(calc, values);
  const numbers = new Map<string, number>();
  const strings = new Map<string, string>();
  const errors: Record<string, FieldError> = {};
  let anyNumber = false;

  for (const f of fields) {
    const raw = value(calc, values, f.name).trim();
    if (f.kind === "select") {
      strings.set(f.name, f.options.includes(raw) ? raw : f.options[0]!);
      continue;
    }
    if (f.kind === "date") {
      if (!raw) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`)))
        errors[f.name] = { code: "invalid" };
      else strings.set(f.name, raw);
      continue;
    }
    if (!raw) {
      const fallback = fallbackFor(f.name, values, prices);
      if (fallback !== undefined) numbers.set(f.name, fallback);
      else if (!f.optional) errors[f.name] = { code: "required" };
      continue;
    }
    anyNumber = true;
    if (!NUMBER.test(raw) || (!f.signed && raw.startsWith("-"))) {
      errors[f.name] = { code: "invalid" };
      continue;
    }
    if (f.integer && raw.includes(".")) {
      errors[f.name] = { code: "integer" };
      continue;
    }
    const n = Number(raw);
    if (!f.signed && f.min === undefined && n <= 0 && f.max === undefined) {
      errors[f.name] = { code: "positive" };
      continue;
    }
    const min = f.min ?? (f.signed ? -1e12 : 0);
    const max = f.max ?? 1e12;
    if (n < min || n > max || (!f.signed && f.min === undefined && n <= 0)) {
      errors[f.name] = { code: "range", min, max };
      continue;
    }
    numbers.set(f.name, n);
  }

  // Nothing typed yet: show the empty state rather than a wall of "required".
  if (!anyNumber) return { status: "empty" };
  if (Object.keys(errors).length) return { status: "invalid", errors };

  const parsed: Parsed = {
    num: (name) => {
      const n = numbers.get(name);
      if (n === undefined) throw new Error(`missing_number:${name}`);
      return n;
    },
    opt: (name) => numbers.get(name),
    str: (name) => strings.get(name) ?? "",
    pick: (name, options) => pickOption(options, strings.get(name)),
  };
  const result = calc.compute(parsed);
  if ("field" in result) return { status: "invalid", errors: { [result.field]: result.error } };
  return { status: "ok", ...result };
}

/** Query string for a shareable result link: only visible, non-empty fields. */
export function toSearch(calc: Calculator, values: Values) {
  const params = new URLSearchParams();
  for (const f of visibleFields(calc, values)) {
    const v = value(calc, values, f.name).trim();
    if (v) params.set(f.name, v);
  }
  return params.toString();
}

// ---------------------------------------------------------------------------------------------

const account = {
  kind: "select",
  name: "account",
  group: "account",
  options: ACCOUNT_CURRENCIES,
  literal: true,
} as const;
const symbol = {
  kind: "select",
  name: "symbol",
  group: "trade",
  options: SYMBOLS,
  literal: true,
} as const;

const symbolOf = (v: Values) => instrument(pickOption(SYMBOLS, v.symbol));
const accountOf = (v: Values): AccountCurrency => pickOption(ACCOUNT_CURRENCIES, v.account);

/** The instrument's own price is needed for the conversion. */
const priceNeeded: Shown = (v) => needsPrice(symbolOf(v), accountOf(v));
/** A second pair's price is needed for the conversion. */
export const rateNeeded = (v: Values) => conversionPair(symbolOf(v), accountOf(v));

const missing = (field: "price" | "rate") => ({ field, error: { code: "required" } }) as const;

function conversion(n: Parsed) {
  return {
    account: n.pick("account", ACCOUNT_CURRENCIES),
    price: n.opt("price"),
    rate: n.opt("rate"),
    contractSize: n.opt("contract"),
  };
}

const lotSizeCalc: Calculator = {
  key: "lot-size",
  fields: [
    account,
    { kind: "number", name: "balance", group: "account" },
    { kind: "select", name: "riskMode", group: "risk", options: ["percent", "amount"] },
    { kind: "number", name: "risk", group: "risk" },
    { kind: "number", name: "dailyRoom", group: "risk", optional: true },
    symbol,
    { kind: "select", name: "stopMode", group: "trade", options: ["pips", "price"] },
    { kind: "number", name: "stop", group: "trade" },
    { kind: "number", name: "price", group: "trade", when: priceNeeded },
    { kind: "number", name: "rate", group: "trade", when: (v) => rateNeeded(v) !== null },
    {
      kind: "select",
      name: "lotStep",
      group: "broker",
      options: ["0.01", "0.1", "1"],
      literal: true,
    },
    { kind: "number", name: "contract", group: "broker", optional: true },
  ],
  defaults: {
    account: "USD",
    riskMode: "percent",
    symbol: "EURUSD",
    stopMode: "pips",
    lotStep: "0.01",
  },
  compute(n) {
    const inst = instrument(n.str("symbol"));
    const percent = n.str("riskMode") === "percent";
    if (percent && n.num("risk") > 100)
      return { field: "risk", error: { code: "range", min: 0, max: 100 } };
    const stopPips =
      n.str("stopMode") === "pips" ? n.num("stop") : pipsFromPriceDistance(inst, n.num("stop"));
    const r = lotSize(inst, {
      ...conversion(n),
      balance: n.num("balance"),
      risk: { mode: percent ? "percent" : "amount", value: n.num("risk") },
      stopPips,
      lotStep: Number(n.str("lotStep")),
      dailyRoom: n.opt("dailyRoom"),
    });
    if (!r.ok) return missing(r.missing);
    const notes: Note[] = [];
    if (r.belowMinimum) {
      notes.push({
        key: "belowMinimum",
        tone: "warning",
        params: { amount: Number(n.str("lotStep")) * stopPips * r.pipValuePerLot },
        format: "money",
      });
    }
    if (r.exceedsDailyRoom) notes.push({ key: "exceedsDailyRoom", tone: "danger" });
    return {
      currency: n.pick("account", ACCOUNT_CURRENCIES),
      rows: [
        {
          key: "lots",
          value: r.lots,
          format: "lots",
          emphasis: true,
          tone: r.exceedsDailyRoom ? "danger" : undefined,
        },
        { key: "moneyAtRisk", value: r.moneyAtRisk, format: "money" },
        { key: "riskPercent", value: r.riskPercent, format: "percent" },
        { key: "stopPips", value: stopPips, format: "pips" },
        { key: "pipValue", value: r.pipValue, format: "money" },
        { key: "pipValuePerLot", value: r.pipValuePerLot, format: "money" },
        { key: "exactLots", value: r.exactLots, format: "lots", precise: true },
      ],
      notes,
    };
  },
};

const pipValueCalc: Calculator = {
  key: "pip-value",
  fields: [
    account,
    symbol,
    { kind: "number", name: "lots", group: "trade" },
    { kind: "number", name: "price", group: "trade" },
    { kind: "number", name: "rate", group: "trade", when: (v) => rateNeeded(v) !== null },
    { kind: "number", name: "leverage", group: "broker", min: 1, max: 5000 },
    { kind: "number", name: "contract", group: "broker", optional: true },
  ],
  defaults: { account: "USD", symbol: "EURUSD" },
  compute(n) {
    const inst = instrument(n.str("symbol"));
    const r = pipValueAndMargin(inst, {
      ...conversion(n),
      price: n.num("price"),
      lots: n.num("lots"),
      leverage: n.num("leverage"),
    });
    if (!r.ok) return missing(r.missing);
    return {
      currency: n.pick("account", ACCOUNT_CURRENCIES),
      rows: [
        { key: "pipValue", value: r.pipValue, format: "money", emphasis: true },
        { key: "pipValuePerLot", value: r.pipValuePerLot, format: "money" },
        { key: "notional", value: r.notional, format: "money" },
        { key: "margin", value: r.margin, format: "money", emphasis: true },
      ],
      notes: [],
    };
  },
};

const trailing: Shown = (v) => (v.drawdown ?? "static") !== "static";
const sizing: Shown = (v) => Boolean(v.stopPips?.trim());

const dailyRoomCalc: Calculator = {
  key: "daily-room",
  fields: [
    account,
    { kind: "number", name: "initial", group: "rules" },
    { kind: "number", name: "dailyPercent", group: "rules", max: 100 },
    { kind: "select", name: "dailyBasis", group: "rules", options: DAILY_BASES },
    { kind: "number", name: "maxPercent", group: "rules", max: 100 },
    { kind: "select", name: "drawdown", group: "rules", options: DRAWDOWN_TYPES },
    { kind: "select", name: "lock", group: "rules", options: ["no", "yes"], when: trailing },
    { kind: "number", name: "dayStart", group: "today" },
    { kind: "number", name: "peak", group: "today", when: trailing },
    { kind: "number", name: "balance", group: "today" },
    { kind: "number", name: "floating", group: "today", signed: true, optional: true },
    { kind: "number", name: "costs", group: "today", signed: true, optional: true },
    symbol,
    { kind: "number", name: "stopPips", group: "trade", optional: true },
    { kind: "number", name: "price", group: "trade", when: (v) => sizing(v) && priceNeeded(v) },
    {
      kind: "number",
      name: "rate",
      group: "trade",
      when: (v) => sizing(v) && rateNeeded(v) !== null,
    },
  ],
  defaults: {
    account: "USD",
    dailyBasis: "initial",
    drawdown: "static",
    lock: "no",
    symbol: "EURUSD",
  },
  compute(n) {
    const drawdown = n.pick("drawdown", DRAWDOWN_TYPES);
    const r = dailyRoom({
      initial: n.num("initial"),
      dailyPercent: n.num("dailyPercent"),
      dailyBasis: n.pick("dailyBasis", DAILY_BASES),
      dayStart: n.num("dayStart"),
      maxPercent: n.num("maxPercent"),
      drawdown,
      peak: drawdown === "static" ? undefined : n.num("peak"),
      lockAtInitial: n.str("lock") === "yes",
      balance: n.num("balance"),
      floating: n.opt("floating") ?? 0,
      costs: n.opt("costs") ?? 0,
    });
    const tone: Tone | undefined =
      r.status === "breached" ? "danger" : r.status === "close" ? "warning" : undefined;
    const rows: Row[] = [
      { key: "room", value: r.room, format: "money", emphasis: true, tone },
      { key: "equity", value: r.equity, format: "money" },
      {
        key: "dailyRoom",
        value: r.dailyRoom,
        format: "money",
        tone: r.binding === "daily" ? tone : undefined,
      },
      { key: "dailyFloor", value: r.dailyFloor, format: "money" },
      {
        key: "maxRoom",
        value: r.maxRoom,
        format: "money",
        tone: r.binding === "max" ? tone : undefined,
      },
      { key: "maxFloor", value: r.maxFloor, format: "money" },
    ];
    const stop = n.opt("stopPips");
    if (stop !== undefined && r.room > 0) {
      const pv = pipValuePerLot(instrument(n.str("symbol")), conversion(n));
      if (!pv.ok) return missing(pv.missing);
      rows.push({
        key: "maxLots",
        value: floorToStep(r.room / (stop * pv.value), 0.01),
        format: "lots",
        emphasis: true,
      });
    }
    const notes: Note[] = [
      { key: r.binding === "daily" ? "bindingDaily" : "bindingMax", tone: tone ?? "positive" },
    ];
    if (r.status === "breached") notes.unshift({ key: "breached", tone: "danger" });
    else if (r.status === "close") notes.unshift({ key: "close", tone: "warning" });
    return { currency: n.pick("account", ACCOUNT_CURRENCIES), rows, notes };
  },
};

const payoutCalc: Calculator = {
  key: "payout",
  fields: [
    account,
    { kind: "number", name: "profit", group: "account" },
    { kind: "number", name: "split", group: "rules", max: 100 },
    { kind: "number", name: "buffer", group: "rules", min: 0, optional: true },
    { kind: "number", name: "minimum", group: "rules", min: 0, optional: true },
    { kind: "number", name: "fee", group: "rules", min: 0, optional: true },
    {
      kind: "number",
      name: "processingDays",
      group: "timing",
      min: 0,
      max: 90,
      integer: true,
      optional: true,
    },
    { kind: "date", name: "requestDate", group: "timing", optional: true },
  ],
  defaults: { account: "USD" },
  compute(n) {
    const r = payout({
      profit: n.num("profit"),
      splitPercent: n.num("split"),
      buffer: n.opt("buffer") ?? 0,
      fee: n.opt("fee") ?? 0,
      minimum: n.opt("minimum") ?? 0,
      processingDays: n.opt("processingDays") ?? 0,
      requestDate: n.str("requestDate") || undefined,
    });
    const rows: Row[] = [
      {
        key: "received",
        value: r.received,
        format: "money",
        emphasis: true,
        tone: r.meetsMinimum ? undefined : "warning",
      },
      { key: "traderShare", value: r.traderShare, format: "money" },
      { key: "withdrawable", value: r.withdrawable, format: "money" },
      { key: "firmShare", value: r.firmShare, format: "money" },
    ];
    if (r.expectedDate) rows.push({ key: "expectedDate", value: r.expectedDate, format: "date" });
    const notes: Note[] = r.meetsMinimum
      ? []
      : [
          {
            key: "belowMinimum",
            tone: "warning",
            params: { amount: r.shortfall },
            format: "money",
          },
        ];
    return { currency: n.pick("account", ACCOUNT_CURRENCIES), rows, notes };
  },
};

const riskRewardCalc: Calculator = {
  key: "risk-reward",
  fields: [
    { kind: "number", name: "loss", group: "trade" },
    { kind: "number", name: "gain", group: "trade" },
  ],
  defaults: {},
  compute(n) {
    const r = riskReward(n.num("loss"), n.num("gain"));
    return {
      currency: "USD",
      rows: [
        { key: "ratio", value: r.ratio, format: "ratio", emphasis: true },
        { key: "breakeven", value: r.breakevenPercent, format: "percent", emphasis: true },
      ],
      notes: [],
    };
  },
};

const recoveryCalc: Calculator = {
  key: "drawdown-recovery",
  fields: [
    account,
    { kind: "number", name: "loss", group: "account", max: 99.99 },
    { kind: "number", name: "balance", group: "account", optional: true },
  ],
  defaults: { account: "USD" },
  compute(n) {
    const loss = n.num("loss");
    const rows: Row[] = [
      { key: "recovery", value: recoveryPercent(loss), format: "percent", emphasis: true },
    ];
    const balance = n.opt("balance");
    if (balance !== undefined) {
      const after = balance * (1 - loss / 100);
      rows.push(
        { key: "after", value: after, format: "money" },
        { key: "regain", value: balance - after, format: "money" },
      );
    }
    return { currency: n.pick("account", ACCOUNT_CURRENCIES), rows, notes: [] };
  },
};

const consistencyCalc: Calculator = {
  key: "consistency",
  fields: [
    account,
    { kind: "number", name: "profit", group: "account" },
    { kind: "number", name: "bestDay", group: "account" },
    { kind: "number", name: "limit", group: "rules", max: 99.99 },
  ],
  defaults: { account: "USD" },
  compute(n) {
    if (n.num("bestDay") > n.num("profit")) {
      return { field: "bestDay", error: { code: "range", min: 0, max: n.num("profit") } };
    }
    const r = consistency({
      profit: n.num("profit"),
      bestDay: n.num("bestDay"),
      limitPercent: n.num("limit"),
    });
    return {
      currency: n.pick("account", ACCOUNT_CURRENCIES),
      rows: [
        {
          key: "share",
          value: r.share,
          format: "percent",
          emphasis: true,
          tone: r.passes ? "positive" : "warning",
        },
        { key: "maxToday", value: r.maxToday, format: "money", emphasis: true },
        { key: "neededTotal", value: r.neededTotal, format: "money" },
        { key: "moreNeeded", value: r.moreNeeded, format: "money" },
      ],
      notes: [{ key: r.passes ? "passes" : "fails", tone: r.passes ? "positive" : "warning" }],
    };
  },
};

const challengeCostCalc: Calculator = {
  key: "challenge-cost",
  fields: [
    account,
    { kind: "number", name: "fee", group: "account" },
    { kind: "number", name: "discount", group: "account", min: 0, max: 100, optional: true },
    { kind: "number", name: "attempts", group: "rules", min: 1, max: 50, integer: true },
    { kind: "select", name: "refund", group: "rules", options: ["no", "yes"] },
    { kind: "number", name: "split", group: "rules", max: 100 },
  ],
  defaults: { account: "USD", attempts: "1", refund: "no" },
  compute(n) {
    const r = challengeCost({
      fee: n.num("fee"),
      discountPercent: n.opt("discount") ?? 0,
      attempts: n.num("attempts"),
      refund: n.str("refund") === "yes",
      splitPercent: n.num("split"),
    });
    return {
      currency: n.pick("account", ACCOUNT_CURRENCIES),
      rows: [
        { key: "perAttempt", value: r.perAttempt, format: "money", emphasis: true },
        { key: "total", value: r.total, format: "money" },
        { key: "breakEvenPayout", value: r.breakEvenPayout, format: "money" },
        { key: "breakEvenProfit", value: r.breakEvenProfit, format: "money", emphasis: true },
      ],
      notes: [{ key: "odds", tone: "warning" }],
    };
  },
};

const REGISTRY: Record<CalculatorKey, Calculator> = {
  consistency: consistencyCalc,
  "challenge-cost": challengeCostCalc,
  "lot-size": lotSizeCalc,
  "pip-value": pipValueCalc,
  "daily-room": dailyRoomCalc,
  payout: payoutCalc,
  "risk-reward": riskRewardCalc,
  "drawdown-recovery": recoveryCalc,
};

export function calculator(key: CalculatorKey): Calculator {
  return REGISTRY[key];
}

/** Default contract size for the selected symbol, shown as the broker override hint. */
export function defaultContract(v: Values) {
  return symbolOf(v).contractSize;
}
