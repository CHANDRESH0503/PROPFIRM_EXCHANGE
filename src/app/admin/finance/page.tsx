import { Suspense } from "react";
import Link from "next/link";
import { getNow, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { money } from "@/lib/catalogue/programs";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportForm, DecisionForm, PaidForm } from "./forms";
export const metadata = { title: "Finance" };
export default function Page(props: PageProps<"/admin/finance">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
      <Finance {...props} />
    </Suspense>
  );
}
async function Finance({ searchParams }: PageProps<"/admin/finance">) {
  await requireStaff("finance");
  const [t, now] = await Promise.all([getTranslations("finance"), getNow()]);
  const db = createAdminClient();
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .catch(1)
    .parse((await searchParams).page);
  const [totals, queue, firms, maps, issues] = await Promise.all([
    db.from("finance_totals").select("*").single(),
    db
      .from("commission_matches")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
    db.from("firms").select("id,name").eq("is_sample", false).order("name"),
    db
      .from("commission_import_batches")
      .select("firm_id,mapping")
      .order("created_at", { ascending: false })
      .limit(250),
    db
      .from("commission_reconciliation")
      .select("issue,firm_name,order_ref,amount_cents,since,claim_id,commission_id")
      .order("since")
      .limit(100),
  ]);
  if (totals.error || queue.error || firms.error || maps.error || issues.error)
    throw new Error("finance_unavailable");
  const f = totals.data;
  const ratio = f.liability_ratio == null ? null : Number(f.liability_ratio);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
        {(["reported", "confirmed", "paid", "pending", "available", "ratio"] as const).map(
          (k, i) => (
            <div key={k} className="bg-surface p-4">
              <dt className="text-sm text-muted-foreground">{t(k)}</dt>
              <dd className="mt-2 font-mono tabular text-lg">
                {
                  [
                    money(f.reported_cents ?? 0, "USD"),
                    money(f.confirmed_cents ?? 0, "USD"),
                    money(f.paid_cents ?? 0, "USD"),
                    f.pending ?? 0,
                    f.available ?? 0,
                    ratio === null ? "—" : ratio.toFixed(3),
                  ][i]
                }
              </dd>
            </div>
          ),
        )}
      </dl>
      {ratio !== null && ratio > 1 && <p className="text-danger">{t("liabilityAlert")}</p>}
      <section>
        <h2 className="mb-3 text-xl font-semibold">{t("import")}</h2>
        {firms.data.length ? (
          <ReportForm
            firms={firms.data.map((f) => {
              const prior = z
                .object({ external: z.string(), order: z.string(), amount: z.string() })
                .safeParse(maps.data.find((m) => m.firm_id === f.id)?.mapping);
              return { ...f, mapping: prior.success ? prior.data : null };
            })}
          />
        ) : (
          <p>{t("noFirms")}</p>
        )}
      </section>
      <section aria-labelledby="reconciliation" className="space-y-3">
        <h2 id="reconciliation" className="text-xl font-semibold">
          {t("reconciliation")}
        </h2>
        <p className="text-sm text-text-soft">{t("reconciliationHelp")}</p>
        {issues.data.length ? (
          <ul className="divide-y divide-hairline rounded-2xl px-4 panel">
            {issues.data.map((r) => (
              <li
                key={`${r.issue}:${r.claim_id ?? ""}:${r.commission_id ?? ""}`}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <span>
                  <span className="block font-semibold">
                    {r.firm_name} · <span className="font-mono">{r.order_ref}</span>
                  </span>
                  <span className="block text-sm text-caution">
                    {t(
                      `issue.${r.issue as "claim_without_commission" | "commission_without_claim" | "unpaid"}`,
                    )}
                  </span>
                </span>
                <span className="font-mono tabular text-sm text-text-soft">
                  {money(r.amount_cents ?? 0, "USD")} · {r.since?.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-positive">{t("reconciliationEmpty")}</p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{t("paidTitle")}</h2>
        <PaidForm today={now.toISOString().slice(0, 10)} />
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">{t("reports")}</h2>
        {queue.data.length ? (
          <ul className="divide-y divide-hairline">
            {queue.data.map((c) => (
              <li key={c.id} className="py-4">
                <h3 className="font-semibold">
                  {c.firm_name} · {c.order_ref}
                </h3>
                <p className="font-mono tabular">
                  {c.external_ref} · {money(c.amount_cents ?? 0, "USD")}
                </p>
                <p>
                  {t(c.status as "reported" | "confirmed" | "released" | "reversed")} ·{" "}
                  {t("confidence", { score: c.confidence ?? 0 })}
                </p>
                {(c.status === "confirmed" || c.status === "released") &&
                  (c.paid_at ? (
                    <p className="text-sm text-positive">
                      {t("paidStatus", {
                        date: c.paid_at.slice(0, 10),
                        reference: c.paid_reference ?? "",
                      })}
                    </p>
                  ) : (
                    <label className="flex min-h-11 items-center gap-2 text-sm text-text-soft">
                      <input
                        type="checkbox"
                        name="commission"
                        value={c.id ?? ""}
                        form="mark-paid"
                        className="size-4 accent-[var(--brand)]"
                      />
                      {t("unpaid")} · {t("selectPaid")}
                    </label>
                  ))}
                {c.status !== "reversed" && c.id && (
                  <details>
                    <summary className="cursor-pointer py-3">{t("review")}</summary>
                    <DecisionForm
                      id={c.id}
                      confirmable={c.status === "reported" && c.claim_status === "approved"}
                      canReverse
                    />
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("empty")}</p>
        )}
        <nav className="flex gap-5">
          {page > 1 && <Link href={`/admin/finance?page=${page - 1}`}>{t("previous")}</Link>}
          {(queue.count ?? 0) > page * 30 && (
            <Link href={`/admin/finance?page=${page + 1}`}>{t("next")}</Link>
          )}
        </nav>
      </section>
    </div>
  );
}
