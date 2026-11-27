import { TitleIcon } from "@/components/layout/title-icon";
import { Download } from "lucide-react";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOnboarded } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CancelDeletion, RequestDeletion } from "./forms";

export const metadata: Metadata = { title: "Your data" };

export default function DataPage(props: PageProps<"/profile/data">) {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Data {...props} />
    </Suspense>
  );
}

async function Data({ searchParams }: PageProps<"/profile/data">) {
  await requireOnboarded("/profile/data");
  const db = await createClient();
  const [t, requests, search] = await Promise.all([
    getTranslations("dataRights"),
    db
      .from("data_requests")
      .select("id,kind,status,due_at,requested_at")
      .order("requested_at", { ascending: false })
      .limit(10),
    searchParams,
  ]);
  if (requests.error) throw new Error("data_requests_unavailable");
  const deletion = requests.data.find(
    (r) => r.kind === "delete" && (r.status === "pending" || r.status === "confirmed"),
  );
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <Link
        href="/profile"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline"
      >
        {t("back")}
      </Link>
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        <TitleIcon icon={Download} hue="var(--positive)" />
        {t("title")}
      </h1>
      {search.scheduled === "1" ? (
        <p role="status" className="text-positive">
          {t("scheduled")}
        </p>
      ) : null}
      <section aria-labelledby="export" className="space-y-3">
        <h2 id="export" className="text-lg font-semibold">
          {t("exportTitle")}
        </h2>
        <p className="text-sm text-text-soft">{t("exportBody")}</p>
        <form action="/api/me/export" method="post">
          <Button type="submit" variant="secondary">
            {t("export")}
          </Button>
        </form>
      </section>
      <section aria-labelledby="delete" className="space-y-3 border-t border-hairline pt-8">
        <h2 id="delete" className="text-lg font-semibold">
          {t("deleteTitle")}
        </h2>
        <p className="text-sm text-text-soft">{t("deleteBody")}</p>
        {deletion?.status === "confirmed" && deletion.due_at ? (
          <>
            <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
              {t("due", { date: date.format(new Date(deletion.due_at)) })}
            </p>
            <CancelDeletion />
          </>
        ) : deletion?.status === "pending" ? (
          <>
            <p className="text-sm text-text-soft">{t("awaiting")}</p>
            <div className="flex flex-wrap gap-3">
              <RequestDeletion />
              <CancelDeletion />
            </div>
          </>
        ) : (
          <RequestDeletion />
        )}
      </section>
    </div>
  );
}
