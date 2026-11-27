import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireReviewer } from "@/lib/auth/reviewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { money } from "@/lib/catalogue/programs";
import { Skeleton } from "@/components/ui/skeleton";
import { ReviewForm } from "./review-form";
export const metadata = { title: "Claims queue" };
export default function Page(props: PageProps<"/admin/claims">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
      <Queue {...props} />
    </Suspense>
  );
}
async function Queue({ searchParams }: PageProps<"/admin/claims">) {
  await requireReviewer();
  const params = await searchParams;
  const item = params.claim === undefined ? null : z.uuid().safeParse(params.claim);
  if (item && !item.success) notFound();
  const page = z.coerce.number().int().min(1).max(10000).catch(1).parse(params.page);
  const t = await getTranslations("purchase");
  let query = createAdminClient()
    .from("purchase_claims")
    .select(
      "id,order_ref,checkout_email,purchased_on,amount_paid_cents,expected_cents,currency,status,created_at,click_id,firm_programs(name),firms(name)",
      { count: "exact" },
    );
  query = item?.success
    ? query.eq("id", item.data)
    : query.in("status", ["submitted", "needs_info", "flagged"]);
  const { data, error, count } = await query
    .order("created_at")
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("claim_queue_unavailable");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t("queue")}</h1>
      <Link className="inline-flex min-h-11 items-center underline" href="/admin/claims/appeals">
        {t("appeals")}
      </Link>
      {!data.length && <p className="text-muted-foreground">{t("queueEmpty")}</p>}
      <ul className="divide-y divide-hairline">
        {data.map((c) => (
          <li key={c.id} className="py-4">
            <h2 className="text-lg font-semibold">
              {c.firms?.name} · {c.firm_programs?.name}
            </h2>
            <p className="font-mono tabular">
              {c.order_ref} · {money(c.amount_paid_cents, c.currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              {c.purchased_on} · {c.checkout_email}
            </p>
            <p>
              {t(`status.${c.status}` as Parameters<typeof t>[0])} ·{" "}
              {t(c.click_id ? "clickFound" : "noClick")}
            </p>
            {c.expected_cents !== c.amount_paid_cents && (
              <p className="text-caution">
                {t("priceCheck", { expected: money(c.expected_cents, c.currency) })}
              </p>
            )}
            <Link
              href={`/admin/claims/${c.id}/receipt`}
              prefetch={false}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center underline"
            >
              {t("view")}
            </Link>
            {["submitted", "needs_info", "flagged"].includes(c.status) && <ReviewForm id={c.id} />}
          </li>
        ))}
      </ul>
      <nav className="flex gap-4">
        {page > 1 && <Link href={`/admin/claims?page=${page - 1}`}>{t("previous")}</Link>}
        {(count ?? 0) > page * 25 && (
          <Link href={`/admin/claims?page=${page + 1}`}>{t("next")}</Link>
        )}
      </nav>
    </div>
  );
}
