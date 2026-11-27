import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChangelogForm } from "@/app/admin/help/forms";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Changelog" };

export default function AdminChangelogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Entries />
    </Suspense>
  );
}

async function Entries() {
  await requireStaff("content");
  const [t, { data, error }] = await Promise.all([
    getTranslations("adminContent"),
    createAdminClient()
      .from("changelog_entries")
      .select("id,title,body,status,published_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (error) throw new Error("changelog_unavailable");
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("changelogTitle")}</h1>
      <section className="space-y-3 rounded-xl border border-hairline p-4">
        <h2 className="font-semibold">{t("newEntry")}</h2>
        <ChangelogForm />
      </section>
      <ul className="space-y-3">
        {data.map((e) => (
          <li key={e.id}>
            <details className="rounded-xl border border-hairline p-4">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{e.title}</span>
                <span className="text-sm text-muted-foreground">
                  {t(
                    `statuses.${e.status === "published" ? "published" : e.status === "archived" ? "archived" : "draft"}`,
                  )}
                </span>
              </summary>
              <div className="mt-4">
                <ChangelogForm entry={e} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
