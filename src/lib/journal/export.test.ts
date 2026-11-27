import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { EXPORT_COLUMNS, centsToDecimal, exportRow, type ExportTrade } from "./export";

const trade: ExportTrade = {
  closed_at: "2026-11-20T14:05:00+00:00",
  opened_at: null,
  local_day: "2026-11-20",
  symbol: "EURUSD",
  direction: "long",
  lots: 1.5,
  entry: 1.0812,
  exit: 1.0832,
  stop_loss: null,
  take_profit: null,
  currency: "USD",
  result_cents: 30000,
  commission_cents: -1050,
  swap_cents: -7,
  net_cents: 28943,
  pips: 20,
  r_multiple: 2,
  session: "london",
  emotion_before: 3,
  emotion_after: 4,
  confidence: 4,
  notes: '=HYPERLINK("x") and a "quote", comma',
  source: "manual",
  external_ticket: null,
  journal_strategies: { name: "Breakout" },
  journal_trade_tags: [
    { journal_tags: { kind: "mistake", name: "Moved stop loss" } },
    { journal_tags: { kind: "setup", name: "Range break" } },
    { journal_tags: { kind: "mistake", name: "Chased entry" } },
    { journal_tags: null },
  ],
};

describe("centsToDecimal", () => {
  it("is exact for signs, small values and large values", () => {
    expect(centsToDecimal(12345)).toBe("123.45");
    expect(centsToDecimal(-5)).toBe("-0.05");
    expect(centsToDecimal(0)).toBe("0.00");
    expect(centsToDecimal(-100)).toBe("-1.00");
    expect(centsToDecimal(100000000000)).toBe("1000000000.00");
  });
});

describe("exportRow", () => {
  it("maps amounts, strategy and tags by kind", () => {
    const row = exportRow(trade);
    expect(row).toMatchObject({
      result: "300.00",
      commission: "-10.50",
      swap: "-0.07",
      net: "289.43",
      strategy: "Breakout",
      setup_tags: "Range break",
      mistake_tags: "Chased entry; Moved stop loss",
      emotion_tags: "",
    });
  });

  it("computes net when the generated column is missing", () => {
    expect(exportRow({ ...trade, net_cents: null }).net).toBe("289.43");
  });

  it("produces a CSV with a header and formula-safe, quoted cells", () => {
    const csv = toCsv([exportRow(trade)], [...EXPORT_COLUMNS]);
    const [header, line] = csv.trim().split("\r\n");
    expect(header).toBe(EXPORT_COLUMNS.join(","));
    expect(line).toContain(`"'=HYPERLINK(""x"") and a ""quote"", comma"`);
    expect(line).toContain(",-10.50,");
  });
});
