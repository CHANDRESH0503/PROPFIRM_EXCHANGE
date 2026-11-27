/**
 * Journal CSV export (15-trading-journal.md "Privacy": export to CSV, free). Pure helpers so the
 * route stays thin and the mapping is unit-tested. Amounts are written from integer minor units
 * with string arithmetic, never through floating point.
 */

export const EXPORT_COLUMNS = [
  "closed_at",
  "opened_at",
  "local_day",
  "symbol",
  "direction",
  "lots",
  "entry",
  "exit",
  "stop_loss",
  "take_profit",
  "currency",
  "result",
  "commission",
  "swap",
  "net",
  "pips",
  "r_multiple",
  "session",
  "strategy",
  "setup_tags",
  "mistake_tags",
  "emotion_tags",
  "emotion_before",
  "emotion_after",
  "confidence",
  "notes",
  "source",
  "external_ticket",
] as const;

/** 12345 → "123.45", -5 → "-0.05". Exact for any integer within the column's range. */
export function centsToDecimal(cents: number | bigint): string {
  const n = BigInt(cents);
  const zero = BigInt(0),
    hundred = BigInt(100);
  const negative = n < zero;
  const abs = negative ? -n : n;
  const whole = abs / hundred;
  const frac = (abs % hundred).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export type ExportTrade = {
  closed_at: string;
  opened_at: string | null;
  local_day: string;
  symbol: string;
  direction: string;
  lots: number | null;
  entry: number | null;
  exit: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  currency: string;
  result_cents: number;
  commission_cents: number;
  swap_cents: number;
  net_cents: number | null;
  pips: number | null;
  r_multiple: number | null;
  session: string | null;
  emotion_before: number | null;
  emotion_after: number | null;
  confidence: number | null;
  notes: string | null;
  source: string;
  external_ticket: string | null;
  journal_strategies: { name: string } | null;
  journal_trade_tags: { journal_tags: { kind: string; name: string } | null }[];
};

const tagsOf = (t: ExportTrade, kind: string) =>
  t.journal_trade_tags
    .flatMap((x) => (x.journal_tags?.kind === kind ? [x.journal_tags.name] : []))
    .sort((a, b) => a.localeCompare(b))
    .join("; ");

/** One CSV row per trade, keyed by EXPORT_COLUMNS. */
export function exportRow(t: ExportTrade): Record<(typeof EXPORT_COLUMNS)[number], unknown> {
  return {
    closed_at: t.closed_at,
    opened_at: t.opened_at,
    local_day: t.local_day,
    symbol: t.symbol,
    direction: t.direction,
    lots: t.lots,
    entry: t.entry,
    exit: t.exit,
    stop_loss: t.stop_loss,
    take_profit: t.take_profit,
    currency: t.currency,
    result: centsToDecimal(t.result_cents),
    commission: centsToDecimal(t.commission_cents),
    swap: centsToDecimal(t.swap_cents),
    net: centsToDecimal(t.net_cents ?? t.result_cents + t.commission_cents + t.swap_cents),
    pips: t.pips,
    r_multiple: t.r_multiple,
    session: t.session,
    strategy: t.journal_strategies?.name ?? null,
    setup_tags: tagsOf(t, "setup"),
    mistake_tags: tagsOf(t, "mistake"),
    emotion_tags: tagsOf(t, "emotion"),
    emotion_before: t.emotion_before,
    emotion_after: t.emotion_after,
    confidence: t.confidence,
    notes: t.notes,
    source: t.source,
    external_ticket: t.external_ticket,
  };
}

export const EXPORT_SELECT =
  "id,closed_at,opened_at,local_day,symbol,direction,lots,entry,exit,stop_loss,take_profit,currency,result_cents,commission_cents,swap_cents,net_cents,pips,r_multiple,session,emotion_before,emotion_after,confidence,notes,source,external_ticket,journal_strategies(name),journal_trade_tags(journal_tags(kind,name))";
