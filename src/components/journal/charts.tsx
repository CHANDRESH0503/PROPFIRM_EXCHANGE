"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { compactMoney, dayLabel, money } from "@/lib/journal/format";
import { cn } from "@/lib/utils";

/**
 * Interactive SVG charts. Hover, touch or arrow keys select a point and show its details in a
 * tooltip, which is also announced to screen readers. Gains and losses use the positive/danger
 * pair, which is close for colour-blind readers, so polarity is also carried by position (above
 * or below zero) or a sign, and every chart keeps a table view.
 */

const W = 640;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 24, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;

export type DayPoint = { day: string; net: number; trades: number; wins: number; losses: number };

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || Math.abs(max) || 100;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

/** Selection shared by pointer, touch and keyboard. */
function useSelection(count: number) {
  const [index, setIndex] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const fromPointer = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !count) return;
    const x = ((clientX - box.left) / box.width) * W;
    const i = Math.round(((x - PAD.left) / PLOT_W) * count - 0.5);
    setIndex(Math.max(0, Math.min(count - 1, i)));
  };
  const handlers = {
    ref,
    tabIndex: 0,
    onPointerMove: (e: React.PointerEvent) => fromPointer(e.clientX),
    onPointerDown: (e: React.PointerEvent) => fromPointer(e.clientX),
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setIndex(null);
    },
    onFocus: () => setIndex((i) => i ?? count - 1),
    onBlur: () => setIndex(null),
    onKeyDown: (e: React.KeyboardEvent) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, Home: -count, End: count }[e.key];
      if (e.key === "Escape") setIndex(null);
      if (step === undefined) return;
      e.preventDefault();
      setIndex((i) => Math.max(0, Math.min(count - 1, (i ?? count - 1) + step)));
    },
  };
  return { index, handlers };
}

function Tooltip({ x, children }: { x: number; children: React.ReactNode }) {
  // x is a share of the chart width; flip to the left half near the right edge.
  const right = x > 0.6;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border border-hairline bg-ink-deep/60 px-3 py-2 text-xs shadow-[var(--shadow-overlay)]"
      style={right ? { right: `${(1 - x) * 100 + 2}%` } : { left: `${x * 100 + 2}%` }}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular",
          tone === "positive" && "text-positive",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </span>
    </div>
  );
}

const toneOf = (n: number) => (n > 0 ? "positive" : n < 0 ? "danger" : undefined);

function DataTable({
  rows,
  currency,
  label,
}: {
  rows: { day: string; net: number; trades?: number }[];
  currency: string;
  label: string;
}) {
  const t = useTranslations("journal.charts");
  return (
    <details className="mt-3 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted-foreground hover:text-foreground">
        {label}
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-hairline">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-raised text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("day")}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t("net")}
              </th>
              {rows[0]?.trades !== undefined ? (
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("tradesCol")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((r) => (
              <tr key={r.day}>
                <td className="px-3 py-2">{dayLabel(r.day, "long")}</td>
                <td className="px-3 py-2 text-right font-mono tabular">
                  {money(r.net, currency, true)}
                </td>
                {r.trades !== undefined ? (
                  <td className="px-3 py-2 text-right font-mono tabular">{r.trades}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Axis({
  ticks,
  y,
  currency,
}: {
  ticks: number[];
  y: (v: number) => number;
  currency: string;
}) {
  return (
    <g aria-hidden="true">
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            className={v === 0 ? "stroke-muted-foreground/60" : "stroke-hairline"}
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(v)}
            dy="0.32em"
            textAnchor="end"
            className="fill-muted-foreground font-mono text-[11px]"
          >
            {compactMoney(v, currency)}
          </text>
        </g>
      ))}
    </g>
  );
}

const svgClass =
  "mt-3 h-auto w-full touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function EquityChart({ days, currency }: { days: DayPoint[]; currency: string }) {
  const t = useTranslations("journal.charts");
  const st = useTranslations("journal.stats");
  const hint = useId();
  const { index, handlers } = useSelection(days.length);
  if (!days.length) return null;
  const points = days.reduce<(DayPoint & { value: number })[]>(
    (acc, d) => [...acc, { ...d, value: (acc[acc.length - 1]?.value ?? 0) + d.net }],
    [],
  );
  const values = [0, ...points.map((p) => p.value)];
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const lo = ticks[0]!,
    hi = ticks[ticks.length - 1]!;
  // Each day sits at the centre of its band, matching the daily bars below it.
  const x = (i: number) => PAD.left + (PLOT_W / points.length) * (i + 0.5);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
  const path = [
    `M${PAD.left},${y(0).toFixed(1)}`,
    ...points.map((p, i) => `L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`),
  ].join("");
  const area = `${path}L${x(points.length - 1).toFixed(1)},${y(0).toFixed(1)}Z`;
  const last = points[points.length - 1]!;
  const sel = index === null ? null : points[index];
  const desc = t("equityDesc", {
    start: dayLabel(points[0]!.day),
    end: dayLabel(last.day),
    value: money(last.value, currency),
  });
  return (
    <figure>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-base font-semibold">{t("equity")}</span>
        <span className="font-mono tabular text-sm text-text-soft">
          {money(last.value, currency, true)}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={svgClass}
          role="img"
          aria-label={desc}
          aria-describedby={hint}
          {...handlers}
        >
          <Axis ticks={ticks} y={y} currency={currency} />
          <path d={area} className="fill-foreground/10" />
          <path
            d={path}
            fill="none"
            className="stroke-foreground"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {sel && index !== null ? (
            <g aria-hidden="true">
              <line
                x1={x(index)}
                x2={x(index)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className="stroke-muted-foreground/60"
                strokeWidth={1}
              />
              <circle
                cx={x(index)}
                cy={y(sel.value)}
                r={5}
                className="fill-foreground stroke-surface"
                strokeWidth={2}
              />
            </g>
          ) : (
            <circle
              cx={x(points.length - 1)}
              cy={y(last.value)}
              r={4}
              className="fill-foreground stroke-surface"
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
          <text
            x={PAD.left}
            y={H - 6}
            className="fill-muted-foreground text-[11px]"
            aria-hidden="true"
          >
            {dayLabel(points[0]!.day)}
          </text>
          <text
            x={W - PAD.right}
            y={H - 6}
            textAnchor="end"
            className="fill-muted-foreground text-[11px]"
            aria-hidden="true"
          >
            {dayLabel(last.day)}
          </text>
        </svg>
        {sel && index !== null ? (
          <Tooltip x={x(index) / W}>
            <p className="mb-1 font-medium">{dayLabel(sel.day, "long")}</p>
            <Row
              label={t("running")}
              value={money(sel.value, currency, true)}
              tone={toneOf(sel.value)}
            />
            <Row
              label={t("dayResult")}
              value={money(sel.net, currency, true)}
              tone={toneOf(sel.net)}
            />
            <Row label={t("tradesCol")} value={String(sel.trades)} />
          </Tooltip>
        ) : null}
      </div>
      <p id={hint} className="sr-only">
        {t("keyboardHint")}
      </p>
      <p aria-live="polite" className="sr-only">
        {sel
          ? `${dayLabel(sel.day, "long")}: ${t("running")} ${money(sel.value, currency, true)}, ${t("dayResult")} ${money(sel.net, currency, true)}, ${st("trades", { n: sel.trades })}`
          : ""}
      </p>
      <DataTable
        rows={points.map((p) => ({ day: p.day, net: p.value }))}
        currency={currency}
        label={t("table")}
      />
    </figure>
  );
}

export function DailyBars({ days, currency }: { days: DayPoint[]; currency: string }) {
  const t = useTranslations("journal.charts");
  const st = useTranslations("journal.stats");
  const hint = useId();
  const shown = days.slice(-60);
  const { index, handlers } = useSelection(shown.length);
  if (!shown.length) return null;
  const values = shown.map((d) => d.net);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const lo = ticks[0]!,
    hi = ticks[ticks.length - 1]!;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
  const band = PLOT_W / shown.length;
  const bar = Math.max(2, Math.min(24, band - 2));
  const zero = y(0);
  const sel = index === null ? null : shown[index];
  return (
    <figure>
      <figcaption className="font-heading text-base font-semibold">{t("daily")}</figcaption>
      <p className="mt-1 text-sm text-muted-foreground">{t("dailyDesc")}</p>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={svgClass}
          role="img"
          aria-label={t("dailyDesc")}
          aria-describedby={hint}
          {...handlers}
        >
          <Axis ticks={ticks} y={y} currency={currency} />
          {index !== null ? (
            <rect
              x={PAD.left + band * index}
              y={PAD.top}
              width={band}
              height={H - PAD.top - PAD.bottom}
              className="fill-foreground/5"
              aria-hidden="true"
            />
          ) : null}
          {shown.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const top = Math.min(zero, y(d.net));
            const h = Math.max(1, Math.abs(y(d.net) - zero));
            const r = Math.min(4, bar / 2, h);
            // Rounded at the data end only; square on the zero line.
            const x0 = cx - bar / 2,
              x1 = cx + bar / 2;
            const path =
              d.net >= 0
                ? `M${x0},${zero}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x1 - r}Q${x1},${top} ${x1},${top + r}V${zero}Z`
                : `M${x0},${zero}V${top + h - r}Q${x0},${top + h} ${x0 + r},${top + h}H${x1 - r}Q${x1},${top + h} ${x1},${top + h - r}V${zero}Z`;
            return (
              <path
                key={d.day}
                d={path}
                aria-hidden="true"
                className={cn(
                  "transition-opacity",
                  d.net >= 0 ? "fill-positive" : "fill-danger",
                  index !== null && index !== i && "opacity-50",
                )}
              />
            );
          })}
        </svg>
        {sel && index !== null ? (
          <Tooltip x={(PAD.left + band * (index + 0.5)) / W}>
            <p className="mb-1 font-medium">{dayLabel(sel.day, "long")}</p>
            <Row label={t("net")} value={money(sel.net, currency, true)} tone={toneOf(sel.net)} />
            <Row label={t("tradesCol")} value={String(sel.trades)} />
            <Row label={t("winsLosses")} value={`${sel.wins} / ${sel.losses}`} />
          </Tooltip>
        ) : null}
      </div>
      <p id={hint} className="sr-only">
        {t("keyboardHint")}
      </p>
      <p aria-live="polite" className="sr-only">
        {sel
          ? `${dayLabel(sel.day, "long")}: ${money(sel.net, currency, true)}, ${st("trades", { n: sel.trades })}`
          : ""}
      </p>
      <DataTable rows={shown} currency={currency} label={t("table")} />
    </figure>
  );
}

/** A month of daily results. Hover or focus shows the day; selecting it opens that day's trades. */
export function CalendarHeatmap({
  month,
  days,
  currency,
  nav,
}: {
  month: string;
  days: DayPoint[];
  currency: string;
  nav: React.ReactNode;
}) {
  const t = useTranslations("journal.charts");
  const st = useTranslations("journal.stats");
  const [active, setActive] = useState<string | null>(null);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const first = new Date(`${month}-01T12:00:00Z`);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const max = Math.max(
    1,
    ...days.filter((d) => d.day.startsWith(month)).map((d) => Math.abs(d.net)),
  );
  const title = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);
  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];
  const sel = active ? byDay.get(active) : undefined;
  return (
    <figure>
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading text-base font-semibold">
          {t("calendar")} · {title}
        </span>
        {nav}
      </figcaption>
      <p className="mt-1 text-sm text-muted-foreground">{t("calendarDesc")}</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i} className="pb-1 text-xs text-muted-foreground">
            {w}
          </span>
        ))}
      </div>
      <ol
        className="mt-1 grid grid-cols-7 gap-1 text-center"
        aria-label={`${t("calendar")} ${title}`}
      >
        {Array.from({ length: count }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, "0")}`;
          const v = byDay.get(day);
          // Capped so light text keeps at least 4.5:1 contrast on the strongest tint.
          const strength = v ? 12 + Math.round((Math.abs(v.net) / max) * 33) : 0;
          const label = v
            ? `${dayLabel(day, "long")}: ${money(v.net, currency, true)}, ${st("trades", { n: v.trades })}`
            : `${dayLabel(day, "long")}: ${t("noTradeDay")}`;
          const cell = cn(
            "flex aspect-square min-h-10 w-full flex-col items-center justify-center rounded-md text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            v
              ? "text-foreground hover:ring-1 hover:ring-foreground/40"
              : "bg-surface text-muted-foreground",
            active === day && "ring-1 ring-foreground/60",
          );
          const style = {
            backgroundColor:
              v && v.net !== 0
                ? `color-mix(in oklab, var(--${v.net > 0 ? "positive" : "danger"}) ${strength}%, var(--surface))`
                : undefined,
          };
          const inner = (
            <>
              <span aria-hidden="true" className="font-mono tabular">
                {i + 1}
              </span>
              <span className="sr-only">{label}</span>
              {v ? (
                <span aria-hidden="true" className="font-mono text-[10px] leading-none">
                  {v.net > 0 ? "+" : v.net < 0 ? "−" : "0"}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={day} style={{ gridColumnStart: i === 0 ? offset + 1 : undefined }}>
              {v ? (
                <Link
                  href={`/accounts/trades?day=${day}`}
                  className={cell}
                  style={style}
                  onPointerEnter={() => setActive(day)}
                  onPointerLeave={() => setActive((a) => (a === day ? null : a))}
                  onFocus={() => setActive(day)}
                  onBlur={() => setActive((a) => (a === day ? null : a))}
                >
                  {inner}
                </Link>
              ) : (
                <div className={cell}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
      <div
        aria-hidden="true"
        className="mt-3 min-h-14 rounded-lg border border-hairline px-3 py-2 text-xs"
      >
        {sel ? (
          <>
            <p className="mb-1 font-medium">{dayLabel(sel.day, "long")}</p>
            <Row label={t("net")} value={money(sel.net, currency, true)} tone={toneOf(sel.net)} />
            <Row
              label={t("winsLosses")}
              value={`${sel.wins} / ${sel.losses} · ${st("trades", { n: sel.trades })}`}
            />
          </>
        ) : (
          <p className="text-muted-foreground">{t("calendarHint")}</p>
        )}
      </div>
    </figure>
  );
}
