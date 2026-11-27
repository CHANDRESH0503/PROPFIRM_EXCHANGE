import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { TradeForm } from "@/components/journal/trade-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboarded } from "@/lib/auth/session";
import { journalCurrencies, journalStrategies, journalTags } from "@/lib/journal/data";
import { localInput } from "@/lib/journal/dates";
import { SYMBOLS } from "@/lib/tools/instruments";

export const metadata: Metadata = { title: "Log a trade" };

export default function NewTradePage() {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-xl" />}>
      <NewTrade />
    </Suspense>
  );
}

async function NewTrade() {
  const { profile } = await requireOnboarded("/accounts/trades/new");
  const zone = profile.timezone ?? "UTC";
  const [t, tags, strategies, currencies] = await Promise.all([
    getTranslations("journal"),
    journalTags(),
    journalStrategies(),
    journalCurrencies(),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/accounts"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("detail.back")}
      </Link>
      <h1 className="font-heading text-2xl font-bold">{t("form.newTitle")}</h1>
      <TradeForm
        tradeId={null}
        zone={zone}
        tags={tags}
        strategies={strategies}
        symbols={SYMBOLS}
        defaults={{
          symbol: "",
          direction: "long",
          opened: "",
          closed: localInput(new Date(), zone),
          lots: "",
          entry: "",
          exit: "",
          stopLoss: "",
          takeProfit: "",
          currency: currencies[0] ?? "USD",
          result: "",
          commission: "",
          swap: "",
          strategy: "",
          emotionBefore: "",
          emotionAfter: "",
          confidence: "",
          notes: "",
          tags: [],
          rules: {},
        }}
      />
    </div>
  );
}
