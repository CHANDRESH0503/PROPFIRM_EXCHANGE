"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CALENDAR_CURRENCIES,
  type CalendarCurrency,
  type CalendarEvent,
  type Impact,
} from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

const RANGES = ["today", "week", "next"] as const;
type Range = (typeof RANGES)[number];
const LEVELS = ["all", "medium", "high"] as const;
type Level = (typeof LEVELS)[number];
const RANK: Record<Impact, number> = { low: 0, medium: 1, high: 2 };
const STORAGE = "fundback.calendar.currencies";

function subscribe(notify: () => void) {
  const timer = window.setInterval(notify, 15_000);
  return () => window.clearInterval(timer);
}
const minute = () => Math.floor(Date.now() / 15_000) * 15_000;

function savedCurrencies(): CalendarCurrency[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE) ?? "[]");
    return Array.isArray(raw) ? CALENDAR_CURRENCIES.filter((c) => raw.includes(c)) : [];
  } catch {
    return [];
  }
}

/** Local calendar date key (YYYY-MM-DD) in the viewer's timezone. */
function dayKey(d: Date, zone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(d);
}

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const now = useSyncExternalStore(subscribe, minute, () => null);
  if (now === null) return <Skeleton className="h-[32rem] w-full rounded-xl" />;
  return <Calendar events={events} now={new Date(now)} />;
}

function Calendar({ events, now }: { events: CalendarEvent[]; now: Date }) {
  const t = useTranslations("tools.calendar");
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [range, setRange] = useState<Range>("today");
  const [level, setLevel] = useState<Level>("all");
  const [currencies, setCurrencies] = useState<CalendarCurrency[]>(savedCurrencies);

  function toggle(c: CalendarCurrency) {
    setCurrencies((list) => {
      const next = list.includes(c) ? list.filter((x) => x !== c) : [...list, c];
      try {
        window.localStorage.setItem(STORAGE, JSON.stringify(next));
      } catch {
        // Private mode: the filter still works for this visit.
      }
      return next;
    });
  }

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  });
  const heading = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: zone,
  });

  // The React Compiler memoizes this; no manual useMemo needed.
  const { groups, next } = filterEvents();
  function filterEvents() {
    const today = dayKey(now, zone);
    // Monday-based local weeks.
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    const monday = new Date(`${today}T12:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - weekday);
    const shift = (days: number) => {
      const d = new Date(monday);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const [from, to] =
      range === "today"
        ? [today, today]
        : range === "week"
          ? [shift(0), shift(6)]
          : [shift(7), shift(13)];
    const matches = (e: CalendarEvent) =>
      (currencies.length === 0 || currencies.includes(e.currency)) &&
      (level === "all" || RANK[e.impact] >= RANK[level]);
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = dayKey(new Date(e.scheduledAt), zone);
      if (key < from || key > to || !matches(e)) continue;
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    const upcoming = events.find(
      (e) =>
        e.impact === "high" &&
        new Date(e.scheduledAt) > now &&
        (currencies.length === 0 || currencies.includes(e.currency)),
    );
    return { groups: [...map.entries()], next: upcoming ?? null };
  }

  function countdown(target: Date) {
    const minutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
    const d = Math.floor(minutes / 1440),
      h = Math.floor((minutes % 1440) / 60),
      m = minutes % 60;
    return d > 0 ? t("inDays", { d, h }) : h > 0 ? t("inHours", { h, m }) : t("inMinutes", { m });
  }

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-lg border px-3 text-sm transition-colors",
      active
        ? "border-foreground/40 bg-raised text-foreground"
        : "border-hairline text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-6">
      {next ? (
        <p className="rounded-2xl p-4 text-sm leading-relaxed panel">
          <span className="text-muted-foreground">{t("nextHigh")} </span>
          <span className="font-medium">
            {next.currency} · {next.title}
          </span>{" "}
          <span className="font-mono tabular text-caution">
            {countdown(new Date(next.scheduledAt))}
          </span>
        </p>
      ) : null}

      <div className="space-y-3">
        <div role="group" aria-label={t("rangeLabel")} className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={chip(range === r)}
            >
              {t(`ranges.${r}`)}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t("impactLabel")} className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={chip(level === l)}
            >
              {t(`levels.${l}`)}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t("currencyLabel")} className="flex flex-wrap gap-2">
          {CALENDAR_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={currencies.includes(c)}
              onClick={() => toggle(c)}
              className={cn(chip(currencies.includes(c)), "font-mono")}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("zoneNote", { zone })}</p>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl p-6 text-sm text-muted-foreground panel">{t("empty")}</p>
      ) : (
        groups.map(([key, list]) => (
          <section
            key={key}
            aria-labelledby={`day-${key}`}
            className="overflow-hidden rounded-xl border border-hairline"
          >
            <h2 id={`day-${key}`} className="bg-raised px-4 py-2.5 text-sm font-semibold">
              {heading.format(new Date(list[0]!.scheduledAt))}
            </h2>
            <ul className="divide-y divide-hairline bg-surface">
              {list.map((e) => {
                const at = new Date(e.scheduledAt);
                const past = at <= now;
                return (
                  <li
                    key={e.id}
                    className={cn(
                      "grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[5rem_3rem_1fr_auto]",
                      past && "text-text-soft",
                    )}
                  >
                    <span className="font-mono tabular text-sm whitespace-nowrap">
                      {time.format(at)}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-sm sm:block">
                      {e.currency}
                      <span className="sr-only">, </span>
                    </span>
                    <span className="col-span-2 flex items-start gap-2 sm:col-span-1">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          e.impact === "high"
                            ? "bg-danger"
                            : e.impact === "medium"
                              ? "bg-caution"
                              : "bg-muted-foreground/60",
                        )}
                      />
                      <span>
                        <span className="text-sm">{e.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t(`impact.${e.impact}`)}
                        </span>
                      </span>
                    </span>
                    <dl className="col-span-2 grid grid-cols-3 gap-3 text-xs sm:col-span-1 sm:min-w-56">
                      {(
                        [
                          ["actual", e.actual],
                          ["forecast", e.forecast],
                          ["previous", e.previous],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-muted-foreground">{t(`figures.${k}`)}</dt>
                          <dd
                            className={cn(
                              "font-mono tabular",
                              k === "actual" && v ? "text-foreground" : "",
                            )}
                          >
                            {v ?? "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
