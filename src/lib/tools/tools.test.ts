import { describe, expect, it } from "vitest";
import { dailyRoom, recoveryPercent, type DailyRoomInput } from "./drawdown";
import { floorToStep, lotSize, pipValueAndMargin, pipValuePerLot, riskReward } from "./forex";
import { conversionFor, conversionPair, instrument } from "./instruments";
import { addBusinessDays, payout } from "./payout";
import {
  localDay,
  marketOpenAt,
  marketWeek,
  overlapSegments,
  sessionSegments,
  sessionWindows,
  zonedInstant,
} from "./sessions";

const close = (a: number, b: number, digits = 6) => expect(a).toBeCloseTo(b, digits);

describe("pip values", () => {
  it("is $10 per lot on USD-quoted majors in a USD account", () => {
    const r = pipValuePerLot(instrument("EURUSD"), { account: "USD" });
    expect(r.ok && r.value).toBeCloseTo(10, 9);
  });

  it("uses a 0.01 pip on JPY pairs and divides by the price for a USD account", () => {
    expect(instrument("USDJPY").pipSize).toBe(0.01);
    const r = pipValuePerLot(instrument("USDJPY"), { account: "USD", price: 150 });
    expect(r.ok && r.value).toBeCloseTo(1000 / 150, 9);
  });

  it("asks for the instrument price when the account currency is the base", () => {
    expect(pipValuePerLot(instrument("USDJPY"), { account: "USD" })).toEqual({
      ok: false,
      missing: "price",
    });
  });

  it("converts a JPY cross through USDJPY for a USD account", () => {
    const inst = instrument("EURJPY");
    expect(conversionPair(inst, "USD")).toBe("USDJPY");
    const r = pipValuePerLot(inst, { account: "USD", rate: 160 });
    expect(r.ok && r.value).toBeCloseTo(1000 / 160, 9);
  });

  it("multiplies when the quote currency is the base of the conversion pair", () => {
    // EURGBP profit is in GBP; a USD account converts it at the GBPUSD price.
    const inst = instrument("EURGBP");
    expect(conversionFor(inst, "USD")).toEqual({
      kind: "pair",
      pair: "GBPUSD",
      accountIsBase: false,
    });
    const r = pipValuePerLot(inst, { account: "USD", rate: 1.25 });
    expect(r.ok && r.value).toBeCloseTo(12.5, 9);
  });

  it("values gold at $10 per pip per lot and honours a broker contract override", () => {
    const gold = instrument("XAUUSD");
    expect(gold.pipSize).toBe(0.1);
    const r = pipValuePerLot(gold, { account: "USD" });
    expect(r.ok && r.value).toBeCloseTo(10, 9);
    const small = pipValuePerLot(gold, { account: "USD", contractSize: 10 });
    expect(small.ok && small.value).toBeCloseTo(1, 9);
  });

  it("values silver at $50 per pip on a 5,000 oz lot", () => {
    const r = pipValuePerLot(instrument("XAGUSD"), { account: "USD" });
    expect(r.ok && r.value).toBeCloseTo(50, 9);
  });

  it("values a EUR index point in a USD account through EURUSD", () => {
    const r = pipValuePerLot(instrument("GER40"), { account: "USD", rate: 1.1 });
    expect(r.ok && r.value).toBeCloseTo(1.1, 9);
  });
});

describe("lot size", () => {
  it("sizes 1% risk with a 20 pip stop on EURUSD", () => {
    const r = lotSize(instrument("EURUSD"), {
      account: "USD",
      balance: 100_000,
      risk: { mode: "percent", value: 1 },
      stopPips: 20,
      lotStep: 0.01,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lots).toBe(5);
    close(r.moneyAtRisk, 1000);
    close(r.riskPercent, 1);
  });

  it("rounds down to the lot step so risk never exceeds the request", () => {
    const r = lotSize(instrument("XAUUSD"), {
      account: "USD",
      balance: 50_000,
      risk: { mode: "amount", value: 333 },
      stopPips: 70,
      lotStep: 0.01,
    });
    if (!r.ok) throw new Error("expected result");
    expect(r.lots).toBe(0.47);
    expect(r.moneyAtRisk).toBeLessThanOrEqual(333);
  });

  it("flags a risk too small for the minimum lot", () => {
    const r = lotSize(instrument("US30"), {
      account: "USD",
      balance: 5_000,
      risk: { mode: "amount", value: 5 },
      stopPips: 1000,
      lotStep: 0.01,
    });
    if (!r.ok) throw new Error("expected result");
    expect(r.belowMinimum).toBe(true);
  });

  it("warns when the loss would exceed the remaining daily room", () => {
    const r = lotSize(instrument("EURUSD"), {
      account: "USD",
      balance: 100_000,
      risk: { mode: "percent", value: 2 },
      stopPips: 10,
      lotStep: 0.01,
      dailyRoom: 1500,
    });
    if (!r.ok) throw new Error("expected result");
    expect(r.exceedsDailyRoom).toBe(true);
  });

  it("floors with binary noise absorbed", () => {
    expect(floorToStep(0.3, 0.01)).toBe(0.3);
    expect(floorToStep(1.239, 0.01)).toBe(1.23);
    expect(floorToStep(7, 1)).toBe(7);
    expect(floorToStep(-1, 0.01)).toBe(0);
  });
});

describe("margin", () => {
  it("computes notional and margin in the account currency", () => {
    const r = pipValueAndMargin(instrument("EURUSD"), {
      account: "USD",
      lots: 2,
      price: 1.08,
      leverage: 100,
    });
    if (!r.ok) throw new Error("expected result");
    close(r.notional, 216_000);
    close(r.margin, 2160);
    close(r.pipValue, 20);
  });

  it("uses base units when the account is the base currency", () => {
    const r = pipValueAndMargin(instrument("USDJPY"), {
      account: "USD",
      lots: 1,
      price: 150,
      leverage: 50,
    });
    if (!r.ok) throw new Error("expected result");
    close(r.notional, 100_000);
    close(r.margin, 2000);
  });
});

describe("risk/reward", () => {
  it("returns the ratio and breakeven win rate", () => {
    const r = riskReward(50, 100);
    close(r.ratio, 2);
    close(r.breakevenPercent, 100 / 3);
  });
});

const base: DailyRoomInput = {
  initial: 100_000,
  dailyPercent: 5,
  dailyBasis: "initial",
  dayStart: 100_000,
  maxPercent: 10,
  drawdown: "static",
  lockAtInitial: false,
  balance: 100_000,
  floating: 0,
  costs: 0,
};

describe("daily room", () => {
  it("static: floors at the starting size less the limit", () => {
    const r = dailyRoom({ ...base, balance: 98_000, floating: -500, costs: -20 });
    close(r.equity, 97_480);
    close(r.dailyFloor, 95_000);
    close(r.dailyRoom, 2480);
    close(r.maxFloor, 90_000);
    expect(r.binding).toBe("daily");
    expect(r.status).toBe("clear");
  });

  it("measures the daily limit from the day's start when the firm does", () => {
    const r = dailyRoom({
      ...base,
      dailyBasis: "dayStart",
      dayStart: 110_000,
      balance: 110_000,
      peak: 110_000,
    });
    close(r.dailyLimit, 5500);
    close(r.dailyFloor, 104_500);
  });

  it("trailing: the floor follows the equity high, including open profit", () => {
    const r = dailyRoom({
      ...base,
      drawdown: "trailing",
      peak: 104_000,
      balance: 104_000,
      floating: 2000,
      dayStart: 104_000,
    });
    close(r.maxFloor, 96_000);
    close(r.maxRoom, 10_000);
  });

  it("trailing with a lock stops at the starting size", () => {
    const r = dailyRoom({
      ...base,
      drawdown: "trailing",
      lockAtInitial: true,
      peak: 115_000,
      balance: 112_000,
      dayStart: 112_000,
    });
    close(r.maxFloor, 100_000);
  });

  it("end-of-day trailing ignores today's intraday high", () => {
    const r = dailyRoom({
      ...base,
      drawdown: "eod",
      peak: 102_000,
      balance: 102_000,
      floating: 3000,
      dayStart: 102_000,
    });
    close(r.maxFloor, 92_000);
    close(r.maxRoom, 13_000);
    expect(r.binding).toBe("daily");
  });

  it("marks a breach and a close call", () => {
    expect(dailyRoom({ ...base, balance: 94_900 }).status).toBe("breached");
    expect(dailyRoom({ ...base, balance: 95_900 }).status).toBe("close");
  });

  it("max loss binds when it is nearer than the daily floor", () => {
    const r = dailyRoom({ ...base, balance: 91_000, dayStart: 91_500 });
    expect(r.binding).toBe("max");
    close(r.room, 1000);
  });

  it("computes the gain needed to recover", () => {
    close(recoveryPercent(50), 100);
    close(recoveryPercent(10), 11.111111);
    expect(recoveryPercent(100)).toBe(Infinity);
  });
});

describe("payout", () => {
  it("applies the buffer, split and fee", () => {
    const r = payout({
      profit: 6000,
      splitPercent: 80,
      buffer: 1000,
      fee: 25,
      minimum: 100,
      processingDays: 3,
      requestDate: "2026-11-20",
    });
    close(r.withdrawable, 5000);
    close(r.traderShare, 4000);
    close(r.firmShare, 1000);
    close(r.received, 3975);
    expect(r.meetsMinimum).toBe(true);
    expect(r.expectedDate).toBe("2026-11-25");
  });

  it("reports the profit still needed for the minimum", () => {
    const r = payout({
      profit: 1100,
      splitPercent: 80,
      buffer: 1000,
      fee: 0,
      minimum: 200,
      processingDays: 0,
    });
    expect(r.meetsMinimum).toBe(false);
    close(r.shortfall, 150);
    expect(r.expectedDate).toBeNull();
  });

  it("skips weekends when adding business days", () => {
    expect(addBusinessDays("2026-11-27", 1)).toBe("2026-11-30");
    expect(addBusinessDays("2026-11-28", 0)).toBe("2026-11-28");
    expect(() => addBusinessDays("2026-02-30x", 1)).toThrow();
  });
});

describe("sessions", () => {
  it("resolves wall times across daylight saving", () => {
    // London is UTC+0 in January and UTC+1 in July.
    expect(zonedInstant("Europe/London", 2026, 1, 15, 8).toISOString()).toBe(
      "2026-01-15T08:00:00.000Z",
    );
    expect(zonedInstant("Europe/London", 2026, 7, 15, 8).toISOString()).toBe(
      "2026-07-15T07:00:00.000Z",
    );
    // A skipped hour resolves after the gap (New York, 8 March 2026, 02:30 does not exist).
    expect(zonedInstant("America/New_York", 2026, 3, 8, 2, 30).toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
  });

  it("is closed from Friday 17:00 to Sunday 17:00 New York time", () => {
    expect(marketOpenAt(new Date("2026-11-20T21:59:00Z"))).toBe(true); // Fri 16:59 EST
    expect(marketOpenAt(new Date("2026-11-20T22:00:00Z"))).toBe(false); // Fri 17:00 EST
    expect(marketOpenAt(new Date("2026-11-22T21:59:00Z"))).toBe(false); // Sun 16:59 EST
    expect(marketOpenAt(new Date("2026-11-22T22:00:00Z"))).toBe(true);
  });

  it("finds the next rollover, weekly close and weekly open", () => {
    const w = marketWeek(new Date("2026-11-18T12:00:00Z")); // Wednesday
    expect(w.rollover.toISOString()).toBe("2026-11-18T22:00:00.000Z");
    expect(w.weeklyClose.toISOString()).toBe("2026-11-20T22:00:00.000Z");
    expect(w.weeklyOpen.toISOString()).toBe("2026-11-22T22:00:00.000Z");
  });

  it("reports London open and the next Tokyo session on a weekday morning", () => {
    const now = new Date("2026-11-18T10:00:00Z");
    const byKey = Object.fromEntries(sessionWindows(now).map((s) => [s.key, s]));
    expect(byKey.london?.open).toBe(true);
    expect(byKey.london?.end.toISOString()).toBe("2026-11-18T17:00:00.000Z");
    expect(byKey.tokyo?.open).toBe(false);
    expect(byKey.tokyo?.start.toISOString()).toBe("2026-11-19T00:00:00.000Z");
  });

  it("skips weekend sessions", () => {
    const now = new Date("2026-11-21T12:00:00Z"); // Saturday
    const byKey = Object.fromEntries(sessionWindows(now).map((s) => [s.key, s]));
    expect(byKey.london?.start.toISOString()).toBe("2026-11-23T08:00:00.000Z");
    expect(Object.values(byKey).every((s) => !s.open)).toBe(true);
  });

  it("draws a London weekday timeline with the London/New York overlap", () => {
    const day = localDay(new Date("2026-11-18T10:00:00Z"), "Europe/London");
    expect(day.start.toISOString()).toBe("2026-11-18T00:00:00.000Z");
    const segs = sessionSegments(day.start, day.end);
    expect(segs.london.map((s) => [s.start.toISOString(), s.end.toISOString()])).toEqual([
      ["2026-11-18T08:00:00.000Z", "2026-11-18T17:00:00.000Z"],
    ]);
    // New York 08:00–17:00 EST is 13:00–22:00 UTC.
    const overlap = overlapSegments(segs).map((s) => [s.start.toISOString(), s.end.toISOString()]);
    expect(overlap).toContainEqual(["2026-11-18T13:00:00.000Z", "2026-11-18T17:00:00.000Z"]);
  });

  it("clips the Monday Sydney session to the Sunday 17:00 New York open", () => {
    const day = localDay(new Date("2026-11-22T12:00:00Z"), "UTC"); // Sunday
    const segs = sessionSegments(day.start, day.end);
    // Sydney Monday 07:00 AEDT is Sunday 20:00 UTC; the market opens at 22:00 UTC, so the bar starts there.
    expect(segs.sydney.map((s) => s.start.toISOString())).toEqual(["2026-11-22T22:00:00.000Z"]);
    expect(segs.london).toEqual([]);
  });
});

describe("calendar fixture", () => {
  it("repeats the fictional week, sorted, with actuals only after release", async () => {
    const { fixtureEvents, weekStartUtc } = await import("@/lib/calendar/fixture");
    expect(weekStartUtc(new Date("2026-11-22T12:00:00Z")).toISOString()).toBe(
      "2026-11-16T00:00:00.000Z",
    );
    const from = new Date("2026-11-16T00:00:00Z"),
      to = new Date("2026-11-30T00:00:00Z");
    const events = fixtureEvents(from, to, new Date("2026-11-20T13:30:00Z"));
    expect(events.length).toBeGreaterThan(30);
    expect(events.map((e) => e.scheduledAt)).toEqual([...events.map((e) => e.scheduledAt)].sort());
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    const payrolls = events.filter((e) => e.id.startsWith("fixture:us-payrolls"));
    expect(payrolls.map((e) => [e.scheduledAt, e.actual !== null])).toEqual([
      ["2026-11-20T13:30:00.000Z", true],
      ["2026-11-27T13:30:00.000Z", false],
    ]);
    expect(events.every((e) => e.title.startsWith("Sample"))).toBe(true);
  });
});

describe("consistency rule", () => {
  it("reports the share, the profit still needed and today's cap", async () => {
    const { consistency } = await import("./rules");
    const r = consistency({ profit: 4000, bestDay: 1600, limitPercent: 30 });
    close(r.share, 40);
    expect(r.passes).toBe(false);
    close(r.neededTotal, 1600 / 0.3);
    close(r.moreNeeded, 1600 / 0.3 - 4000);
    // Today's cap where today alone would be 30% of the total: 0.3 × 4000 / 0.7.
    close(r.maxToday, 1714.285714);
    const ok = consistency({ profit: 10000, bestDay: 2000, limitPercent: 30 });
    expect(ok.passes).toBe(true);
    expect(ok.moreNeeded).toBe(0);
  });
});

describe("challenge cost", () => {
  it("counts discount, attempts and a first-payout refund", async () => {
    const { challengeCost } = await import("./rules");
    const r = challengeCost({
      fee: 500,
      discountPercent: 20,
      attempts: 3,
      refund: true,
      splitPercent: 80,
    });
    close(r.perAttempt, 400);
    close(r.total, 1200);
    close(r.breakEvenPayout, 800);
    close(r.breakEvenProfit, 1000);
    const noRefund = challengeCost({
      fee: 100,
      discountPercent: 0,
      attempts: 2,
      refund: false,
      splitPercent: 90,
    });
    close(noRefund.breakEvenPayout, 200);
  });
});

describe("indicative prices", () => {
  it("derives crosses and gold from the USD majors", async () => {
    const { derivePrice, roundPrice, usdValues } = await import("@/lib/prices/derive");
    const usd = usdValues({
      "EUR/USD": 1.08,
      "USD/JPY": 150,
      "GBP/USD": 1.25,
      "XAU/USD": 2400,
      "USD/CAD": 0,
    });
    close(derivePrice("EURJPY", usd)!, 162);
    close(derivePrice("EURGBP", usd)!, 0.864);
    close(derivePrice("XAUUSD", usd)!, 2400);
    close(derivePrice("USDJPY", usd)!, 150);
    expect(derivePrice("USDCAD", usd)).toBeNull(); // a zero quote is ignored
    expect(derivePrice("US30", usd)).toBeNull();
    expect(roundPrice("EURJPY", 162.123456)).toBe(162.123);
    expect(roundPrice("EURUSD", 1.0812345)).toBe(1.08123);
  });
});
