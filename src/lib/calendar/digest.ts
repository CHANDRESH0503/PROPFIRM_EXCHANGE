import type { CalendarEvent } from "./types";

/**
 * Today's high-impact events for a member's currencies, in their timezone, earliest first.
 * Pure so the email content is unit-tested; the job supplies the provider's events.
 */
export function digestEvents(
  events: CalendarEvent[],
  opts: { currencies: string[]; localDay: string; timezone: string },
) {
  const wanted = new Set(opts.currencies);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: opts.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: opts.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return events
    .filter((e) => e.impact === "high" && wanted.has(e.currency))
    .filter((e) => day.format(new Date(e.scheduledAt)) === opts.localDay)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id))
    .map((e) => ({ ...e, localTime: time.format(new Date(e.scheduledAt)) }));
}
