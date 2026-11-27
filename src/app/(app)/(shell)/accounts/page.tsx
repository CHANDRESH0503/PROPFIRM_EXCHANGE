import { TitleIcon } from "@/components/layout/title-icon";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, NotebookPen, Plus, ShieldCheck, Download } from "lucide-react";
import { CalendarHeatmap, DailyBars, EquityChart } from "@/components/journal/charts";
import { NoTradesButton } from "@/components/journal/no-trades";
import { QuickLog } from "@/components/journal/quick-log";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { StreakFlame } from "@/components/ui/streak-flame";
import { requireOnboarded } from "@/lib/auth/session";
import {
  dailyStats,
  galleryShots,
  journalCurrencies,
  journalDay,
  journalStrategies,
  journalStreak,
  journalTags,
  journalTrades,
} from "@/lib/journal/data";
import { addDays, monthEnd, shiftMonth, todayIn } from "@/lib/journal/dates";
import { decimal, money, percent } from "@/lib/journal/format";
import { JOURNAL_SESSIONS } from "@/lib/journal/compute";
import { summarize, type Breakdown } from "@/lib/journal/stats";
import { SYMBOLS } from "@/lib/tools/instruments";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Journal" };

const PERIODS = ["7", "30", "90", "all"] as const;
const WEEKDAYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
type Period = (typeof PERIODS)[number];
type Search = Promise<Record<string, string | string[] | undefined>>;

export default function JournalPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<JournalSkeleton />}>
      <Journal searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Journal({ searchParams }: { searchParams: Search }) {
  const { profile } = await requireOnboarded("/accounts");
  const search = await searchParams;
  const zone = profile.timezone ?? "UTC";
  const today = todayIn(zone);
  const period: Period = PERIODS.find((p) => p === one(search.period)) ?? "30";
  const from = period === "all" ? undefined : addDays(today, -(Number(period) - 1));

  const [t, currencies, tags, strategies, streak, marked] = await Promise.all([
    getTranslations("journal"),
    journalCurrencies(),
    journalTags(),
    journalStrategies(),
    journalStreak(),
    journalDay(today),
  ]);
  const requested = one(search.currency);
  const currency = currencies.find((c) => c === requested) ?? currencies[0] ?? "USD";
  const monthParam = one(search.month);
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : today.slice(0, 7);
  const [trades, monthDays, gallery] = await Promise.all([
    journalTrades({ from, to: today, currency }),
    dailyStats(`${month}-01`, monthEnd(month), currency),
    galleryShots(8),
  ]);
  const s = summarize(trades);
  const names = new Map(strategies.map((st) => [st.id, st.name]));
  const streakDays = streak && streak.last_day >= addDays(today, -1) ? streak.current_streak : 0;
  const query = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ period, currency, month, ...patch });
    return `/accounts?${p}` as const;
  };
  const hasAny = currencies.length > 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-prose space-y-1">
          <h1 className="flex items-center gap-3 font-heading text-2xl font-bold">
            <TitleIcon icon={ShieldCheck} hue="var(--cyan)" />
            {t("title")}
          </h1>
          <p className="text-sm text-text-soft">{t("intro")}</p>
        </div>
        <nav aria-label={t("title")} className="flex flex-wrap gap-2">
          <Link href="/accounts/trades/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            {t("logTrade")}
          </Link>
          <Link href="/accounts/trades" className={buttonVariants({ variant: "secondary" })}>
            {t("allTrades")}
          </Link>
          <Link href="/accounts/strategies" className={buttonVariants({ variant: "secondary" })}>
            {t("strategies")}
          </Link>
          <Link href="/accounts/review" className={buttonVariants({ variant: "secondary" })}>
            {t("review.nav")}
          </Link>
          {/* A file download, not a page: a plain anchor so the browser saves it. */}
          <a
            href="/accounts/trades/export"
            download
            className={buttonVariants({ variant: "ghost" })}
          >
            <Download aria-hidden="true" />
            {t("exportCsv")}
          </a>
        </nav>
      </header>

      <section
        aria-labelledby="journal-today"
        className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline lg:grid-cols-[1fr_1.6fr]"
      >
        <div className="space-y-4 bg-surface p-5">
          <h2 id="journal-today" className="font-heading text-base font-semibold">
            {t("today.title")}
          </h2>
          <div className="flex items-center gap-3">
            <StreakFlame lit={streakDays > 0} className="size-8" />
            <p className="text-sm text-text-soft">
              {streakDays ? t("today.streak", { days: streakDays }) : t("today.noStreak")}
            </p>
          </div>
          <NoTradesButton marked={marked === "trade" || marked === "no_trades" ? marked : null} />
        </div>
        <div className="space-y-3 bg-surface p-5">
          <h2 className="font-heading text-base font-semibold">{t("quick.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("quick.hint")}</p>
          <QuickLog tags={tags} currency={currency} symbols={SYMBOLS} />
        </div>
      </section>

      {!hasAny ? (
        <EmptyState
          icon={<NotebookPen />}
          title={t("empty.title")}
          body={t("empty.body")}
          action={
            <Link href="/accounts/trades/new" className={buttonVariants()}>
              {t("logTrade")}
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label={t("periods.label")}
              className="flex flex-wrap gap-1 rounded-lg border border-hairline p-1"
            >
              {PERIODS.map((p) => (
                <Link
                  key={p}
                  href={query({ period: p })}
                  aria-current={p === period ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-md px-3 text-sm",
                    p === period
                      ? "bg-raised text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`periods.${p}`)}
                </Link>
              ))}
            </nav>
            {currencies.length > 1 ? (
              <nav aria-label={t("currencyLabel")} className="flex flex-wrap gap-1">
                {currencies.map((c) => (
                  <Link
                    key={c}
                    href={query({ currency: c })}
                    aria-current={c === currency ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-9 items-center rounded-md border px-3 font-mono text-sm",
                      c === currency
                        ? "border-foreground/40 text-foreground"
                        : "border-hairline text-muted-foreground",
                    )}
                  >
                    {c}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

          {s.trades === 0 ? (
            <p className="rounded-2xl p-6 text-sm text-muted-foreground panel">
              {t("empty.period")}
            </p>
          ) : (
            <>
              <section
                aria-label={t("stats.net")}
                className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline md:grid-cols-4"
              >
                <Stat
                  label={t("stats.net")}
                  value={money(s.net, currency, true)}
                  sub={t("stats.trades", { n: s.trades })}
                  tone={s.net > 0 ? "positive" : s.net < 0 ? "danger" : undefined}
                />
                <div className="flex items-center gap-4 bg-surface p-5">
                  <ProgressRing
                    value={s.winRate ?? 0}
                    label={t("stats.winRate")}
                    size={48}
                    stroke={5}
                    tone="neutral"
                    className="shrink-0"
                  />
                  <div>
                    <p className="text-sm text-muted-foreground">{t("stats.winRate")}</p>
                    <p className="font-mono tabular text-xl font-semibold">{percent(s.winRate)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("stats.winsLosses", { wins: s.wins, losses: s.losses })}
                    </p>
                  </div>
                </div>
                <Stat
                  label={t("stats.profitFactor")}
                  value={decimal(s.profitFactor)}
                  sub={s.profitFactor === null ? t("stats.noLosses") : undefined}
                />
                <Stat
                  label={t("stats.avgR")}
                  value={s.avgR === null ? "—" : `${decimal(s.avgR)} R`}
                  sub={s.avgR === null ? t("stats.noR") : undefined}
                />
              </section>

              <div className="grid gap-8 lg:grid-cols-2">
                <EquityChart days={s.daily} currency={currency} />
                <DailyBars days={s.daily} currency={currency} />
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
                {[
                  [t("stats.best"), s.best === null ? "—" : money(s.best, currency, true)],
                  [t("stats.worst"), s.worst === null ? "—" : money(s.worst, currency, true)],
                  [t("stats.longestWin"), String(s.longestWin)],
                  [t("stats.longestLoss"), String(s.longestLoss)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-mono tabular">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
            <CalendarHeatmap
              month={month}
              days={monthDays}
              currency={currency}
              nav={
                <span className="flex gap-1">
                  <Link
                    href={query({ month: shiftMonth(month, -1) })}
                    aria-label={t("charts.prevMonth")}
                    className={buttonVariants({ variant: "ghost", size: "icon" })}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Link>
                  <Link
                    href={query({ month: shiftMonth(month, 1) })}
                    aria-label={t("charts.nextMonth")}
                    className={buttonVariants({ variant: "ghost", size: "icon" })}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </span>
              }
            />
            {s.trades > 0 ? (
              <section aria-labelledby="mistakes" className="space-y-3">
                <h2 id="mistakes" className="font-heading text-lg font-semibold">
                  {t("mistakes.title")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("mistakes.hint")}</p>
                {s.mistakes.length ? (
                  <ol className="divide-y divide-hairline border-y border-hairline">
                    {s.mistakes.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                        <span>
                          {m.name}{" "}
                          <span className="text-sm text-muted-foreground">
                            · {t("mistakes.trades", { n: m.trades })}
                          </span>
                        </span>
                        <span className={cn("font-mono tabular", m.cost < 0 && "text-danger")}>
                          {money(m.cost, currency)}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("mistakes.empty")}</p>
                )}
              </section>
            ) : null}
          </div>

          {s.trades > 0 ? (
            <>
              <section aria-labelledby="breakdowns" className="space-y-4">
                <h2 id="breakdowns" className="font-heading text-lg font-semibold">
                  {t("breakdowns.title")}
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  <BreakdownTable
                    title={t("breakdowns.symbol")}
                    rows={s.bySymbol}
                    label={(k) => k}
                    currency={currency}
                  />
                  <BreakdownTable
                    title={t("breakdowns.session")}
                    rows={s.bySession}
                    label={(k) => {
                      const v = JOURNAL_SESSIONS.find((x) => x === k);
                      return v ? t(`session.${v}`) : k;
                    }}
                    currency={currency}
                  />
                  <BreakdownTable
                    title={t("breakdowns.direction")}
                    rows={s.byDirection}
                    label={(k) => (k === "short" ? t("direction.short") : t("direction.long"))}
                    currency={currency}
                  />
                  <BreakdownTable
                    title={t("breakdowns.weekday")}
                    rows={s.byWeekday}
                    label={(k) => {
                      const v = WEEKDAYS.find((x) => x === k);
                      return v ? t(`weekday.${v}`) : k;
                    }}
                    currency={currency}
                  />
                  {s.byStrategy.length ? (
                    <BreakdownTable
                      title={t("breakdowns.strategy")}
                      rows={s.byStrategy}
                      label={(k) => names.get(k) ?? t("breakdowns.noStrategy")}
                      currency={currency}
                    />
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          <section aria-labelledby="gallery" className="space-y-3">
            <h2 id="gallery" className="font-heading text-lg font-semibold">
              {t("gallery.title")}
            </h2>
            {gallery.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {gallery.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/accounts/trades/${g.tradeId}`}
                      className="block overflow-hidden rounded-xl border border-hairline bg-ink-deep/60 hover:border-foreground/30"
                    >
                      {/* Signed, short-lived URLs from private storage: not optimisable by next/image. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.url}
                        alt={t("gallery.alt", {
                          symbol: g.symbol,
                          result: money(g.net_cents ?? 0, g.currency, true),
                        })}
                        loading="lazy"
                        className="aspect-video w-full object-cover"
                      />
                      <span className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="font-mono">{g.symbol}</span>
                        <span
                          className={cn(
                            "font-mono tabular",
                            (g.net_cents ?? 0) < 0 ? "text-danger" : "text-text-soft",
                          )}
                        >
                          {money(g.net_cents ?? 0, g.currency, true)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("gallery.empty")}</p>
            )}
          </section>
        </>
      )}

      <p className="flex items-start gap-3 rounded-xl border border-hairline p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {t("guardianNote")}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "danger";
}) {
  return (
    <div className="bg-surface p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono tabular text-xl font-semibold",
          tone === "positive" && "text-positive",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

async function BreakdownTable({
  title,
  rows,
  label,
  currency,
}: {
  title: string;
  rows: Breakdown[];
  label: (key: string) => string;
  currency: string;
}) {
  const t = await getTranslations("journal.breakdowns");
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-text-soft">{title}</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-hairline">
            <th scope="col" className="py-2 font-medium">
              {t("key")}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t("trades")}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t("winRate")}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t("net")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.slice(0, 8).map((r) => (
            <tr key={r.key}>
              <th scope="row" className="py-2 text-left font-normal">
                {label(r.key)}
              </th>
              <td className="py-2 text-right font-mono tabular">{r.trades}</td>
              <td className="py-2 text-right font-mono tabular">
                {percent((r.wins / r.trades) * 100)}
              </td>
              <td className={cn("py-2 text-right font-mono tabular", r.net < 0 && "text-danger")}>
                {money(r.net, currency, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JournalSkeleton() {
  return (
    <div className="space-y-10" aria-hidden="true">
      <Skeleton className="h-16 w-2/3" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
