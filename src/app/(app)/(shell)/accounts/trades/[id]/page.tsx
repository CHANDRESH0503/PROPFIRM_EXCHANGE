import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { z } from "zod";
import { DeleteTrade } from "@/components/journal/delete-trade";
import { Screenshots } from "@/components/journal/screenshots";
import { TradeForm } from "@/components/journal/trade-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboarded } from "@/lib/auth/session";
import { JOURNAL_SESSIONS, fromMinor } from "@/lib/journal/compute";
import { journalStrategies, journalTags, journalTrade, signedShots } from "@/lib/journal/data";
import { localInput } from "@/lib/journal/dates";
import { decimal, money } from "@/lib/journal/format";
import { SYMBOLS } from "@/lib/tools/instruments";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Trade" };

export default function TradePage(props: PageProps<"/accounts/trades/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-xl" />}>
      <Trade {...props} />
    </Suspense>
  );
}

const str = (v: number | null) => (v === null ? "" : String(v));

async function Trade({ params, searchParams }: PageProps<"/accounts/trades/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { profile } = await requireOnboarded(`/accounts/trades/${id}`);
  const zone = profile.timezone ?? "UTC";
  const [t, trade, tags, strategies, search] = await Promise.all([
    getTranslations("journal"),
    journalTrade(id),
    journalTags(),
    journalStrategies(),
    searchParams,
  ]);
  if (!trade) notFound();
  const urls = await signedShots(trade.journal_screenshots.map((s) => s.path));
  const shots = [...trade.journal_screenshots]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .flatMap((s) => {
      const url = urls.get(s.path);
      return url ? [{ id: s.id, url }] : [];
    });
  const net = trade.net_cents ?? trade.result_cents + trade.commission_cents + trade.swap_cents;
  const session = JOURNAL_SESSIONS.find((x) => x === trade.session);
  const direction = trade.direction === "short" ? "short" : "long";
  const heldMinutes = trade.opened_at
    ? Math.round((Date.parse(trade.closed_at) - Date.parse(trade.opened_at)) / 60_000)
    : null;
  const held =
    heldMinutes === null
      ? "—"
      : heldMinutes >= 1440
        ? `${Math.floor(heldMinutes / 1440)}d ${Math.floor((heldMinutes % 1440) / 60)}h`
        : `${Math.floor(heldMinutes / 60)}h ${heldMinutes % 60}m`;
  const facts: [string, string][] = [
    [t("detail.pips"), trade.pips === null ? "—" : decimal(trade.pips, 1)],
    [t("detail.r"), trade.r_multiple === null ? "—" : `${decimal(trade.r_multiple)} R`],
    [t("detail.session"), session ? t(`session.${session}`) : "—"],
    [t("detail.held"), held],
    [t("detail.lots"), trade.lots === null ? "—" : decimal(trade.lots)],
    [
      t("detail.source"),
      trade.source === "quick" ? t("detail.sourceQuick") : t("detail.sourceManual"),
    ],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <Link
        href="/accounts/trades"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("allTrades")}
      </Link>
      {search.saved === "1" ? (
        <p role="status" className="flex items-center gap-2 text-sm text-positive">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t("detail.saved")}
        </p>
      ) : null}
      <header className="space-y-3">
        <h1 className="font-heading text-2xl font-bold">
          <span className="font-mono">{trade.symbol}</span> {t(`direction.${direction}`)}
        </h1>
        <p
          className={cn(
            "font-mono tabular text-3xl font-semibold",
            net < 0 ? "text-danger" : net > 0 ? "text-positive" : "",
          )}
        >
          {money(net, trade.currency, true)}
          <span className="sr-only"> {t("detail.net")}</span>
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-mono tabular">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Screenshots tradeId={trade.id} shots={shots} symbol={trade.symbol} />

      <section aria-labelledby="edit" className="space-y-4">
        <h2 id="edit" className="font-heading text-lg font-semibold">
          {t("detail.edit")}
        </h2>
        <TradeForm
          tradeId={trade.id}
          zone={zone}
          tags={tags}
          strategies={strategies}
          symbols={SYMBOLS}
          defaults={{
            symbol: trade.symbol,
            direction,
            opened: trade.opened_at ? localInput(new Date(trade.opened_at), zone) : "",
            closed: localInput(new Date(trade.closed_at), zone),
            lots: str(trade.lots),
            entry: str(trade.entry),
            exit: str(trade.exit),
            stopLoss: str(trade.stop_loss),
            takeProfit: str(trade.take_profit),
            currency: trade.currency,
            result: fromMinor(trade.result_cents),
            commission: trade.commission_cents ? fromMinor(trade.commission_cents) : "",
            swap: trade.swap_cents ? fromMinor(trade.swap_cents) : "",
            strategy: trade.strategy_id ?? "",
            emotionBefore: str(trade.emotion_before),
            emotionAfter: str(trade.emotion_after),
            confidence: str(trade.confidence),
            notes: trade.notes ?? "",
            tags: trade.journal_trade_tags.map((x) => x.tag_id),
            rules: Object.fromEntries(
              trade.journal_trade_rule_checks.map(
                (c) => [c.rule_id, c.followed ? "followed" : "broken"] as const,
              ),
            ),
          }}
        />
      </section>

      <section className="border-t border-hairline pt-6">
        <DeleteTrade tradeId={trade.id} />
      </section>
    </div>
  );
}
