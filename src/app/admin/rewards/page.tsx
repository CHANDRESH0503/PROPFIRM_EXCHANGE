import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNow, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireReviewer } from "@/lib/auth/reviewer";
import { hasRole, getRoles } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";
import { RewardEditor, StockForm, RefundForm } from "./forms";
export const metadata = { title: "Rewards and inventory" };
export default function Page(props: PageProps<"/admin/rewards">) {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Stock {...props} />
    </Suspense>
  );
}
async function Stock({ searchParams }: PageProps<"/admin/rewards">) {
  await requireReviewer();
  const canEdit = hasRole(await getRoles(), "finance");
  const t = await getTranslations("stock"),
    query = await searchParams,
    db = createAdminClient();
  if (canEdit && (query.id || query.new)) {
    const id = z.uuid().safeParse(query.id);
    if (query.id && !id.success) notFound();
    const [item, programs] = await Promise.all([
      id.success ? db.from("rewards").select("*").eq("id", id.data).maybeSingle() : null,
      db.from("firm_programs").select("id,name,firms(name)").order("name"),
    ]);
    if (item?.error || programs.error) throw new Error("reward_settings_unavailable");
    if (id.success && !item?.data) notFound();
    return (
      <div className="space-y-6">
        <Link className="inline-flex min-h-11 items-center underline" href="/admin/rewards">
          {t("title")}
        </Link>
        <h1 className="text-2xl font-bold">{item?.data?.name ?? t("new")}</h1>
        {query.saved === "1" && <p role="status">{t("saved")}</p>}
        <RewardEditor
          reward={item?.data ?? null}
          programs={programs.data.map((p) => ({ id: p.id, name: p.firms.name + " · " + p.name }))}
        />
        {item?.data && item.data.kind !== "booster" && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">{t("upload")}</h2>
            <StockForm id={item.data.id} />
          </section>
        )}
      </div>
    );
  }
  const now = await getNow();
  const page = z.coerce.number().int().positive().max(10000).catch(1).parse(query.page);
  const [items, queue] = await Promise.all([
    canEdit ? db.from("rewards").select("id,name,kind,low_stock,active").order("name") : null,
    db
      .from("redemptions")
      .select("id,reward_name,target_at,cost_coins", { count: "exact" })
      .eq("status", "pending")
      .order("target_at")
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
  ]);
  if (items?.error || queue.error) throw new Error("reward_queue_unavailable");
  const stock = await Promise.all(
    (items?.data ?? []).map(async (r) => {
      if (r.kind === "booster") return { ...r, remaining: null };
      const count = await db
        .from("voucher_inventory")
        .select("id", { count: "exact", head: true })
        .eq("reward_id", r.id)
        .is("redemption_id", null)
        .or("expires_at.is.null,expires_at.gt." + now.toISOString());
      if (count.error) throw new Error("stock_count_unavailable");
      return { ...r, remaining: count.count ?? 0 };
    }),
  );
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {canEdit && (
        <section>
          <Link href="/admin/rewards?new=1" className="inline-flex min-h-11 items-center underline">
            {t("new")}
          </Link>
          <ul className="divide-y divide-hairline">
            {stock.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  className="inline-flex min-h-11 items-center underline"
                  href={`/admin/rewards?id=${r.id}`}
                >
                  {r.name}
                </Link>
                {r.remaining !== null && (
                  <span
                    className={
                      r.active && r.remaining <= r.low_stock
                        ? "text-caution"
                        : "text-muted-foreground"
                    }
                  >
                    {t(r.active && r.remaining <= r.low_stock ? "low" : "remaining", {
                      n: r.remaining,
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("queue")}</h2>
        {queue.data.length ? (
          <ul className="divide-y divide-hairline">
            {queue.data.map((d) => (
              <li className="py-3" key={d.id}>
                <h3>{d.reward_name}</h3>
                <p className="text-sm">
                  {t("due", { date: d.target_at.slice(0, 16).replace("T", " ") + " UTC" })}
                </p>
                <RefundForm id={d.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("empty")}</p>
        )}
        <nav className="flex gap-4">
          {page > 1 && <Link href={`/admin/rewards?page=${page - 1}`}>{t("previous")}</Link>}
          {(queue.count ?? 0) > page * 30 && (
            <Link href={`/admin/rewards?page=${page + 1}`}>{t("next")}</Link>
          )}
        </nav>
      </section>
    </div>
  );
}
