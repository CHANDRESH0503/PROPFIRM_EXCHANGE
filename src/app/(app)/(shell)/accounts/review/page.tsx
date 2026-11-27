import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, NotebookPen, TrendingDown, TrendingUp } from "lucide-react";
import { TitleIcon } from "@/components/layout/title-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboarded } from "@/lib/auth/session";
import { journalTrades, type TradeRow } from "@/lib/journal/data";
import { addDays } from "@/lib/journal/dates";
import { dayLabel, decimal, money, percent } from "@/lib/journal/format";
import { summarize } from "@/lib/journal/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ReviewDayForm, ReviewForm, type ReviewValues } from "./review-form";

export const metadata: Metadata = { title: "Weekly review" };

export default function ReviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <Review />
    </Suspense>
  );
}

/** The currency the member traded most this week; stats never add different currencies. */
function mainCurrency(trades: TradeRow[]) {
  const counts = new Map<string, number>();
  for (const t of trades) counts.set(t.currency, (counts.get(t.currency) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

async function Review() {
  const { user } = await requireOnboarded("/accounts/review");
  const [t, journal, db] = await Promise.all([
    getTranslations("journal.review"),
    getTranslations("journal"),
    createClient(),
  ]);
  const week = await createAdminClient().rpc("journal_review_week", { p_user: user.id });
  if (week.error || !week.data) throw new Error("review_week_unavailable");
  const start = week.data;
  const end = addDays(start, 6);

  const [trades, reviews, profile] = await Promise.all([
    journalTrades({ from: start, to: end }),
    db
      .from("journal_reviews")
      .select(
        "week_start,what_worked,what_didnt,costly_mistake,followed_plan,feeling,next_rule,previous_rule_kept",
      )
      .in("week_start", [start, addDays(start, -7)]),
    db.from("profiles").select("journal_review_day").eq("id", user.id).single(),
  ]);
  if (reviews.error || profile.error) throw new Error("review_unavailable");
  const current = reviews.data.find((r) => r.week_start === start) ?? null;
  const previous = reviews.data.find((r) => r.week_start === addDays(start, -7)) ?? null;

  const currency = mainCurrency(trades);
  const inCurrency = currency ? trades.filter((x) => x.currency === currency) : [];
  const s = summarize(inCurrency);
  const ranked = [...inCurrency].sort((a, b) => b.net_cents - a.net_cents);
  const best = ranked.length ? ranked[0] : null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const costliest = [...s.mistakes].sort((a, b) => a.cost - b.cost)[0];

  const values: ReviewValues | null = current
    ? {
        what_worked: current.what_worked,
        what_didnt: current.what_didnt,
        costly_mistake: current.costly_mistake,
        followed_plan: current.followed_plan as ReviewValues["followed_plan"],
        feeling: current.feeling,
        next_rule: current.next_rule ?? "",
        previous_rule_kept: current.previous_rule_kept,
      }
    : null;

  return (
    <div className="space-y-8">
      <Link
        href="/accounts"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-text-soft hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {journal("title")}
      </Link>
      <header className="space-y-3">
        <h1 className="flex items-center gap-3 font-heading text-2xl font-bold">
          <TitleIcon icon={NotebookPen} hue="var(--cyan)" />
          {t("title")}
        </h1>
        <p className="font-mono tabular text-sm text-text-soft">
          {t("week", { start: dayLabel(start, "long"), end: dayLabel(end, "long") })}
        </p>
        <p className="measure text-text-soft">{t("intro")}</p>
        {!current ? (
          <span className="inline-flex rounded-full bg-xp-beam px-3 py-1 font-mono tabular text-xs font-black text-ink">
            {t("xp")}
          </span>
        ) : null}
      </header>

      <section aria-labelledby="week-stats" className="space-y-3">
        <h2 id="week-stats" className="text-xl">
          {t("stats")}
        </h2>
        {currency ? (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  [t("trades"), String(s.trades)],
                  [t("net"), money(s.net, currency, true)],
                  [t("winRate"), percent(s.winRate)],
                  [t("avgR"), s.avgR === null ? "—" : `${decimal(s.avgR)} R`],
                ] as const
              ).map(([label, value], i) => (
                <div key={label} className="rounded-2xl p-4 panel">
                  <dt className="text-xs font-semibold text-text-soft">{label}</dt>
                  <dd
                    className={cn(
                      "mt-1 font-mono tabular text-xl font-bold",
                      i === 1 && (s.net >= 0 ? "text-positive" : "text-danger"),
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { trade: best, label: t("best"), icon: TrendingUp, tone: "text-positive" },
                { trade: worst, label: t("worst"), icon: TrendingDown, tone: "text-danger" },
              ].map(({ trade, label, icon: Icon, tone }) =>
                trade ? (
                  <Link
                    key={label}
                    href={`/accounts/trades/${trade.id}`}
                    className="flex items-center gap-3 rounded-2xl p-4 panel transition-colors hover:border-brand/60"
                  >
                    <Icon className={cn("size-5 shrink-0", tone)} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-text-soft">{label}</span>
                      <span className="block font-semibold">
                        {trade.symbol} · {dayLabel(trade.local_day)}
                      </span>
                    </span>
                    <span className={cn("font-mono tabular font-bold", tone)}>
                      {money(trade.net_cents, trade.currency, true)}
                    </span>
                  </Link>
                ) : null,
              )}
            </div>
            <p className="text-sm text-text-soft">
              {t("costliest")}:{" "}
              {costliest && costliest.cost < 0 ? (
                <span className="font-semibold text-foreground">
                  {costliest.name} ({money(costliest.cost, currency)})
                </span>
              ) : (
                t("noMistakes")
              )}
            </p>
          </>
        ) : (
          <p className="rounded-2xl p-4 text-text-soft panel">{t("noTrades")}</p>
        )}
      </section>

      <section
        aria-labelledby="review-questions"
        className="space-y-5 rounded-3xl p-5 frame-brand sm:p-6"
      >
        <h2 id="review-questions" className="text-xl">
          {t("questions")}
        </h2>
        <ReviewForm week={start} values={values} previousRule={previous?.next_rule ?? null} />
      </section>

      <section className="rounded-2xl p-5 panel">
        <ReviewDayForm day={profile.data.journal_review_day} />
      </section>
    </div>
  );
}
