import { TitleIcon } from "@/components/layout/title-icon";
import { Sparkles } from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlainText } from "@/components/support/plain-text";
import { Skeleton } from "@/components/ui/skeleton";
import { createAnonClient } from "@/lib/supabase/anon";

export const metadata: Metadata = {
  title: "What's new",
  description: "New features and changes.",
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <Suspense fallback={<Skeleton className="h-72" />}>
        <Changelog />
      </Suspense>
    </div>
  );
}

async function Changelog() {
  const [t, { data, error }] = await Promise.all([
    getTranslations("changelog"),
    createAnonClient()
      .from("changelog_entries")
      .select("id,title,body,published_at")
      .order("published_at", { ascending: false })
      .limit(50),
  ]);
  if (error) throw new Error("changelog_unavailable");
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-3 font-heading text-3xl font-bold">
        <TitleIcon icon={Sparkles} hue="var(--epic)" />
        {t("title")}
      </h1>
      {data.length ? (
        <ol className="space-y-8">
          {data.map((e) => (
            <li key={e.id} className="space-y-2 border-t border-hairline pt-6">
              {e.published_at ? (
                <time dateTime={e.published_at} className="text-sm text-muted-foreground">
                  {date.format(new Date(e.published_at))}
                </time>
              ) : null}
              <h2 className="font-heading text-xl font-semibold">{e.title}</h2>
              <PlainText body={e.body} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-text-soft">{t("empty")}</p>
      )}
    </div>
  );
}
