import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { BudgetForm } from "./forms";

export const metadata: Metadata = { title: "Campaign budgets" };

export default function CampaignsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Campaigns />
    </Suspense>
  );
}

async function Campaigns() {
  await requireStaff("finance");
  const [t, budgets] = await Promise.all([
    getTranslations("campaigns"),
    createAdminClient().from("campaign_budget_usage").select("*").order("name"),
  ]);
  if (budgets.error) throw new Error("budgets_unavailable");
  const num = new Intl.NumberFormat("en-US");
  // datetime-local wants local wall time without a zone; staff edit in UTC.
  const local = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="max-w-prose text-sm text-text-soft">{t("intro")}</p>
      </header>
      <ul className="space-y-6">
        {budgets.data.map((b) =>
          b.id ? (
            <li key={b.id} className="space-y-3 rounded-xl border border-hairline p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-semibold">{b.name}</h2>
                <p className="font-mono tabular text-sm">
                  {t("usage", {
                    granted: num.format(Number(b.granted ?? 0)),
                    cap: num.format(Number(b.cap_coins ?? 0)),
                  })}
                </p>
              </div>
              <BudgetForm
                budget={{
                  id: b.id,
                  name: b.name ?? "",
                  purpose: b.purpose ?? "",
                  cap: Number(b.cap_coins ?? 0),
                  ends: local(b.ends_at),
                  active: Boolean(b.active),
                }}
              />
            </li>
          ) : null,
        )}
      </ul>
      <section className="space-y-3 rounded-xl border border-hairline p-4">
        <h2 className="font-semibold">{t("new")}</h2>
        <BudgetForm />
      </section>
    </div>
  );
}
