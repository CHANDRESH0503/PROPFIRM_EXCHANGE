/**
 * Indicative prices for every supported pair, derived from a small set of USD majors so the
 * provider is asked for as few symbols as possible. Pure, so the arithmetic is unit-tested.
 */

/** Provider symbols fetched on each refresh (8 credits on Twelve Data). */
export const MAJORS = [
  "EUR/USD",
  "GBP/USD",
  "AUD/USD",
  "NZD/USD",
  "USD/JPY",
  "USD/CAD",
  "USD/CHF",
  "XAU/USD",
] as const;
export type Major = (typeof MAJORS)[number];

/** USD value of one unit of each asset we can price. */
export function usdValues(quotes: Partial<Record<Major, number>>) {
  const v: Record<string, number> = { USD: 1 };
  for (const [symbol, price] of Object.entries(quotes)) {
    if (!price || !(price > 0)) continue;
    const [base, quote] = symbol.split("/") as [string, string];
    if (quote === "USD") v[base] = price;
    else if (base === "USD") v[quote] = 1 / price;
  }
  return v;
}

/** Price of an instrument such as EURJPY or XAUUSD, or null if it cannot be derived. */
export function derivePrice(symbol: string, usd: Record<string, number>) {
  const base = symbol.slice(0, 3),
    quote = symbol.slice(3);
  if (symbol.length !== 6) return null;
  const b = usd[base],
    q = usd[quote];
  return b && q ? b / q : null;
}

/** Rounds like a trading platform shows prices (5 decimals, 3 for JPY quotes, 2 for gold). */
export function roundPrice(symbol: string, price: number) {
  const digits = symbol.endsWith("JPY") ? 3 : symbol.startsWith("XAU") ? 2 : 5;
  return Number(price.toFixed(digits));
}
