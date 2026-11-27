import type { CalendarEvent, CalendarProvider, CalendarCurrency, Impact } from "./types";

/**
 * Fictional events repeated every week, so the calendar can be built and tested before a licensed
 * feed exists. Titles are generic and figures are invented; the page labels them as samples.
 */
type Template = {
  key: string;
  /** 0 = Monday. */
  weekday: number;
  /** UTC time. */
  hour: number;
  minute: number;
  currency: CalendarCurrency;
  title: string;
  impact: Impact;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

const TEMPLATES: readonly Template[] = [
  {
    key: "au-sentiment",
    weekday: 0,
    hour: 0,
    minute: 30,
    currency: "AUD",
    title: "Sample business sentiment index",
    impact: "low",
    forecast: "4",
    previous: "3",
    actual: "5",
  },
  {
    key: "eu-confidence",
    weekday: 0,
    hour: 9,
    minute: 0,
    currency: "EUR",
    title: "Sample investor confidence survey",
    impact: "medium",
    forecast: "-12.0",
    previous: "-13.4",
    actual: "-11.8",
  },
  {
    key: "us-manufacturing",
    weekday: 0,
    hour: 15,
    minute: 0,
    currency: "USD",
    title: "Sample manufacturing activity index",
    impact: "high",
    forecast: "49.5",
    previous: "48.7",
    actual: "49.9",
  },
  {
    key: "jp-wages",
    weekday: 1,
    hour: 0,
    minute: 0,
    currency: "JPY",
    title: "Sample average wages y/y",
    impact: "low",
    forecast: "2.1%",
    previous: "1.9%",
    actual: "2.3%",
  },
  {
    key: "au-rate",
    weekday: 1,
    hour: 3,
    minute: 30,
    currency: "AUD",
    title: "Sample central bank rate decision",
    impact: "high",
    forecast: "4.10%",
    previous: "4.10%",
    actual: "4.10%",
  },
  {
    key: "uk-jobs",
    weekday: 1,
    hour: 7,
    minute: 0,
    currency: "GBP",
    title: "Sample claimant count change",
    impact: "medium",
    forecast: "18K",
    previous: "22K",
    actual: "15K",
  },
  {
    key: "us-openings",
    weekday: 1,
    hour: 15,
    minute: 0,
    currency: "USD",
    title: "Sample job openings report",
    impact: "medium",
    forecast: "7.60M",
    previous: "7.52M",
    actual: "7.71M",
  },
  {
    key: "ca-cpi",
    weekday: 2,
    hour: 13,
    minute: 30,
    currency: "CAD",
    title: "Sample consumer prices m/m",
    impact: "high",
    forecast: "0.2%",
    previous: "0.3%",
    actual: "0.1%",
  },
  {
    key: "uk-cpi",
    weekday: 2,
    hour: 7,
    minute: 0,
    currency: "GBP",
    title: "Sample consumer prices y/y",
    impact: "high",
    forecast: "2.6%",
    previous: "2.8%",
    actual: "2.5%",
  },
  {
    key: "us-crude",
    weekday: 2,
    hour: 15,
    minute: 30,
    currency: "USD",
    title: "Sample crude inventories",
    impact: "low",
    forecast: "-1.2M",
    previous: "2.4M",
    actual: "-0.8M",
  },
  {
    key: "us-minutes",
    weekday: 2,
    hour: 19,
    minute: 0,
    currency: "USD",
    title: "Sample policy meeting minutes",
    impact: "high",
    forecast: null,
    previous: null,
    actual: null,
  },
  {
    key: "nz-trade",
    weekday: 2,
    hour: 21,
    minute: 45,
    currency: "NZD",
    title: "Sample trade balance",
    impact: "low",
    forecast: "-0.9B",
    previous: "-1.1B",
    actual: "-0.7B",
  },
  {
    key: "au-employment",
    weekday: 3,
    hour: 0,
    minute: 30,
    currency: "AUD",
    title: "Sample employment change",
    impact: "high",
    forecast: "25.0K",
    previous: "31.2K",
    actual: "19.6K",
  },
  {
    key: "ch-rate",
    weekday: 3,
    hour: 8,
    minute: 30,
    currency: "CHF",
    title: "Sample policy rate decision",
    impact: "high",
    forecast: "0.50%",
    previous: "0.50%",
    actual: "0.50%",
  },
  {
    key: "eu-rate",
    weekday: 3,
    hour: 13,
    minute: 15,
    currency: "EUR",
    title: "Sample main refinancing rate",
    impact: "high",
    forecast: "2.75%",
    previous: "2.75%",
    actual: "2.75%",
  },
  {
    key: "us-claims",
    weekday: 3,
    hour: 13,
    minute: 30,
    currency: "USD",
    title: "Sample weekly jobless claims",
    impact: "medium",
    forecast: "221K",
    previous: "218K",
    actual: "226K",
  },
  {
    key: "cn-output",
    weekday: 4,
    hour: 2,
    minute: 0,
    currency: "CNY",
    title: "Sample industrial output y/y",
    impact: "medium",
    forecast: "5.4%",
    previous: "5.1%",
    actual: "5.6%",
  },
  {
    key: "jp-cpi",
    weekday: 4,
    hour: 23,
    minute: 30,
    currency: "JPY",
    title: "Sample national consumer prices",
    impact: "medium",
    forecast: "2.4%",
    previous: "2.5%",
    actual: "2.4%",
  },
  {
    key: "uk-retail",
    weekday: 4,
    hour: 7,
    minute: 0,
    currency: "GBP",
    title: "Sample retail sales m/m",
    impact: "medium",
    forecast: "0.3%",
    previous: "-0.2%",
    actual: "0.4%",
  },
  {
    key: "us-payrolls",
    weekday: 4,
    hour: 13,
    minute: 30,
    currency: "USD",
    title: "Sample non-farm employment change",
    impact: "high",
    forecast: "165K",
    previous: "142K",
    actual: "188K",
  },
  {
    key: "ca-jobs",
    weekday: 4,
    hour: 13,
    minute: 30,
    currency: "CAD",
    title: "Sample employment change",
    impact: "high",
    forecast: "20.0K",
    previous: "14.6K",
    actual: "26.1K",
  },
  {
    key: "us-sentiment",
    weekday: 4,
    hour: 15,
    minute: 0,
    currency: "USD",
    title: "Sample consumer sentiment",
    impact: "medium",
    forecast: "71.0",
    previous: "70.2",
    actual: "69.4",
  },
];

const DAY = 86_400_000;

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStartUtc(d: Date) {
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const weekday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - weekday * DAY);
}

export function fixtureEvents(from: Date, to: Date, now: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let week = weekStartUtc(from).getTime(); week < to.getTime(); week += 7 * DAY) {
    for (const tpl of TEMPLATES) {
      const at = week + tpl.weekday * DAY + (tpl.hour * 60 + tpl.minute) * 60_000;
      if (at < from.getTime() || at >= to.getTime()) continue;
      const scheduledAt = new Date(at).toISOString();
      events.push({
        id: `fixture:${tpl.key}:${scheduledAt.slice(0, 10)}`,
        currency: tpl.currency,
        title: tpl.title,
        impact: tpl.impact,
        scheduledAt,
        forecast: tpl.forecast,
        previous: tpl.previous,
        // A figure is only "released" once its time has passed.
        actual: at <= now.getTime() ? tpl.actual : null,
      });
    }
  }
  return events.sort(
    (a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.currency.localeCompare(b.currency),
  );
}

export const fixtureProvider: CalendarProvider = {
  name: "fixture",
  licensed: false,
  async events(from, to) {
    return fixtureEvents(from, to, new Date());
  },
};
