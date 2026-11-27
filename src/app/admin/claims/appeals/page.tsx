import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireReviewer } from "@/lib/auth/reviewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Labelled, inputClass, areaClass } from "@/components/admin/form-fields";
import { Skeleton } from "@/components/ui/skeleton";
import { decideAppeal } from "./actions";

export const metadata = { title: "Claim appeals" };
export default function Page(props: PageProps<"/admin/claims/appeals">) {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Queue {...props} />
    </Suspense>
  );
}
async function Queue({ searchParams }: PageProps<"/admin/claims/appeals">) {
  const reviewer = await requireReviewer();
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse((await searchParams).page);
  const db = createAdminClient();
  const [t, queue, others] = await Promise.all([
    getTranslations("appeals"),
    db
      .from("claim_appeals")
      .select(
        "id,first_reviewer,evidence,purchase_claims!inner(id,order_ref,review_note,reviewed_at,receipt_path)",
      )
      .eq("status", "pending")
      .order("created_at")
      .order("id")
      .range((page - 1) * 25, page * 25),
    db
      .from("admin_roles")
      .select("user_id")
      .in("role", ["owner", "finance", "support"])
      .neq("user_id", reviewer.id)
      .limit(1),
  ]);
  if (queue.error || others.error) throw new Error("appeal_queue_unavailable");
  return (
    <section className="space-y-5">
      <Link className="inline-flex min-h-11 items-center underline" href="/admin/claims">
        {t("claimsQueue")}
      </Link>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {queue.data.length === 0 && <p>{t("empty")}</p>}
      <ul className="divide-y divide-hairline">
        {queue.data.slice(0, 25).map((a) => {
          const claim = a.purchase_claims;
          return (
            <li key={a.id} className="space-y-3 py-5">
              <h2 className="text-lg font-semibold">
                {t("order", { reference: claim.order_ref })}
              </h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-muted-foreground">{t("rejectionNote")}</dt>
                  <dd className="whitespace-pre-wrap">{claim.review_note}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t("evidence")}</dt>
                  <dd className="whitespace-pre-wrap">{a.evidence}</dd>
                </div>
              </dl>
              {claim.receipt_path && (
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  prefetch={false}
                  target="_blank"
                  rel="noopener"
                  href={`/admin/claims/${claim.id}/receipt`}
                >
                  {t("receipt")}
                </Link>
              )}
              {a.first_reviewer === reviewer.id && others.data.length > 0 ? (
                <p className="text-muted-foreground">{t("otherReviewer")}</p>
              ) : (
                <ActionForm action={decideAppeal.bind(null, a.id)} submit={t("save")}>
                  <Labelled label={t("decision")}>
                    <select name="decision" className={inputClass} required defaultValue="">
                      <option value="" disabled>
                        {t("choose")}
                      </option>
                      <option value="uphold">{t("uphold")}</option>
                      <option value="overturn">{t("overturn")}</option>
                    </select>
                  </Labelled>
                  <Labelled label={t("decisionNote")}>
                    <textarea
                      className={areaClass}
                      name="note"
                      required
                      minLength={3}
                      maxLength={1000}
                    />
                  </Labelled>
                </ActionForm>
              )}
            </li>
          );
        })}
      </ul>
      <nav className="flex gap-4">
        {page > 1 && <Link href={`/admin/claims/appeals?page=${page - 1}`}>{t("newerPage")}</Link>}
        {queue.data.length > 25 && (
          <Link href={`/admin/claims/appeals?page=${page + 1}`}>{t("olderPage")}</Link>
        )}
      </nav>
    </section>
  );
}
