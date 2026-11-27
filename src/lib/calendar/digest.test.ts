import { describe, expect, it } from "vitest";
import { digestEvents } from "./digest";
import type { CalendarEvent } from "./types";

const ev = (
  id: string,
  at: string,
  currency: CalendarEvent["currency"],
  impact: CalendarEvent["impact"],
) =>
  ({
    id,
    currency,
    impact,
    title: id,
    scheduledAt: at,
    forecast: null,
    previous: null,
    actual: null,
  }) satisfies CalendarEvent;

describe("digestEvents", () => {
  const events = [
    ev("late", "2026-11-23T20:30:00Z", "USD", "high"),
    ev("early", "2026-11-23T13:30:00Z", "USD", "high"),
    ev("medium", "2026-11-23T14:00:00Z", "USD", "medium"),
    ev("other-ccy", "2026-11-23T09:00:00Z", "GBP", "high"),
    // 02:00 UTC on the 24th is still the 23rd in New York.
    ev("after-midnight-utc", "2026-11-24T02:00:00Z", "EUR", "high"),
    ev("tomorrow", "2026-11-24T13:30:00Z", "USD", "high"),
  ];

  it("keeps today's high-impact events for chosen currencies in local time order", () => {
    const out = digestEvents(events, {
      currencies: ["USD", "EUR"],
      localDay: "2026-11-23",
      timezone: "America/New_York",
    });
    expect(out.map((e) => [e.id, e.localTime])).toEqual([
      ["early", "08:30"],
      ["late", "15:30"],
      ["after-midnight-utc", "21:00"],
    ]);
  });

  it("uses the member's own day boundary", () => {
    const out = digestEvents(events, {
      currencies: ["EUR"],
      localDay: "2026-11-24",
      timezone: "Asia/Tokyo",
    });
    expect(out.map((e) => e.id)).toEqual(["after-midnight-utc"]);
  });
});
