import { TitleIcon } from "@/components/layout/title-icon";
import { Calculator } from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { brand } from "@/config/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { calculator, CALCULATORS, withDefaults, type CalculatorKey } from "@/lib/tools/calculators";
import { indicativePrices } from "@/lib/prices/provider";
import { publicEnv } from "@/lib/public-env";
import { CalculatorForm } from "./calculator-form";
import { loose } from "./text";

type Search = Promise<Record<string, string | string[] | undefined>>;

export async function toolMetadata(tool: CalculatorKey): Promise<Metadata> {
  const t = loose(await getTranslations("tools"));
  const title = t(`${tool}.title`);
  const description = t(`${tool}.metaDescription`);
  return {
    title,
    description,
    alternates: { canonical: `/tools/${tool}` },
    openGraph: { title, description, url: `/tools/${tool}` },
  };
}

/** Shared page frame: the explanation is static (indexable); only the form reads the URL. */
export async function ToolPage({
  tool,
  searchParams,
}: {
  tool: CalculatorKey;
  searchParams: Search;
}) {
  const t = loose(await getTranslations("tools"));
  const explain = t.raw(`${tool}.explain`);
  const paragraphs = Array.isArray(explain)
    ? explain.filter((p): p is string => typeof p === "string")
    : [];
  const related = CALCULATORS.filter((k) => k !== tool);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: t(`${tool}.title`),
    description: t(`${tool}.metaDescription`),
    url: new URL(`/tools/${tool}`, publicEnv.siteUrl).toString(),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: brand.name },
  };

  return (
    <article className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <script
        type="application/ld+json"
        // Static data from our own messages; `<` is escaped so the payload cannot close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label={t("common.breadcrumb")} className="text-sm text-muted-foreground">
        <Link href="/tools" className="inline-flex min-h-11 items-center hover:text-foreground">
          {t("common.allTools")}
        </Link>
      </nav>
      <header className="mt-2 max-w-prose space-y-3">
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
          <TitleIcon icon={Calculator} hue="var(--cyan)" />
          {t(`${tool}.title`)}
        </h1>
        <p className="text-text-soft">{t(`${tool}.intro`)}</p>
      </header>

      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <Form tool={tool} searchParams={searchParams} />
        </Suspense>
      </div>

      <section className="mt-14 max-w-prose space-y-3" aria-labelledby="maths">
        <h2 id="maths" className="font-heading text-lg font-semibold">
          {t("common.maths")}
        </h2>
        {paragraphs.map((p) => (
          <p key={p} className="leading-relaxed text-text-soft">
            {p}
          </p>
        ))}
        <p className="text-sm leading-relaxed text-muted-foreground">{t("common.noAdvice")}</p>
      </section>

      <nav aria-labelledby="more-tools" className="mt-14 border-t border-hairline pt-8">
        <h2 id="more-tools" className="font-heading text-base font-semibold">
          {t("common.moreTools")}
        </h2>
        <ul className="mt-3 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          {related.map((k) => (
            <li key={k}>
              <Link
                href={`/tools/${k}`}
                className="inline-flex min-h-11 items-center text-text-soft hover:text-foreground"
              >
                {t(`${k}.title`)}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/tools/market-sessions"
              className="inline-flex min-h-11 items-center text-text-soft hover:text-foreground"
            >
              {t("sessions.title")}
            </Link>
          </li>
        </ul>
      </nav>
    </article>
  );
}

async function Form({ tool, searchParams }: { tool: CalculatorKey; searchParams: Search }) {
  const [search, market] = await Promise.all([searchParams, indicativePrices()]);
  const calc = calculator(tool);
  const fromUrl = calc.fields.some((f) => typeof search[f.name] === "string");
  return (
    <CalculatorForm
      tool={tool}
      initial={withDefaults(calc, search)}
      fromUrl={fromUrl}
      market={market && { prices: market.prices, asOf: market.asOf }}
    />
  );
}
