import { TitleIcon } from "@/components/layout/title-icon";
import { Ticket } from "lucide-react";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getNow, getTranslations } from "next-intl/server";
import { requireOnboarded } from "@/lib/auth/session";
import { getFlags } from "@/lib/flags";
import { requestMeta } from "@/lib/http/request";
import { createClient } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionForm } from "@/components/admin/action-form";
import { enterDraw } from "./actions";
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-56" />}>
      <Draws />
    </Suspense>
  );
}
async function Draws() {
  const { user, profile } = await requireOnboarded("/draws");
  const [flags, meta, t, now] = await Promise.all([
    getFlags(),
    requestMeta(),
    getTranslations("support"),
    getNow(),
  ]);
  const flag = flags.draws;
  if (
    !flag?.enabled ||
    [meta.ipCountry, profile.country_code].some((c) => c && flag.excluded_countries.includes(c))
  )
    notFound();
  const db = await createClient();
  const [{ data, error }, entries] = await Promise.all([
    db
      .from("draws")
      .select("id,title,prize,starts_at,ends_at,status,winner_label")
      .lte("starts_at", now.toISOString())
      .order("ends_at", { ascending: false })
      .limit(30),
    db.from("draw_entries").select("draw_id,tickets,free_entry").eq("user_id", user.id),
  ]);
  if (error || entries.error) throw new Error("draws_unavailable");
  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-3 text-2xl font-bold">
        <TitleIcon icon={Ticket} hue="var(--gold)" />
        {t("draws")}
      </h1>
      {data.length ? (
        <ul className="divide-y divide-hairline">
          {data.map((draw) => {
            const entry = entries.data.find((e) => e.draw_id === draw.id);
            return (
              <li className="space-y-2 py-4" key={draw.id}>
                <h2 className="font-semibold">{draw.title}</h2>
                <p>{draw.prize}</p>
                <p>
                  {t("tickets")} · {entry?.tickets ?? 0}
                </p>
                {draw.winner_label && (
                  <p>
                    {t("winner")} · {draw.winner_label}
                  </p>
                )}
                {draw.status === "scheduled" &&
                  Date.parse(draw.ends_at) > now.getTime() &&
                  !entry?.free_entry && (
                    <ActionForm action={enterDraw.bind(null, draw.id)} submit={t("freeEntry")} />
                  )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>{t("emptyDraws")}</p>
      )}
    </div>
  );
}
