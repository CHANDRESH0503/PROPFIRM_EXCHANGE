import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage(props: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Users {...props} />
    </Suspense>
  );
}

async function Users({ searchParams }: PageProps<"/admin/users">) {
  const { user } = await requireStaff();
  const q = (await searchParams).q;
  const query = typeof q === "string" ? q.slice(0, 120) : "";
  const [t, found] = await Promise.all([
    getTranslations("adminUsers"),
    createAdminClient().rpc("admin_find_members", {
      p_actor: user.id,
      p_query: query,
      p_limit: 50,
    }),
  ]);
  if (found.error) throw new Error("members_unavailable");
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <form role="search" className="flex max-w-xl gap-2">
        <label className="sr-only" htmlFor="q">
          {t("search")}
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder={t("searchHint")}
          className="h-11 flex-1 rounded-xl border border-hairline bg-ink-deep/60 px-3 text-base"
        />
        <button className="h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground">
          {t("search")}
        </button>
      </form>
      {found.data.length ? (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-left text-sm">
            <thead className="bg-raised text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("email")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("code")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("country")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("joined")}
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("status")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {found.data.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2">
                    <Link href={`/admin/users/${m.id}`} className="underline">
                      {m.email}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono">{m.referral_code}</td>
                  <td className="px-3 py-2">{m.country_code ?? "—"}</td>
                  <td className="px-3 py-2">{date.format(new Date(m.created_at))}</td>
                  <td className="px-3 py-2">
                    {m.restriction
                      ? t(
                          `levels.${m.restriction === "banned" ? "banned" : m.restriction === "suspended" ? "suspended" : "frozen"}`,
                        )
                      : t("active")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-text-soft">{t("empty")}</p>
      )}
    </div>
  );
}
