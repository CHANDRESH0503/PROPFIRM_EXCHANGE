import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/action-form";
import { Skeleton } from "@/components/ui/skeleton";
import { hasRole, requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDueDeletions } from "./actions";

export const metadata: Metadata = { title: "Data requests" };

export default function DataRequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Requests />
    </Suspense>
  );
}

async function Requests() {
  const { roles } = await requireStaff("support");
  const [t, s, { data, error }] = await Promise.all([
    getTranslations("adminData"),
    getTranslations("support"),
    createAdminClient()
      .from("data_requests")
      .select("id,user_id,kind,status,requested_at,due_at,completed_at")
      .order("requested_at", { ascending: false })
      .limit(100),
  ]);
  if (error) throw new Error("data_requests_unavailable");
  const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const due = data.filter(
    (r) =>
      r.kind === "delete" &&
      r.status === "confirmed" &&
      r.due_at &&
      new Date(r.due_at) <= new Date(),
  );
  const status = (v: string) =>
    v === "pending" || v === "confirmed" || v === "completed" || v === "cancelled" ? s(v) : v;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="max-w-prose text-sm text-text-soft">{t("intro")}</p>
      </header>
      {hasRole(roles, "owner") ? (
        <div className="space-y-2 rounded-xl border border-hairline p-4">
          <p className="text-sm">{t("due", { n: due.length })}</p>
          <ActionForm action={runDueDeletions} submit={t("run")} variant="danger" />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full text-left text-sm">
          <thead className="bg-raised text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("kind")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("member")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("status")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("requested")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("dueAt")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {data.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">{r.kind === "delete" ? s("delete") : s("export")}</td>
                <td className="px-3 py-2">
                  {r.user_id ? (
                    <Link href={`/admin/users/${r.user_id}`} className="underline">
                      {r.user_id.slice(0, 8)}
                    </Link>
                  ) : (
                    t("erased")
                  )}
                </td>
                <td className="px-3 py-2">{status(r.status)}</td>
                <td className="px-3 py-2">{date.format(new Date(r.requested_at))}</td>
                <td className="px-3 py-2">{r.due_at ? date.format(new Date(r.due_at)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
