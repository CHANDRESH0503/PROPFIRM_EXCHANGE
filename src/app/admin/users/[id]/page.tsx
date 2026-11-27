import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole, requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { MemberActions } from "./forms";

export const metadata: Metadata = { title: "Member" };

export default function MemberPage(props: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Member {...props} />
    </Suspense>
  );
}

async function Member({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, roles } = await requireStaff();
  const db = createAdminClient();
  const [
    t,
    found,
    balance,
    progress,
    restriction,
    wallet,
    claims,
    notes,
    tickets,
    budgets,
    threshold,
  ] = await Promise.all([
    getTranslations("adminUsers"),
    db.rpc("admin_find_members", { p_actor: user.id, p_query: id, p_limit: 1 }),
    db.from("wallet_balances").select("available,pending").eq("user_id", id).maybeSingle(),
    db.rpc("trader_progress", { p_user: id }).maybeSingle(),
    db
      .from("member_restrictions")
      .select("level,reason,member_message,set_at")
      .eq("user_id", id)
      .maybeSingle(),
    db.from("wallet_accounts").select("id").eq("user_id", id).maybeSingle(),
    db
      .from("purchase_claims")
      .select("id,order_ref,status,amount_paid_cents,currency,created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("member_notes")
      .select("id,body,created_at")
      .eq("user_id", id)
      .order("id", { ascending: false })
      .limit(20),
    db
      .from("support_tickets")
      .select("id,subject,status,created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("campaign_budget_usage").select("id,name,remaining,active,ends_at").eq("active", true),
    db
      .from("site_settings")
      .select("value")
      .eq("key", "economy.adjust_confirm_coins")
      .maybeSingle(),
  ]);
  const profile = found.data?.[0];
  if (found.error || !profile) notFound();
  const ledger = wallet.data
    ? await db
        .from("ledger_entries")
        .select("id,amount,bucket,type,created_at")
        .eq("wallet_id", wallet.data.id)
        .order("id", { ascending: false })
        .limit(50)
    : { data: [], error: null };
  if (
    balance.error ||
    restriction.error ||
    claims.error ||
    notes.error ||
    tickets.error ||
    budgets.error ||
    ledger.error
  ) {
    throw new Error("member_unavailable");
  }
  const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const num = new Intl.NumberFormat("en-US");
  const open = (budgets.data ?? []).filter((b) => !b.ends_at || new Date(b.ends_at) > new Date());
  const facts: [string, string][] = [
    [t("email"), profile.email],
    [t("code"), profile.referral_code],
    [t("country"), profile.country_code ?? "—"],
    [t("joined"), date.format(new Date(profile.created_at))],
    [t("available"), num.format(Number(balance.data?.available ?? 0))],
    [t("pending"), num.format(Number(balance.data?.pending ?? 0))],
    [t("xp"), num.format(Number(progress.data?.xp ?? 0))],
    [t("level"), progress.data?.level_name ?? "—"],
    [t("streak"), String(progress.data?.streak ?? 0)],
  ];
  return (
    <div className="space-y-8">
      <Link
        href="/admin/users"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline"
      >
        {t("back")}
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold break-all">{profile.email}</h1>
        {restriction.data ? (
          <p className="rounded-lg border border-caution/40 bg-caution/10 p-3 text-sm">
            <strong>
              {t(
                `levels.${restriction.data.level === "banned" ? "banned" : restriction.data.level === "suspended" ? "suspended" : "frozen"}`,
              )}
            </strong>
            {" · "}
            {restriction.data.reason}
          </p>
        ) : null}
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono tabular break-all">{v}</dd>
          </div>
        ))}
      </dl>

      <MemberActions
        member={id}
        budgets={open
          .map((b) => ({ id: b.id ?? "", name: b.name ?? "", remaining: Number(b.remaining ?? 0) }))
          .filter((b) => b.id)}
        threshold={Number(threshold.data?.value ?? 5000)}
        restriction={restriction.data?.level ?? null}
        canFinance={hasRole(roles, "finance")}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("ledger")}</h2>
        {ledger.data.length ? (
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-left text-sm">
              <thead className="bg-raised text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("when")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("type")}
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    {t("bucket")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    {t("amount")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {ledger.data.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2">{date.format(new Date(e.created_at))}</td>
                    <td className="px-3 py-2 font-mono">{e.type}</td>
                    <td className="px-3 py-2">{e.bucket}</td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular ${e.amount < 0 ? "text-danger" : ""}`}
                    >
                      {num.format(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noLedger")}</p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("claims")}</h2>
          <ul className="divide-y divide-hairline border-y border-hairline text-sm">
            {(claims.data ?? []).map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-2">
                <Link href={`/admin/claims?claim=${c.id}`} className="underline">
                  {c.order_ref}
                </Link>
                <span>{c.status}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("tickets")}</h2>
          <ul className="divide-y divide-hairline border-y border-hairline text-sm">
            {(tickets.data ?? []).map((s) => (
              <li key={s.id} className="flex justify-between gap-3 py-2">
                <Link href={`/admin/support/${s.id}`} className="underline">
                  {s.subject}
                </Link>
                <span>{s.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("notes")}</h2>
        <ul className="space-y-2 text-sm">
          {(notes.data ?? []).map((n) => (
            <li key={n.id} className="rounded-lg border border-hairline p-3">
              <p className="text-xs text-muted-foreground">{date.format(new Date(n.created_at))}</p>
              <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
