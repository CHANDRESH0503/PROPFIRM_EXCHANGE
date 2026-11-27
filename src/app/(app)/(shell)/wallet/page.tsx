import { TitleIcon } from "@/components/layout/title-icon";
import { Wallet as WalletIcon } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireOnboarded } from "@/lib/auth/session";
import { walletBalance } from "@/lib/economy/wallet";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CoinAmount } from "@/components/ui/coin-amount";
import { Skeleton } from "@/components/ui/skeleton";
export const metadata = { title: "Wallet" };
export default function Page(props: PageProps<"/wallet">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
      <Wallet {...props} />
    </Suspense>
  );
}
async function Wallet({ searchParams }: PageProps<"/wallet">) {
  const { user } = await requireOnboarded("/wallet");
  const t = await getTranslations("wallet");
  const cursor = z.coerce
    .number()
    .int()
    .positive()
    .safeParse((await searchParams).before);
  const db = await createClient();
  let query = db
    .from("ledger_entries")
    .select("id,amount,bucket,type,ref_type,ref_id,created_at")
    .order("id", { ascending: false })
    .limit(31);
  if (cursor.success) query = query.lt("id", cursor.data);
  const [balance, entries, xp] = await Promise.all([
    walletBalance(user.id),
    query,
    db
      .from("xp_events")
      .select("id,amount,source,created_at")
      .order("id", { ascending: false })
      .limit(30),
  ]);
  if (entries.error || xp.error) throw new Error("wallet_history_unavailable");
  const ids = entries.data
    .filter((e) => e.bucket === "pending" && e.amount > 0 && e.ref_type === "commission")
    .map((e) => e.ref_id);
  const dates = ids.length
    ? await createAdminClient()
        .from("commissions")
        .select("id,release_at,status")
        .in("id", ids)
        .eq("status", "confirmed")
    : null;
  if (dates?.error) throw new Error("release_dates_unavailable");
  const releases = new Map(dates?.data?.map((c) => [c.id, c.release_at]));
  return (
    <div className="space-y-8">
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        <TitleIcon icon={WalletIcon} hue="var(--gold)" />
        {t("title")}
      </h1>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline">
        {(["available", "pending"] as const).map((k) => (
          <div key={k} className="bg-surface p-4">
            <dt className="text-muted-foreground">{t(k)}</dt>
            <dd className="mt-2">
              <CoinAmount value={balance[k]} size="lg" />
            </dd>
          </div>
        ))}
      </dl>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("history")}</h2>
        {entries.data.length ? (
          <ul className="divide-y divide-hairline border-y border-hairline">
            {entries.data.slice(0, 30).map((e) => (
              <li className="flex items-baseline justify-between gap-4 py-3" key={e.id}>
                <div>
                  <p>
                    {t(`types.${e.type}` as Parameters<typeof t>[0])} ·{" "}
                    {t(e.bucket as "pending" | "available")}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {e.created_at.slice(0, 10)}
                  </p>
                  {releases.get(e.ref_id) && (
                    <p className="text-sm">
                      {t("release", { date: releases.get(e.ref_id)!.slice(0, 10) })}
                    </p>
                  )}
                </div>
                <span className="font-mono tabular">
                  {e.amount > 0 ? "+" : ""}
                  {e.amount.toLocaleString("en-US")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("empty")}</p>
        )}
        {entries.data.length > 30 && (
          <Link
            className="inline-flex min-h-11 items-center underline"
            href={`/wallet?before=${entries.data[29]!.id}`}
          >
            {t("older")}
          </Link>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("xp")}</h2>
        {xp.data.length ? (
          <ul className="divide-y divide-hairline">
            {xp.data.map((e) => (
              <li className="flex justify-between gap-3 py-3" key={e.id}>
                <span>{t(`sources.${e.source}` as Parameters<typeof t>[0])}</span>
                <span className="font-mono tabular">{e.amount} XP</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("emptyXp")}</p>
        )}
      </section>
    </div>
  );
}
