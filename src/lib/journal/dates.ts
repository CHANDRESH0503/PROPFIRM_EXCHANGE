/** Calendar-day arithmetic on ISO dates (YYYY-MM-DD), independent of the server's timezone. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function todayIn(zone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(now);
}

export function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** datetime-local value (YYYY-MM-DDTHH:mm) for an instant in a zone. */
export function localInput(at: Date, zone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Last calendar day of a month (YYYY-MM), as an ISO date. */
export function monthEnd(month: string) {
  const d = new Date(`${month}-01T12:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12))
    .toISOString()
    .slice(0, 10);
}
