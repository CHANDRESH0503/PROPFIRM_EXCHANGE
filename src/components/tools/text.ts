import type { Format } from "@/lib/tools/calculators";

/**
 * Calculator copy is looked up by registry data (tool, field, row and note names), which the
 * compile-time message check cannot follow. `src/lib/tools/messages.test.ts` asserts that every
 * key the registry can produce exists in en.json, which is the guarantee the type would give.
 */
export type LooseT = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
  raw: (key: string) => unknown;
};

type TypedT = ((key: never, values?: never) => string) & {
  has: (key: never) => boolean;
  raw: (key: never) => unknown;
};

export function loose(t: TypedT): LooseT {
  return t as unknown as LooseT;
}

const decimals: Record<Exclude<Format, "date" | "money">, number> = {
  lots: 2,
  pips: 1,
  percent: 3,
  ratio: 3,
};

/** Deterministic formatting (fixed locale and UTC) so server and client output match. */
export function formatValue(
  value: number | string,
  format: Format,
  currency: string,
  exact = false,
) {
  if (format === "date") {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  }
  if (typeof value !== "number") return value;
  if (!Number.isFinite(value)) return "∞";
  if (format === "money") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  }
  const n = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: exact ? 4 : decimals[format],
    minimumFractionDigits: format === "lots" && !exact ? 2 : 0,
  }).format(value);
  if (format === "percent") return `${n}%`;
  if (format === "ratio") return `${n} R`;
  return n;
}
