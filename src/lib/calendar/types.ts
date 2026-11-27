export const IMPACTS = ["low", "medium", "high"] as const;
export type Impact = (typeof IMPACTS)[number];

export const CALENDAR_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "NZD",
  "CNY",
] as const;
export type CalendarCurrency = (typeof CALENDAR_CURRENCIES)[number];

export type CalendarEvent = {
  /** Stable provider id, used for alert de-duplication later. */
  id: string;
  currency: CalendarCurrency;
  title: string;
  impact: Impact;
  /** ISO instant in UTC. */
  scheduledAt: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

export type CalendarFeed = {
  provider: string;
  /** False for fixture data: the page must say the events are fictional. */
  licensed: boolean;
  events: CalendarEvent[];
};

/**
 * A licensed economic calendar source (`16-trader-tools.md` §1). The owner picks the provider;
 * a new one implements this interface and is selected in `provider.ts`.
 */
export interface CalendarProvider {
  readonly name: string;
  readonly licensed: boolean;
  events(from: Date, to: Date): Promise<CalendarEvent[]>;
}
