import { TitleIcon } from "@/components/layout/title-icon";
import { LifeBuoy } from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { createAnonClient } from "@/lib/supabase/anon";

export const metadata: Metadata = {
  title: "Help centre",
  description: "Answers about claims, Coins, rewards, the trading journal and your account.",
  alternates: { canonical: "/help" },
};

const CATEGORIES = ["getting-started", "claims", "coins", "rewards", "journal", "account"] as const;

export default function HelpPage(props: PageProps<"/help">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Help {...props} />
      </Suspense>
    </div>
  );
}

async function Help({ searchParams }: PageProps<"/help">) {
  const q = (await searchParams).q;
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const t = await getTranslations("help");
  let request = createAnonClient()
    .from("help_articles")
    .select("slug,category,title,summary")
    .order("title");
  // Only letters, digits, spaces and hyphens reach the filter, so the query can't carry
  // LIKE wildcards or PostgREST filter syntax.
  const safe = query
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (safe) {
    const like = `"%${safe}%"`;
    request = request.or(`title.ilike.${like},summary.ilike.${like},body.ilike.${like}`);
  }
  const { data, error } = await request;
  if (error) throw new Error("help_unavailable");
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
          <TitleIcon icon={LifeBuoy} hue="var(--positive)" />
          {t("title")}
        </h1>
        <p className="text-text-soft">{t("intro")}</p>
        <form role="search" className="flex gap-2">
          <label htmlFor="help-q" className="sr-only">
            {t("search")}
          </label>
          <input
            id="help-q"
            name="q"
            defaultValue={query}
            placeholder={t("searchHint")}
            className="h-12 flex-1 rounded-xl border border-hairline bg-ink-deep/60 px-4 text-base"
          />
          <button className="h-12 rounded-lg bg-primary px-4 font-medium text-primary-foreground">
            {t("search")}
          </button>
        </form>
      </header>
      {data.length === 0 ? (
        <p className="text-text-soft">{t("empty")}</p>
      ) : (
        CATEGORIES.map((c) => {
          const list = data.filter((a) => a.category === c);
          if (!list.length) return null;
          return (
            <section key={c} aria-labelledby={`cat-${c}`} className="space-y-2">
              <h2 id={`cat-${c}`} className="font-heading text-lg font-semibold">
                {t(`categories.${c}`)}
              </h2>
              <ul className="divide-y divide-hairline rounded-2xl panel">
                {list.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/help/${a.slug}`} className="block px-4 py-3 hover:bg-raised">
                      <span className="block font-medium">{a.title}</span>
                      <span className="block text-sm text-muted-foreground">{a.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      <p className="text-sm text-muted-foreground">
        {t("stillStuck")}{" "}
        <Link href="/support" className="underline">
          {t("contact")}
        </Link>
      </p>
    </div>
  );
}
