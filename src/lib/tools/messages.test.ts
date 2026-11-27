import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import { CALCULATORS, calculator, evaluate, withDefaults, type Values } from "./calculators";

/**
 * The calculator UI looks copy up by registry data, so this test is the key check the compiler
 * cannot do (see src/components/tools/text.ts).
 */
const tools: unknown = messages.tools;

function lookup(path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node)
      return (node as Record<string, unknown>)[part];
    return undefined;
  }, tools);
}

const has = (path: string) => typeof lookup(path) === "string";

/** Inputs that make every row and note appear at least once. */
const SAMPLES: Record<string, Values[]> = {
  "lot-size": [
    { balance: "100000", risk: "1", stop: "20" },
    {
      balance: "5000",
      riskMode: "amount",
      risk: "1",
      stop: "500",
      symbol: "US30",
      dailyRoom: "0.5",
    },
  ],
  "pip-value": [{ lots: "1", price: "1.08", leverage: "100" }],
  "daily-room": [
    {
      initial: "100000",
      dailyPercent: "5",
      maxPercent: "10",
      dayStart: "100000",
      balance: "99000",
      stopPips: "20",
    },
    {
      initial: "100000",
      dailyPercent: "5",
      maxPercent: "10",
      dayStart: "100000",
      balance: "94000",
    },
    {
      initial: "100000",
      dailyPercent: "5",
      maxPercent: "10",
      dayStart: "100000",
      balance: "95500",
    },
    { initial: "100000", dailyPercent: "5", maxPercent: "10", dayStart: "91500", balance: "91000" },
  ],
  payout: [
    { profit: "6000", split: "80", requestDate: "2026-11-20", processingDays: "3" },
    { profit: "100", split: "80", minimum: "500" },
  ],
  "risk-reward": [{ loss: "50", gain: "100" }],
  "drawdown-recovery": [{ loss: "10", balance: "1000" }],
  consistency: [
    { profit: "4000", bestDay: "1600", limit: "30" },
    { profit: "10000", bestDay: "2000", limit: "30" },
  ],
  "challenge-cost": [{ fee: "500", discount: "20", attempts: "3", refund: "yes", split: "80" }],
};

describe("calculator copy", () => {
  it.each(CALCULATORS)("%s has page, field and option copy", (key) => {
    const calc = calculator(key);
    for (const k of ["title", "metaDescription", "short", "intro"])
      expect(has(`${key}.${k}`), `${key}.${k}`).toBe(true);
    expect(Array.isArray(lookup(`${key}.explain`))).toBe(true);
    for (const f of calc.fields) {
      expect(has(`${key}.fields.${f.name}.label`), `${key}.fields.${f.name}.label`).toBe(true);
      expect(has(`groups.${f.group}`), `groups.${f.group}`).toBe(true);
      if (f.kind === "select" && !f.literal) {
        for (const o of f.options)
          expect(has(`options.${f.name}.${o}`), `options.${f.name}.${o}`).toBe(true);
      }
    }
  });

  it.each(CALCULATORS)("%s has copy for every row and note it produces", (key) => {
    const calc = calculator(key);
    const samples = SAMPLES[key] ?? [];
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) {
      const outcome = evaluate(calc, withDefaults(calc, sample));
      expect(outcome.status, JSON.stringify(sample)).toBe("ok");
      if (outcome.status !== "ok") continue;
      for (const r of outcome.rows)
        expect(has(`${key}.rows.${r.key}`), `${key}.rows.${r.key}`).toBe(true);
      for (const n of outcome.notes)
        expect(has(`${key}.notes.${n.key}`), `${key}.notes.${n.key}`).toBe(true);
    }
  });

  it("has every error message", () => {
    for (const code of ["required", "invalid", "positive", "integer", "range"])
      expect(has(`errors.${code}`)).toBe(true);
  });
});

describe("calculator evaluation", () => {
  const lot = calculator("lot-size");

  it("is empty until a number is typed", () => {
    expect(evaluate(lot, withDefaults(lot, {})).status).toBe("empty");
  });

  it("reports required, invalid and range errors per field", () => {
    const out = evaluate(lot, withDefaults(lot, { balance: "1,000", risk: "150", stop: "" }));
    expect(out).toEqual({
      status: "invalid",
      errors: { balance: { code: "invalid" }, stop: { code: "required" } },
    });
    const pct = evaluate(lot, withDefaults(lot, { balance: "1000", risk: "150", stop: "10" }));
    expect(pct).toEqual({
      status: "invalid",
      errors: { risk: { code: "range", min: 0, max: 100 } },
    });
  });

  it("asks for the conversion price only when the pair needs it", () => {
    const out = evaluate(
      lot,
      withDefaults(lot, { balance: "1000", risk: "1", stop: "10", symbol: "EURJPY" }),
    );
    expect(out).toEqual({ status: "invalid", errors: { rate: { code: "required" } } });
    const ok = evaluate(
      lot,
      withDefaults(lot, { balance: "1000", risk: "1", stop: "10", symbol: "EURJPY", rate: "155" }),
    );
    expect(ok.status).toBe("ok");
  });

  it("ignores values for hidden fields and unknown options", () => {
    const out = evaluate(
      lot,
      withDefaults(lot, { balance: "1000", risk: "1", stop: "10", price: "abc", symbol: "NOPE" }),
    );
    expect(out.status).toBe("ok");
  });

  it("rejects negatives on unsigned fields and accepts them on signed ones", () => {
    const room = calculator("daily-room");
    const base = {
      initial: "100000",
      dailyPercent: "5",
      maxPercent: "10",
      dayStart: "100000",
      balance: "99000",
    };
    expect(evaluate(room, withDefaults(room, { ...base, floating: "-250.5" })).status).toBe("ok");
    expect(evaluate(room, withDefaults(room, { ...base, balance: "-1" }))).toMatchObject({
      status: "invalid",
    });
  });
});
