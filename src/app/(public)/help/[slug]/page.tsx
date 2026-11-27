import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlainText } from "@/components/support/plain-text";
import { Skeleton } from "@/components/ui/skeleton";
import { createAnonClient } from "@/lib/supabase/anon";

async function article(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { data, error } = await createAnonClient()
    .from("help_articles")
    .select("slug,title,summary,body,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("help_unavailable");
  return data;
}

export async function generateMetadata({ params }: PageProps<"/help/[slug]">): Promise<Metadata> {
  const a = await article((await params).slug);
  return a
    ? { title: a.title, description: a.summary, alternates: { canonical: `/help/${a.slug}` } }
    : { title: "Help centre" };
}

export default function ArticlePage(props: PageProps<"/help/[slug]">) {
  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Article {...props} />
      </Suspense>
    </article>
  );
}

async function Article({ params }: PageProps<"/help/[slug]">) {
  const [a, t] = await Promise.all([params.then((p) => article(p.slug)), getTranslations("help")]);
  if (!a) notFound();
  const updated = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(a.updated_at),
  );
  return (
    <div className="space-y-6">
      <Link
        href="/help"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
      >
        {t("all")}
      </Link>
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-bold">{a.title}</h1>
        <p className="text-sm text-muted-foreground">{t("updated", { date: updated })}</p>
      </header>
      <PlainText body={a.body} />
      <p className="border-t border-hairline pt-6 text-sm text-muted-foreground">
        {t("stillStuck")}{" "}
        <Link href="/support" className="underline">
          {t("contact")}
        </Link>
      </p>
    </div>
  );
}
