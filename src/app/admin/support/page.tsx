import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireReviewer } from "@/lib/auth/reviewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
export default function Page(props: PageProps<"/admin/support">) {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Queue {...props} />
    </Suspense>
  );
}
async function Queue({ searchParams }: PageProps<"/admin/support">) {
  await requireReviewer();
  const t = await getTranslations("support");
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse((await searchParams).page);
  const { data, error } = await createAdminClient()
    .from("support_tickets")
    .select("id,subject,status")
    .neq("status", "resolved")
    .order("respond_by", { nullsFirst: false })
    .order("id")
    .range((page - 1) * 30, page * 30);
  if (error) throw new Error("support_unavailable");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("queue")}</h1>
      {data.length ? (
        <ul className="divide-y divide-hairline">
          {data.slice(0, 30).map((row) => (
            <li key={row.id}>
              <Link
                className="inline-flex min-h-11 items-center underline"
                href={`/admin/support/${row.id}`}
              >
                {row.subject}
              </Link>{" "}
              · {t(`statuses.${row.status as "open" | "waiting_on_user"}`)}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("none")}</p>
      )}
      <nav className="flex gap-4">
        {page > 1 && <Link href={`/admin/support?page=${page - 1}`}>{t("previous")}</Link>}
        {data.length > 30 && <Link href={`/admin/support?page=${page + 1}`}>{t("next")}</Link>}
      </nav>
    </div>
  );
}
