import { describe, expect, it } from "vitest";
import { fromMinor, sessionAt, toMinor, tradeMetrics } from "./compute";
import { summarize, type StatTrade } from "./stats";

describe("trade metrics", () => {
  it("computes pips and R for longs and shorts, including JPY and gold", () => {
    expect(
      tradeMetrics({
        symbol: "EURUSD",
        direction: "long",
        entry: 1.1,
        exit: 1.102,
        stopLoss: 1.099,
        closedAt: new Date("2026-11-18T10:00:00Z"),
      }),
    ).toEqual({ pips: 20, r: 2, session: "london" });
    expect(
      tradeMetrics({
        symbol: "USDJPY",
        direction: "short",
        entry: 150,
        exit: 150.5,
        stopLoss: 150.25,
        closedAt: new Date("2026-11-18T07:30:00Z"),
      }),
    ).toMatchObject({ pips: -50, r: -2, session: "asia" });
    expect(
      tradeMetrics({
        symbol: "XAUUSD",
        direction: "long",
        entry: 2000,
        exit: 2003.5,
        closedAt: new Date("2026-11-18T14:00:00Z"),
      }),
    ).toMatchObject({ pips: 35, r: null, session: "overlap" });
    expect(
      tradeMetrics({
        symbol: "BTCUSD",
        direction: "long",
        entry: 1,
        exit: 2,
        closedAt: new Date("2026-11-18T14:00:00Z"),
      }).pips,
    ).toBeNull();
  });

  it("labels sessions with daylight saving and the weekend", () => {
    // 07:30 UTC in July is 08:30 in London (BST) and 16:30 in Tokyo: both open.
    expect(sessionAt(new Date("2026-07-15T07:30:00Z"))).toBe("overlap");
    // 09:30 UTC in July: London only (Tokyo closed at 18:00, New York not open yet).
    expect(sessionAt(new Date("2026-07-15T09:30:00Z"))).toBe("london");
    // 18:30 UTC is 13:30 in New York and before the Sydney open (05:30 AEDT).
    expect(sessionAt(new Date("2026-11-18T18:30:00Z"))).toBe("new_york");
    expect(sessionAt(new Date("2026-11-21T12:00:00Z"))).toBe("off");
  });

  it("converts money strings to minor units without floats", () => {
    expect(toMinor("125.5")).toBe(12550);
    expect(toMinor("-0.07")).toBe(-7);
    expect(toMinor("-0")).toBe(0);
    expect(toMinor("1,000")).toBeNull();
    expect(toMinor("1.234")).toBeNull();
    expect(fromMinor(-12550)).toBe("-125.50");
    expect(fromMinor(7)).toBe("0.07");
  });
});

const trade = (over: Partial<StatTrade>): StatTrade => ({
  id: crypto.randomUUID(),
  closed_at: "2026-11-16T10:00:00Z",
  local_day: "2026-11-16",
  symbol: "EURUSD",
  direction: "long",
  session: "london",
  strategy_id: null,
  net_cents: 0,
  r_multiple: null,
  tags: [],
  ...over,
});

describe("summary", () => {
  it("computes win rate, profit factor, average R, runs, equity and mistake cost", () => {
    const mistake = { id: "m1", kind: "mistake", name: "Revenge trade" };
    const s = summarize([
      trade({ closed_at: "2026-11-16T10:00:00Z", net_cents: 10_000, r_multiple: 2 }),
      trade({ closed_at: "2026-11-16T11:00:00Z", net_cents: 5_000, r_multiple: 1 }),
      trade({
        closed_at: "2026-11-17T10:00:00Z",
        local_day: "2026-11-17",
        net_cents: -4_000,
        r_multiple: -1,
        tags: [mistake],
      }),
      trade({
        closed_at: "2026-11-17T11:00:00Z",
        local_day: "2026-11-17",
        net_cents: -1_000,
        tags: [mistake],
        symbol: "GBPUSD",
      }),
      trade({ closed_at: "2026-11-18T11:00:00Z", local_day: "2026-11-18", net_cents: 0 }),
    ]);
    expect(s).toMatchObject({
      trades: 5,
      wins: 2,
      losses: 2,
      net: 10_000,
      winRate: 50,
      profitFactor: 3,
      avgR: 2 / 3,
      best: 10_000,
      worst: -4_000,
      longestWin: 2,
      longestLoss: 2,
    });
    expect(s.equity).toEqual([
      { day: "2026-11-16", value: 15_000 },
      { day: "2026-11-17", value: 10_000 },
      { day: "2026-11-18", value: 10_000 },
    ]);
    expect(s.mistakes).toEqual([{ id: "m1", name: "Revenge trade", trades: 2, cost: -5_000 }]);
    expect(s.bySymbol.map((b) => b.key)).toEqual(["EURUSD", "GBPUSD"]);
    expect(s.byWeekday.map((b) => b.key)).toEqual(["0", "1", "2"]);
  });

  it("handles an empty period", () => {
    expect(summarize([])).toMatchObject({
      trades: 0,
      winRate: null,
      profitFactor: null,
      avgR: null,
      best: null,
    });
  });
});

describe("trade form", () => {
  it("parses a full trade, rule choices and repeated tags", async () => {
    const { readTradeForm, fromLocalInput } = await import("./schema");
    const tag = crypto.randomUUID(),
      rule = crypto.randomUUID(),
      other = crypto.randomUUID();
    const form = new FormData();
    for (const [k, v] of Object.entries({
      symbol: "eur/usd",
      direction: "short",
      closed: "2026-11-18T10:05",
      opened: "2026-11-18T09:00",
      currency: "USD",
      result: "-45.20",
      commission: "-3.5",
      entry: "1.1",
      stopLoss: "1.1",
      lots: "0.5",
    }))
      form.set(k, v);
    form.append("tags", tag);
    form.set(`rule:${rule}`, "followed");
    form.set(`rule:${other}`, "");
    const parsed = readTradeForm(form);
    expect(parsed.success).toBe(false); // entry equals stop loss
    form.set("stopLoss", "1.105");
    const ok = readTradeForm(form);
    expect(ok.success && ok.data).toMatchObject({
      symbol: "EURUSD",
      result: -4520,
      commission: -350,
      tags: [tag],
      followed: [rule],
      broken: [],
    });
    expect(fromLocalInput("2026-11-18T10:05", "America/New_York").toISOString()).toBe(
      "2026-11-18T15:05:00.000Z",
    );
  });

  it("rejects an open time after the close", async () => {
    const { readTradeForm } = await import("./schema");
    const form = new FormData();
    for (const [k, v] of Object.entries({
      symbol: "EURUSD",
      direction: "long",
      closed: "2026-11-18T10:00",
      opened: "2026-11-18T11:00",
      currency: "USD",
      result: "1",
    }))
      form.set(k, v);
    const parsed = readTradeForm(form);
    expect(parsed.success).toBe(false);
    expect(!parsed.success && parsed.error.issues[0]?.path).toEqual(["opened"]);
  });
});

describe("journal dates", () => {
  it("does calendar arithmetic and local inputs across zones", async () => {
    const { addDays, localInput, monthEnd, shiftMonth, todayIn } = await import("./dates");
    expect(["2026-02", "2028-02", "2026-11", "2026-12"].map(monthEnd)).toEqual([
      "2026-02-28",
      "2028-02-29",
      "2026-11-30",
      "2026-12-31",
    ]);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(todayIn("America/Los_Angeles", new Date("2026-11-22T05:00:00Z"))).toBe("2026-11-21");
    expect(localInput(new Date("2026-11-22T05:00:00Z"), "Asia/Kolkata")).toBe("2026-11-22T10:30");
  });
});
