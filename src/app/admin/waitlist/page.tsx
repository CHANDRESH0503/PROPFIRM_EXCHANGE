import { Suspense } from "react";
import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

export const metadata = { title: "Waitlist" };

const PAGE = 50;

export default function WaitlistAdminPage({ searchParams }: PageProps<"/admin/waitlist">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Waitlist searchParams={searchParams} />
    </Suspense>
  );
}

const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/** Cursor pagination on `seq` (newest first), never offset (18-data-and-operations.md §3). */
async function Waitlist({ searchParams }: Pick<PageProps<"/admin/waitlist">, "searchParams">) {
  await requireStaff("support");
  const [t, nav] = await Promise.all([
    getTranslations("admin.waitlist"),
    getTranslations("admin.nav"),
  ]);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase().slice(0, 100) : "";
  const before =
    typeof params.before === "string" && /^\d+$/.test(params.before) ? Number(params.before) : null;

  let query = createAdminClient()
    .from("waitlist_signups")
    .select("seq, email, status, confirmed_referrals, source, country_code, created_at")
    .order("seq", { ascending: false })
    .limit(PAGE + 1);
  if (q) query = query.ilike("email", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  if (before) query = query.lt("seq", before);
  const { data, error } = await query;
  if (error) throw new Error(`waitlist: ${error.code}`);

  const rows = data.slice(0, PAGE);
  const nextCursor = data.length > PAGE ? rows.at(-1)?.seq : null;
  const qs = (extra: Record<string, string>) =>
    new URLSearchParams({ ...(q ? { q } : {}), ...extra }).toString();
  const cols = ["email", "status", "referrals", "source", "country", "joined"] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">{nav("waitlist")}</h1>
        <a
          href={`/admin/waitlist/export${q ? `?${qs({})}` : ""}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("export")}
        </a>
      </div>

      <form role="search" className="max-w-sm">
        <label htmlFor="q" className="sr-only">
          {t("search")}
        </label>
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("search")}
          autoComplete="off"
        />
      </form>

      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-surface text-muted-foreground">
            <tr>
              {cols.map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-medium">
                  {t(`columns.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-4 py-8 text-center text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.seq}>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-xs font-medium",
                        r.status === "confirmed" ? "text-positive" : "text-muted-foreground",
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono tabular">{r.confirmed_referrals}</td>
                  <td className="px-4 py-3 text-text-soft">{r.source ?? "—"}</td>
                  <td className="px-4 py-3 text-text-soft">{r.country_code ?? "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-text-soft">
                    {when.format(new Date(r.created_at))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        {before ? (
          <Link
            href={`/admin/waitlist${q ? `?${qs({})}` : ""}` as Route}
            className={buttonVariants({ variant: "ghost" })}
          >
            {t("first")}
          </Link>
        ) : null}
        {nextCursor ? (
          <Link
            href={`/admin/waitlist?${qs({ before: String(nextCursor) })}` as Route}
            className={buttonVariants({ variant: "secondary" })}
          >
            {t("next")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
