import { INSTRUMENTS } from "@/lib/tools/instruments";
import { SESSIONS, marketOpenAt, wallTime } from "@/lib/tools/sessions";

/** Derived trade fields stored with each trade (pips, R-multiple, session). */

export const JOURNAL_SESSIONS = ["asia", "london", "new_york", "overlap", "off"] as const;
export type JournalSession = (typeof JOURNAL_SESSIONS)[number];

const PIP = new Map(INSTRUMENTS.map((i) => [i.symbol, i.pipSize]));

export type MetricsInput = {
  symbol: string;
  direction: "long" | "short";
  entry?: number | null;
  exit?: number | null;
  stopLoss?: number | null;
  openedAt?: Date | null;
  closedAt: Date;
};

export function pipSizeFor(symbol: string) {
  return PIP.get(symbol) ?? null;
}

export function tradeMetrics(t: MetricsInput) {
  const sign = t.direction === "long" ? 1 : -1;
  const move = t.entry && t.exit ? (t.exit - t.entry) * sign : null;
  const pip = pipSizeFor(t.symbol);
  const pips = move !== null && pip ? Math.round((move / pip) * 10) / 10 : null;
  const risk = t.entry && t.stopLoss ? Math.abs(t.entry - t.stopLoss) : 0;
  const r = move !== null && risk > 0 ? Math.round((move / risk) * 100) / 100 : null;
  return { pips, r, session: sessionAt(t.openedAt ?? t.closedAt) };
}

/** Session a trade opened in, using each city's local clock (daylight saving included). */
export function sessionAt(at: Date): JournalSession {
  if (!marketOpenAt(at)) return "off";
  const open = SESSIONS.filter((s) => {
    const hour = wallTime(at, s.zone).hour;
    return hour >= s.open && hour < s.close;
  }).map((s) => s.key);
  if (open.length >= 2) return "overlap";
  if (open.includes("london")) return "london";
  if (open.includes("newYork")) return "new_york";
  if (open.length === 1) return "asia";
  return "off";
}

/** Parses a decimal money string ("-125.50") to integer minor units without floats. */
export function toMinor(value: string) {
  const m = /^(-)?(\d{1,10})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!m) return null;
  const minor = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0"));
  return m[1] && minor !== 0 ? -minor : minor;
}

export function fromMinor(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
