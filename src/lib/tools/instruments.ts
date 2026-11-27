/**
 * Instrument conventions used by the trader calculators.
 *
 * These are the common retail conventions (MT4/MT5 CFD brokers). Contract sizes differ between
 * brokers, especially for metals and indices, so every calculator lets the trader override the
 * contract size with the figure from their platform's contract specification.
 */

export const ACCOUNT_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "CHF", "JPY"] as const;
export type AccountCurrency = (typeof ACCOUNT_CURRENCIES)[number];

export type InstrumentKind = "fx" | "metal" | "index";

export type Instrument = {
  symbol: string;
  kind: InstrumentKind;
  /** ISO code of the base currency for FX; the asset code for metals and indices. */
  base: string;
  /** Currency the price is quoted in. Profit is earned in this currency first. */
  quote: AccountCurrency | "NZD";
  /** Price movement that counts as one pip (or one point for indices). */
  pipSize: number;
  /** Units of the base per 1.00 lot. */
  contractSize: number;
};

const FX_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",
  "NZDJPY",
  "CADJPY",
  "CHFJPY",
  "EURGBP",
  "EURCHF",
  "EURAUD",
  "EURCAD",
  "EURNZD",
  "GBPCHF",
  "GBPAUD",
  "GBPCAD",
  "GBPNZD",
  "AUDCAD",
  "AUDCHF",
  "AUDNZD",
  "NZDCAD",
  "CADCHF",
] as const;

function fx(symbol: string): Instrument {
  const quote = symbol.slice(3) as Instrument["quote"];
  return {
    symbol,
    kind: "fx",
    base: symbol.slice(0, 3),
    quote,
    pipSize: quote === "JPY" ? 0.01 : 0.0001,
    contractSize: 100_000,
  };
}

export const INSTRUMENTS: readonly Instrument[] = [
  ...FX_PAIRS.map(fx),
  // Gold: one pip is $0.10 of price, so a 1.00 lot of 100 oz moves $10 per pip.
  { symbol: "XAUUSD", kind: "metal", base: "XAU", quote: "USD", pipSize: 0.1, contractSize: 100 },
  // Silver: one pip is $0.01 of price on a 5,000 oz lot, $50 per pip.
  {
    symbol: "XAGUSD",
    kind: "metal",
    base: "XAG",
    quote: "USD",
    pipSize: 0.01,
    contractSize: 5_000,
  },
  { symbol: "US30", kind: "index", base: "US30", quote: "USD", pipSize: 1, contractSize: 1 },
  { symbol: "NAS100", kind: "index", base: "NAS100", quote: "USD", pipSize: 1, contractSize: 1 },
  { symbol: "SPX500", kind: "index", base: "SPX500", quote: "USD", pipSize: 1, contractSize: 1 },
  { symbol: "GER40", kind: "index", base: "GER40", quote: "EUR", pipSize: 1, contractSize: 1 },
  { symbol: "UK100", kind: "index", base: "UK100", quote: "GBP", pipSize: 1, contractSize: 1 },
  { symbol: "JPN225", kind: "index", base: "JPN225", quote: "JPY", pipSize: 1, contractSize: 1 },
];

export const SYMBOLS = INSTRUMENTS.map((i) => i.symbol) as [string, ...string[]];

const BY_SYMBOL = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));

export function instrument(symbol: string): Instrument {
  const found = BY_SYMBOL.get(symbol);
  if (!found) throw new Error(`unknown_instrument:${symbol}`);
  return found;
}

/** Market ordering for currency pairs: the higher-priority currency is the base. */
const PRIORITY = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"];

/**
 * What the trader must supply to turn the quote currency into the account currency.
 * - `none`: the quote currency is the account currency.
 * - `price`: the account currency is the instrument's base, so the instrument price converts it.
 * - `pair`: another pair's price is needed (for example USDCAD to value EURCAD in a USD account).
 */
export type Conversion =
  { kind: "none" } | { kind: "price" } | { kind: "pair"; pair: string; accountIsBase: boolean };

export function conversionFor(inst: Instrument, account: AccountCurrency): Conversion {
  if (inst.quote === account) return { kind: "none" };
  if (inst.kind === "fx" && inst.base === account) return { kind: "price" };
  const accountFirst = PRIORITY.indexOf(account) < PRIORITY.indexOf(inst.quote);
  return {
    kind: "pair",
    pair: accountFirst ? `${account}${inst.quote}` : `${inst.quote}${account}`,
    accountIsBase: accountFirst,
  };
}

/** Whether the calculator needs the instrument's own price for the conversion. */
export function needsPrice(inst: Instrument, account: AccountCurrency) {
  return conversionFor(inst, account).kind === "price";
}

/** The pair whose price is needed, or null when no extra rate is needed. */
export function conversionPair(inst: Instrument, account: AccountCurrency) {
  const c = conversionFor(inst, account);
  return c.kind === "pair" ? c.pair : null;
}

/**
 * Multiplier that converts an amount in the instrument's quote currency to the account currency.
 * Returns null when a required price or rate is missing.
 */
export function quoteToAccount(
  inst: Instrument,
  account: AccountCurrency,
  price: number | undefined,
  rate: number | undefined,
): number | null {
  const c = conversionFor(inst, account);
  if (c.kind === "none") return 1;
  if (c.kind === "price") return price && price > 0 ? 1 / price : null;
  if (!rate || rate <= 0) return null;
  return c.accountIsBase ? 1 / rate : rate;
}
