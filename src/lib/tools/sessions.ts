/**
 * Forex session times. Each session is defined in its own city's local time, so daylight-saving
 * changes in Sydney, London and New York move the sessions correctly in every viewer's timezone.
 */

export const SESSIONS = [
  { key: "sydney", zone: "Australia/Sydney", open: 7, close: 16 },
  { key: "tokyo", zone: "Asia/Tokyo", open: 9, close: 18 },
  { key: "london", zone: "Europe/London", open: 8, close: 17 },
  { key: "newYork", zone: "America/New_York", open: 8, close: 17 },
] as const;

export type SessionKey = (typeof SESSIONS)[number]["key"];

/** The forex day rolls over, and the week opens and closes, at 17:00 New York time. */
export const ROLLOVER_ZONE = "America/New_York";
export const ROLLOVER_HOUR = 17;

type Wall = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string) {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    formatters.set(zone, f);
  }
  return f;
}

/** Wall-clock reading of an instant in a zone. */
export function wallTime(instant: Date, zone: string): Wall & { second: number } {
  const parts: Record<string, string> = {};
  for (const p of formatter(zone).formatToParts(instant)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday ?? "Sun"] ?? 0,
  };
}

function offsetMs(instant: Date, zone: string) {
  const w = wallTime(instant, zone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which a zone's clock shows the given wall time. A wall time skipped by a
 * spring-forward change resolves to the instant just after the gap.
 */
export function zonedInstant(
  zone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const HALF_DAY = 12 * 3_600_000;
  // The offset in force half a day either side covers any single transition.
  const before = guess - offsetMs(new Date(guess - HALF_DAY), zone);
  const after = guess - offsetMs(new Date(guess + HALF_DAY), zone);
  const matches = [before, after].filter((t) => {
    const w = wallTime(new Date(t), zone);
    return (
      w.year === year &&
      w.month === month &&
      w.day === day &&
      w.hour === hour &&
      w.minute === minute
    );
  });
  // Ambiguous fall-back times take the earlier instant; skipped times shift past the gap,
  // which the pre-transition offset produces.
  return new Date(matches.length ? Math.min(...matches) : before);
}

function addDays(w: { year: number; month: number; day: number }, n: number) {
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export type SessionWindow = { key: SessionKey; start: Date; end: Date; open: boolean };

/** The current or next window for each session, relative to `now`. */
export function sessionWindows(now: Date): SessionWindow[] {
  return SESSIONS.map((s) => {
    const today = wallTime(now, s.zone);
    for (const offset of [-1, 0, 1, 2]) {
      const d = addDays(today, offset);
      const start = zonedInstant(s.zone, d.year, d.month, d.day, s.open);
      const end = zonedInstant(s.zone, d.year, d.month, d.day, s.close);
      // Sessions do not run while the market is closed for the weekend.
      if (!marketOpenAt(start) && !marketOpenAt(new Date(end.getTime() - 1))) continue;
      if (end > now) return { key: s.key, start, end, open: start <= now && marketOpenAt(now) };
    }
    throw new Error("session_window_unresolved");
  });
}

/** True between Sunday 17:00 and Friday 17:00, New York time. */
export function marketOpenAt(instant: Date) {
  const w = wallTime(instant, ROLLOVER_ZONE);
  if (w.weekday === 6) return false;
  if (w.weekday === 5) return w.hour < ROLLOVER_HOUR;
  if (w.weekday === 0) return w.hour >= ROLLOVER_HOUR;
  return true;
}

function nextWallTime(now: Date, weekday: number | null, hour: number) {
  const w = wallTime(now, ROLLOVER_ZONE);
  for (let offset = 0; offset <= 8; offset++) {
    const d = addDays(w, offset);
    const wd = (w.weekday + offset) % 7;
    if (weekday !== null && wd !== weekday) continue;
    const at = zonedInstant(ROLLOVER_ZONE, d.year, d.month, d.day, hour);
    if (at > now) return at;
  }
  throw new Error("wall_time_unresolved");
}

export type MarketWeek = { open: boolean; rollover: Date; weeklyClose: Date; weeklyOpen: Date };

export function marketWeek(now: Date): MarketWeek {
  return {
    open: marketOpenAt(now),
    rollover: nextWallTime(now, null, ROLLOVER_HOUR),
    weeklyClose: nextWallTime(now, 5, ROLLOVER_HOUR),
    weeklyOpen: nextWallTime(now, 0, ROLLOVER_HOUR),
  };
}

export type Segment = { start: Date; end: Date };

/**
 * Parts of each session that fall inside [from, to), for drawing a day timeline in any viewer's
 * timezone. Weekend sessions are left out.
 */
export function sessionSegments(from: Date, to: Date): Record<SessionKey, Segment[]> {
  const entries = SESSIONS.map((s) => {
    const segments: Segment[] = [];
    const anchor = wallTime(from, s.zone);
    for (const offset of [-1, 0, 1, 2]) {
      const d = addDays(anchor, offset);
      const start = zonedInstant(s.zone, d.year, d.month, d.day, s.open);
      const end = zonedInstant(s.zone, d.year, d.month, d.day, s.close);
      const a = Math.max(start.getTime(), from.getTime());
      const b = Math.min(end.getTime(), to.getTime());
      if (a >= b) continue;
      // Clip to the hours the market is open (a Sydney Monday starts before the Sunday open).
      segments.push(...clipToMarket(new Date(a), new Date(b)));
    }
    return [s.key, segments] as const;
  });
  const byKey = new Map<SessionKey, Segment[]>(entries);
  const get = (k: SessionKey) => byKey.get(k) ?? [];
  return {
    sydney: get("sydney"),
    tokyo: get("tokyo"),
    london: get("london"),
    newYork: get("newYork"),
  };
}

function clipToMarket(start: Date, end: Date): Segment[] {
  const result: Segment[] = [];
  const step = 15 * 60_000;
  let open: number | null = null;
  for (let t = start.getTime(); t < end.getTime(); t += step) {
    const isOpen = marketOpenAt(new Date(t));
    if (isOpen && open === null) open = t;
    if (!isOpen && open !== null) {
      result.push({ start: new Date(open), end: new Date(t) });
      open = null;
    }
  }
  if (open !== null) result.push({ start: new Date(open), end });
  return result;
}

/** Times when two or more sessions are open together. */
export function overlapSegments(segments: Record<SessionKey, Segment[]>): Segment[] {
  const edges = Object.values(segments)
    .flat()
    .flatMap((s) => [
      { t: s.start.getTime(), d: 1 },
      { t: s.end.getTime(), d: -1 },
    ])
    .sort((a, b) => a.t - b.t || a.d - b.d);
  const result: Segment[] = [];
  let depth = 0;
  let since = 0;
  for (const e of edges) {
    const before = depth;
    depth += e.d;
    if (before < 2 && depth >= 2) since = e.t;
    if (before >= 2 && depth < 2 && e.t > since)
      result.push({ start: new Date(since), end: new Date(e.t) });
  }
  return result;
}

/** Midnight to midnight of the viewer's current local day, as instants. */
export function localDay(now: Date, zone: string): Segment {
  const w = wallTime(now, zone);
  const next = addDays(w, 1);
  return {
    start: zonedInstant(zone, w.year, w.month, w.day, 0),
    end: zonedInstant(zone, next.year, next.month, next.day, 0),
  };
}
