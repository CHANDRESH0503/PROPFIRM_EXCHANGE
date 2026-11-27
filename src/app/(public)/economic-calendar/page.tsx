import { TitleIcon } from "@/components/layout/title-icon";
import { CalendarClock, Mail } from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarView } from "@/components/tools/calendar-view";
import { Skeleton } from "@/components/ui/skeleton";
import { calendarFeed } from "@/lib/calendar/provider";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tools.calendar");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: "/economic-calendar" },
  };
}

export default async function Page() {
  const [t, common] = await Promise.all([
    getTranslations("tools.calendar"),
    getTranslations("tools.common"),
  ]);
  return (
    <article className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <nav aria-label={common("breadcrumb")} className="text-sm text-muted-foreground">
        <Link href="/tools" className="inline-flex min-h-11 items-center hover:text-foreground">
          {common("allTools")}
        </Link>
      </nav>
      <header className="mt-2 max-w-prose space-y-3">
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
          <TitleIcon icon={CalendarClock} hue="var(--cyan)" />
          {t("title")}
        </h1>
        <p className="text-text-soft">{t("intro")}</p>
        <Link
          href="/notifications#digest"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-cyan underline decoration-cyan/40 underline-offset-4 hover:decoration-current"
        >
          <Mail className="size-4" aria-hidden="true" />
          {t("digestCta")}
        </Link>
      </header>
      <div className="mt-8">
        <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-xl" />}>
          <Feed />
        </Suspense>
      </div>
      <section className="mt-14 max-w-prose space-y-3" aria-labelledby="about-calendar">
        <h2 id="about-calendar" className="font-heading text-lg font-semibold">
          {t("aboutTitle")}
        </h2>
        <p className="leading-relaxed text-text-soft">{t("about")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{common("noAdvice")}</p>
      </section>
    </article>
  );
}

async function Feed() {
  const [t, feed] = await Promise.all([getTranslations("tools.calendar"), calendarFeed()]);
  return (
    <div className="space-y-6">
      {feed.licensed ? null : (
        <p
          role="note"
          className="rounded-xl border border-caution/40 bg-caution/10 p-4 text-sm leading-relaxed text-caution"
        >
          {t("sample")}
        </p>
      )}
      <CalendarView events={feed.events} />
    </div>
  );
}
