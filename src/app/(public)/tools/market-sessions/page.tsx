import { TitleIcon } from "@/components/layout/title-icon";
import { Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SessionsClock } from "@/components/tools/sessions-clock";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools.sessions");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/tools/market-sessions" },
  };
}

export default async function Page() {
  const [t, common] = await Promise.all([
    getTranslations("tools.sessions"),
    getTranslations("tools.common"),
  ]);
  const explain = t.raw("explain");
  const paragraphs = Array.isArray(explain)
    ? explain.filter((p): p is string => typeof p === "string")
    : [];
  return (
    <article className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <nav aria-label={common("breadcrumb")} className="text-sm text-muted-foreground">
        <Link href="/tools" className="inline-flex min-h-11 items-center hover:text-foreground">
          {common("allTools")}
        </Link>
      </nav>
      <header className="mt-2 max-w-prose space-y-3">
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
          <TitleIcon icon={Clock} hue="var(--cyan)" />
          {t("title")}
        </h1>
        <p className="text-text-soft">{t("intro")}</p>
      </header>
      <div className="mt-8">
        <SessionsClock />
      </div>
      <section className="mt-14 max-w-prose space-y-3" aria-labelledby="about-sessions">
        <h2 id="about-sessions" className="font-heading text-lg font-semibold">
          {common("maths")}
        </h2>
        {paragraphs.map((p) => (
          <p key={p} className="leading-relaxed text-text-soft">
            {p}
          </p>
        ))}
      </section>
    </article>
  );
}
