import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, Image as ImageIcon, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboarded } from "@/lib/auth/session";
import { journalTrades } from "@/lib/journal/data";
import { dayLabel, money } from "@/lib/journal/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "All trades" };

const PAGE = 50;
type Search = Promise<Record<string, string | string[] | undefined>>;

export default function TradesPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Trades searchParams={searchParams} />
    </Suspense>
  );
}

async function Trades({ searchParams }: { searchParams: Search }) {
  const { profile } = await requireOnboarded("/accounts/trades");
  const search = await searchParams;
  const before =
    typeof search.before === "string" && !Number.isNaN(Date.parse(search.before))
      ? search.before
      : undefined;
  // From the dashboard calendar: one local day.
  const day =
    typeof search.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.day)
      ? search.day
      : undefined;
  const [t, rows] = await Promise.all([
    getTranslations("journal"),
    journalTrades({ before, from: day, to: day, limit: PAGE + 1 }),
  ]);
  const trades = rows.slice(0, PAGE);
  const next = rows.length > PAGE ? trades[trades.length - 1]?.closed_at : undefined;
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: profile.timezone ?? "UTC",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="space-y-6">
      <Link
        href="/accounts"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("detail.back")}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold">
            {day ? t("list.dayTitle", { day: dayLabel(day, "long") }) : t("list.title")}
          </h1>
          {day ? (
            <Link
              href="/accounts/trades"
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline hover:text-foreground"
            >
              {t("list.allDays")}
            </Link>
          ) : null}
        </div>
        <Link href="/accounts/trades/new" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          {t("logTrade")}
        </Link>
      </header>
      {trades.length === 0 ? (
        <p className="rounded-2xl p-6 text-sm text-muted-foreground panel">{t("list.empty")}</p>
      ) : (
        <ul className="divide-y divide-hairline overflow-hidden rounded-2xl panel">
          {trades.map((tr) => (
            <li key={tr.id}>
              <Link
                href={`/accounts/trades/${tr.id}`}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-raised"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono font-medium">{tr.symbol}</span>
                  <span className="text-sm text-text-soft">
                    {t(`direction.${tr.direction === "short" ? "short" : "long"}`)}
                  </span>
                  {tr.source === "quick" ? (
                    <span className="text-xs text-muted-foreground">· {t("list.quick")}</span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-right font-mono tabular",
                    tr.net_cents < 0 ? "text-danger" : tr.net_cents > 0 ? "text-positive" : "",
                  )}
                >
                  {money(tr.net_cents, tr.currency, true)}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <time dateTime={tr.closed_at}>{when.format(new Date(tr.closed_at))}</time>
                  {tr.tags.length ? (
                    <span>· {tr.tags.map((tag) => tag.name).join(", ")}</span>
                  ) : null}
                </span>
                <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  {tr.screenshots ? (
                    <>
                      <ImageIcon className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">{t("list.shots", { n: tr.screenshots })}</span>
                      <span aria-hidden="true">{tr.screenshots}</span>
                    </>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {next ? (
        <Link
          href={`/accounts/trades?${new URLSearchParams(day ? { before: next, day } : { before: next })}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("list.more")}
        </Link>
      ) : null}
    </div>
  );
}
