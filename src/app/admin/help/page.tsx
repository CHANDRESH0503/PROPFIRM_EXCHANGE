import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ArticleForm } from "./forms";

export const metadata: Metadata = { title: "Help centre" };

export default function AdminHelpPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Articles />
    </Suspense>
  );
}

async function Articles() {
  await requireStaff();
  const [t, { data, error }] = await Promise.all([
    getTranslations("adminContent"),
    createAdminClient()
      .from("help_articles")
      .select("id,slug,category,title,summary,body,status")
      .order("category")
      .order("title"),
  ]);
  if (error) throw new Error("help_unavailable");
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("helpTitle")}</h1>
      <section className="space-y-3 rounded-xl border border-hairline p-4">
        <h2 className="font-semibold">{t("newArticle")}</h2>
        <ArticleForm />
      </section>
      <ul className="space-y-3">
        {data.map((a) => (
          <li key={a.id}>
            <details className="rounded-xl border border-hairline p-4">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.title}</span>
                <span className="text-sm text-muted-foreground">
                  {a.category} ·{" "}
                  {t(
                    `statuses.${a.status === "published" ? "published" : a.status === "archived" ? "archived" : "draft"}`,
                  )}
                </span>
              </summary>
              <div className="mt-4">
                <ArticleForm article={a} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
