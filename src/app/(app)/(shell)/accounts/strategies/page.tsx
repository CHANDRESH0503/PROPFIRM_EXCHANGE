import { TitleIcon } from "@/components/layout/title-icon";
import { Swords } from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { StrategyForm, StrategyItem, TagManager } from "@/components/journal/strategy-forms";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboarded } from "@/lib/auth/session";
import { journalStrategies, journalTags, ruleFollowRates } from "@/lib/journal/data";
import { percent } from "@/lib/journal/format";

export const metadata: Metadata = { title: "Strategies and tags" };

export default function StrategiesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Strategies />
    </Suspense>
  );
}

async function Strategies() {
  await requireOnboarded("/accounts/strategies");
  const [t, strategies, tags, rates] = await Promise.all([
    getTranslations("journal"),
    journalStrategies(),
    journalTags(),
    ruleFollowRates(),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <Link
        href="/accounts"
        className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("detail.back")}
      </Link>
      <header className="space-y-2">
        <h1 className="flex items-center gap-3 font-heading text-2xl font-bold">
          <TitleIcon icon={Swords} hue="var(--cyan)" />
          {t("strategiesPage.title")}
        </h1>
        <p className="text-sm text-text-soft">{t("strategiesPage.intro")}</p>
      </header>

      <section aria-labelledby="strategy-list" className="space-y-4">
        <h2 id="strategy-list" className="sr-only">
          {t("strategiesPage.title")}
        </h2>
        {strategies.length ? (
          <ul className="divide-y divide-hairline rounded-2xl panel">
            {strategies.map((s) => {
              const r = rates.get(s.id);
              return (
                <StrategyItem
                  key={s.id}
                  strategy={s}
                  rate={r && r.total ? percent((r.followed / r.total) * 100) : null}
                />
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("strategiesPage.empty")}</p>
        )}
        <details className="rounded-xl border border-hairline p-4" open={strategies.length === 0}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium">
            {t("strategiesPage.new")}
          </summary>
          <div className="mt-4">
            <StrategyForm />
          </div>
        </details>
      </section>

      <section aria-labelledby="tags" className="space-y-4">
        <h2 id="tags" className="font-heading text-lg font-semibold">
          {t("strategiesPage.tags")}
        </h2>
        <TagManager tags={tags} />
      </section>
    </div>
  );
}
