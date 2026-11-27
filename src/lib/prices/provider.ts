import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { INSTRUMENTS } from "@/lib/tools/instruments";
import { MAJORS, derivePrice, roundPrice, usdValues, type Major } from "./derive";

/**
 * FX price adapter (`16-trader-tools.md` §13). Prices are indicative, refreshed at most hourly
 * and never shown as live quotes. Only Twelve Data is implemented; another provider plugs in
 * behind `fetchMajors`.
 */

export type IndicativePrices = {
  provider: string;
  /** ISO time the provider was asked. */
  asOf: string;
  prices: Record<string, number>;
};

const TIMEOUT_MS = 6_000;

async function twelveData(key: string): Promise<Partial<Record<Major, number>>> {
  const url = new URL("https://api.twelvedata.com/price");
  url.searchParams.set("symbol", MAJORS.join(","));
  url.searchParams.set("apikey", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`twelvedata_http_${res.status}`);
  const body: unknown = await res.json();
  if (!body || typeof body !== "object") throw new Error("twelvedata_body");
  if ("status" in body && body.status === "error") {
    const code = "code" in body ? String(body.code) : "unknown";
    throw new Error(`twelvedata_error_${code}`);
  }
  const out: Partial<Record<Major, number>> = {};
  for (const symbol of MAJORS) {
    const entry = (body as Record<string, unknown>)[symbol];
    const raw = entry && typeof entry === "object" && "price" in entry ? entry.price : undefined;
    const price = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
    if (Number.isFinite(price) && price > 0) out[symbol] = price;
  }
  return out;
}

/** Cached for an hour per server; a failure is cached for five minutes, then retried. */
export async function indicativePrices(): Promise<IndicativePrices | null> {
  "use cache";
  cacheTag("fx-prices");
  const { FX_PRICE_PROVIDER: provider, FX_PRICE_API_KEY: key } = env();
  if (provider !== "twelvedata" || !key) {
    cacheLife("hours");
    return null;
  }
  try {
    const majors = await twelveData(key);
    const usd = usdValues(majors);
    const prices: Record<string, number> = {};
    for (const i of INSTRUMENTS) {
      const p = derivePrice(i.symbol, usd);
      if (p) prices[i.symbol] = roundPrice(i.symbol, p);
    }
    // Conversion pairs the calculators ask for (for example USDJPY) are FX symbols too.
    for (const a of Object.keys(usd))
      for (const b of Object.keys(usd)) {
        if (a === b || a === "XAU" || b === "XAU") continue;
        const p = derivePrice(`${a}${b}`, usd);
        if (p) prices[`${a}${b}`] = roundPrice(`${a}${b}`, p);
      }
    cacheLife({ stale: 300, revalidate: 3600, expire: 7200 });
    return { provider, asOf: new Date().toISOString(), prices };
  } catch (error) {
    log("warn", "prices.refresh_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    cacheLife({ stale: 60, revalidate: 300, expire: 600 });
    return null;
  }
}
