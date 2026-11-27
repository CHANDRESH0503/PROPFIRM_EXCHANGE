"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SESSIONS,
  localDay,
  marketWeek,
  overlapSegments,
  sessionSegments,
  sessionWindows,
  type Segment,
} from "@/lib/tools/sessions";
import { cn } from "@/lib/utils";

/**
 * A clock rounded to 30 seconds, so the snapshot is stable between ticks. The server snapshot is
 * null because every time on this page depends on the viewer's timezone.
 */
function subscribe(notify: () => void) {
  const timer = window.setInterval(notify, 5_000);
  return () => window.clearInterval(timer);
}
const snapshot = () => Math.floor(Date.now() / 30_000) * 30_000;

function useNow() {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function SessionsClock() {
  const t = useTranslations("tools.sessions");
  const now = useNow();
  if (now === null) return <Skeleton className="h-96 w-full rounded-xl" />;
  return <Clock now={new Date(now)} t={t} />;
}

function Clock({ now, t }: { now: Date; t: ReturnType<typeof useTranslations<"tools.sessions">> }) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  });
  const dayTime = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zone,
  });
  const day = localDay(now, zone);
  const span = day.end.getTime() - day.start.getTime();
  const segments = sessionSegments(day.start, day.end);
  const overlap = overlapSegments(segments);
  const windows = new Map(sessionWindows(now).map((w) => [w.key, w]));
  const week = marketWeek(now);
  const position = (d: Date) => ((d.getTime() - day.start.getTime()) / span) * 100;
  const nowAt = position(now);

  function until(target: Date) {
    const minutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
    const d = Math.floor(minutes / 1440),
      h = Math.floor((minutes % 1440) / 60),
      m = minutes % 60;
    return d > 0 ? t("inDays", { d, h }) : h > 0 ? t("inHours", { h, m }) : t("inMinutes", { m });
  }

  const bar = (s: Segment, className: string) => (
    <span
      key={s.start.toISOString()}
      className={cn("absolute inset-y-1 rounded-sm", className)}
      style={{ left: `${position(s.start)}%`, width: `${position(s.end) - position(s.start)}%` }}
    />
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{t("yourTime", { zone })}</p>
          <p className="font-mono tabular text-4xl font-semibold">{time.format(now)}</p>
        </div>
        <p
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            week.open ? "bg-positive/15 text-positive" : "bg-raised text-text-soft",
          )}
        >
          {week.open ? t("marketOpen") : t("marketClosed")}
        </p>
      </div>

      <figure className="rounded-2xl p-4 panel sm:p-5">
        <figcaption className="sr-only">{t("timelineCaption")}</figcaption>
        <div className="space-y-2" aria-hidden="true">
          {SESSIONS.map((s) => (
            <div key={s.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
              <span className="text-sm text-text-soft">{t(`names.${s.key}`)}</span>
              <div className="relative h-7 rounded bg-raised">
                {segments[s.key].map((seg) =>
                  bar(seg, windows.get(s.key)?.open ? "bg-gold/70" : "bg-gold/35"),
                )}
                <span
                  className="absolute inset-y-0 w-px bg-foreground"
                  style={{ left: `${nowAt}%` }}
                />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
            <span className="text-sm text-text-soft">{t("overlap")}</span>
            <div className="relative h-7 rounded bg-raised">
              {overlap.map((seg) => bar(seg, "bg-positive/50"))}
              <span
                className="absolute inset-y-0 w-px bg-foreground"
                style={{ left: `${nowAt}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-xs text-muted-foreground">
            <span />
            <div className="flex justify-between font-mono tabular">
              {[0, 6, 12, 18, 24].map((h) => (
                <span key={h}>{String(h).padStart(2, "0")}:00</span>
              ))}
            </div>
          </div>
        </div>
      </figure>

      <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
        {SESSIONS.map((s) => {
          const w = windows.get(s.key);
          if (!w) return null;
          return (
            <div key={s.key} className="bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-base font-semibold">{t(`names.${s.key}`)}</h3>
                <span className={cn("text-sm", w.open ? "text-positive" : "text-muted-foreground")}>
                  {w.open ? t("open") : t("closed")}
                </span>
              </div>
              <p className="mt-1 font-mono tabular text-sm text-text-soft">
                {dayTime.format(w.start)} – {time.format(w.end)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {w.open
                  ? t("closesIn", { when: until(w.end) })
                  : t("opensIn", { when: until(w.start) })}
              </p>
            </div>
          );
        })}
      </div>

      <dl className="divide-y divide-hairline border-y border-hairline">
        {[
          { label: t("rollover"), at: week.rollover },
          { label: t("weeklyClose"), at: week.weeklyClose },
          { label: t("weeklyOpen"), at: week.weeklyOpen },
        ]
          // Show the next weekly event first: the close while open, the open at the weekend.
          .sort((a, b) => a.at.getTime() - b.at.getTime())
          .map(({ label, at }) => (
            <div key={label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3">
              <dt className="text-text-soft">{label}</dt>
              <dd className="font-mono tabular text-sm">
                {dayTime.format(at)} · {until(at)}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
