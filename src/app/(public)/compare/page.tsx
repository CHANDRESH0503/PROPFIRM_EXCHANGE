import { TitleIcon } from "@/components/layout/title-icon";
import { GitCompareArrows } from "lucide-react";
import { MissionVisit } from "@/components/engagement/mission-visit";
import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { findPrograms, money, type Search, type Program } from "@/lib/catalogue/programs";

export const metadata = { title: "Compare programs" };
export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-72 max-w-5xl" />}>
      <Comparison search={searchParams} />
    </Suspense>
  );
}
async function Comparison({ search }: { search: Promise<Search> }) {
  const t = await getTranslations("catalogue");
  const { program } = await search;
  const ids = z
    .array(z.uuid())
    .min(1)
    .max(4)
    .safeParse([...new Set([program ?? []].flat())]);
  const programs = ids.success ? (await findPrograms({}, { ids: ids.data })).programs : [];
  const rows: [string, (p: Program) => string | number][] = [
    [t("size"), (p) => money(p.account_size * 100, p.currency)],
    [t("steps"), (p) => p.steps],
    [t("list"), (p) => money(p.list_price_cents, p.currency)],
    [t("checkout"), (p) => money(p.checkout_cents, p.currency)],
    [t("coins"), (p) => p.estimated_coins],
    [t("net"), (p) => money(p.net_cents, p.currency)],
    [t("drawdown"), (p) => t(p.drawdown_type as "static" | "trailing" | "end_of_day")],
    [t("dailyLoss"), (p) => (p.daily_loss_bps == null ? "—" : p.daily_loss_bps / 100 + "%")],
    [t("maxLoss"), (p) => (p.max_loss_bps == null ? "—" : p.max_loss_bps / 100 + "%")],
    [t("payout"), (p) => p.payout_frequency],
  ];
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-5 py-10 sm:px-8">
      {programs.length >= 2 && <MissionVisit event="programs_compared" />}
      <h1 className="flex items-center gap-3 text-3xl font-bold">
        <TitleIcon icon={GitCompareArrows} hue="var(--pink)" />
        {t("compare")}
      </h1>
      <p className="max-w-prose text-text-soft">
        {t(ids.success && programs.length ? "intro" : "selection")}
      </p>
      {programs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{t("compare")}</caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  {t("programs")}
                </th>
                {programs.map((p) => (
                  <th className="min-w-36 p-3 align-top" key={p.program_id} scope="col">
                    <Link className="underline" href={`/firms/${p.slug}`}>
                      {p.firm_name}
                    </Link>
                    <p className="font-normal">{p.program_name}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, value]) => (
                <tr className="border-t border-hairline" key={label}>
                  <th scope="row" className="bg-surface p-3 font-medium">
                    {label}
                  </th>
                  {programs.map((p) => (
                    <td className="p-3 font-mono tabular" key={p.program_id}>
                      {value(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link href="/firms" className="inline-flex min-h-11 items-center underline">
        {t("browse")}
      </Link>
    </div>
  );
}
