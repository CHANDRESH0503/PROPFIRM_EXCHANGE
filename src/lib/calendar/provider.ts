import "server-only";
import { connection } from "next/server";
import { fixtureProvider, weekStartUtc } from "./fixture";
import type { CalendarFeed, CalendarProvider } from "./types";

/**
 * The active calendar source. Only the fixture exists until the owner chooses a licensed provider
 * and adds its key; that provider is added here behind the same interface. Scraping is not allowed.
 */
export function calendarProvider(): CalendarProvider {
  return fixtureProvider;
}

const DAY = 86_400_000;

/**
 * Events from the start of last week's Sunday to the end of next week, which covers "today" and
 * "this week" in every timezone; the browser filters to the viewer's local days.
 */
export async function calendarFeed(): Promise<CalendarFeed> {
  await connection();
  const now = new Date();
  const from = new Date(weekStartUtc(now).getTime() - DAY);
  const to = new Date(weekStartUtc(now).getTime() + 15 * DAY);
  const provider = calendarProvider();
  return {
    provider: provider.name,
    licensed: provider.licensed,
    events: await provider.events(from, to),
  };
}
