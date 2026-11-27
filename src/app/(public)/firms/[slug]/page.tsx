import { TitleIcon } from "@/components/layout/title-icon";
import { Trophy } from "lucide-react";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgramRow } from "@/components/catalogue/directory";
import { findPrograms, money, type Search } from "@/lib/catalogue/programs";
import { createClient } from "@/lib/supabase/server";

export default function Page(props: PageProps<"/firms/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-72 max-w-5xl" />}>
      <Firm {...props} />
    </Suspense>
  );
}
async function Firm({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  // Per-request: prices, eligibility and the deal sheet depend on the visitor's region and
  // session, so nothing below belongs in a prerendered shell.
  await connection();
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const search = await searchParams;
  const [{ programs, count, page, pageSize }, t, db] = await Promise.all([
    findPrograms({ page: search.page }, { slug }),
    getTranslations("catalogue"),
    createClient(),
  ]);
  const firm = programs[0];
  if (!firm) notFound();
  const [changes, prices] = await Promise.all([
    db
      .from("firm_changes")
      .select("id,summary,source_url,published_at")
      .eq("firm_id", firm.firm_id)
      .order("published_at", { ascending: false })
      .limit(30),
    db
      .from("firm_programs")
      .select("id,price_history(id,list_price_cents,currency,recorded_at)")
      .in(
        "id",
        programs.map((p) => p.program_id),
      )
      .order("recorded_at", { ascending: false, referencedTable: "price_history" })
      .order("id", { ascending: false, referencedTable: "price_history" })
      .limit(6, { referencedTable: "price_history" }),
  ]);
  if (prices.error) throw new Error("price_history_unavailable");
  const history = new Map(prices.data.map((row) => [row.id, row.price_history]));
  if (changes.error) throw new Error("firm_changes_unavailable");
  return (
    <article className="mx-auto w-full max-w-4xl space-y-8 px-5 py-10 sm:px-8">
      <header>
        <Link className="inline-flex min-h-11 items-center text-sm underline" href="/firms">
          {t("firms")}
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
          <TitleIcon icon={Trophy} hue="var(--brand)" />
          {firm.firm_name}
        </h1>
        <p className="mt-3 max-w-prose text-text-soft">{firm.description}</p>
        {firm.firm_status !== "active" && (
          <p className="mt-3 text-caution">
            {t(firm.firm_status === "watch" ? "watch" : "delisted")} {firm.status_note}
          </p>
        )}
      </header>
      <section>
        <h2 className="text-xl font-semibold">{t("programs")}</h2>
        <p className="my-3 max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
        <ul className="divide-y divide-hairline border-y border-hairline">
          {programs.map((p) => (
            <li className="space-y-3 py-5" key={p.program_id}>
              <ProgramRow p={p} />
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["steps", "drawdown", "dailyLoss", "maxLoss"] as const).map((label, i) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{t(label)}</dt>
                    <dd className="font-mono tabular">
                      {
                        [
                          p.steps,
                          t(p.drawdown_type as "static" | "trailing" | "end_of_day"),
                          p.daily_loss_bps == null ? "—" : p.daily_loss_bps / 100 + "%",
                          p.max_loss_bps == null ? "—" : p.max_loss_bps / 100 + "%",
                        ][i]
                      }
                    </dd>
                  </div>
                ))}
              </dl>
              {Boolean(history.get(p.program_id)?.length) && (
                <details>
                  <summary className="min-h-11 cursor-pointer content-center text-sm underline">
                    {t("recentPrices")}
                  </summary>
                  <ul className="max-w-sm divide-y divide-hairline">
                    {history.get(p.program_id)?.map((entry) => (
                      <li key={entry.id} className="flex justify-between gap-4 py-2 text-sm">
                        <time className="text-muted-foreground" dateTime={entry.recorded_at}>
                          {entry.recorded_at.slice(0, 10)}
                        </time>
                        <span className="font-mono tabular">
                          {money(entry.list_price_cents, entry.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {p.offer_terms && <p>{p.offer_terms}</p>}
              {!p.rebate_permission && (
                <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
              )}
              {!p.is_sample && p.rebate_permission && (
                <Link
                  className="mr-5 inline-flex min-h-11 items-center underline"
                  href={`/claims?program=${p.program_id}`}
                >
                  {t("claim")}
                </Link>
              )}
              <Link
                className="inline-flex min-h-11 items-center underline"
                href={`/compare?program=${p.program_id}`}
              >
                {t("compare")}
              </Link>
            </li>
          ))}
        </ul>
        <nav className="flex gap-5">
          {page > 1 && <Link href={`/firms/${slug}?page=${page - 1}`}>{t("previous")}</Link>}
          {page * pageSize < count && (
            <Link href={`/firms/${slug}?page=${page + 1}`}>{t("next")}</Link>
          )}
        </nav>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t("changes")}</h2>
        {changes.data.length ? (
          <ul className="divide-y divide-hairline">
            {changes.data.map((c) => (
              <li key={c.id} className="py-3">
                <p>{c.summary}</p>
                <a
                  className="inline-flex min-h-11 items-center underline"
                  href={c.source_url}
                  rel="external nofollow"
                >
                  {t("source")} · {c.published_at.slice(0, 10)}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">{t("noChanges")}</p>
        )}
      </section>
    </article>
  );
}
