import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getNow, getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStaff } from "@/lib/auth/session";
import { getFlags } from "@/lib/flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { DrawForm, PrizesForm, RunDraw } from "./forms";

export const metadata: Metadata = { title: "Spin and draw" };

export default function SpinAdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SpinAdmin />
    </Suspense>
  );
}

async function SpinAdmin() {
  await requireStaff("owner");
  const db = createAdminClient();
  const [t, flags, prizes, draws, spins, now] = await Promise.all([
    getTranslations("adminSpin"),
    getFlags(),
    db
      .from("spin_prizes")
      .select("label,kind,value,odds_ppm,daily_cap,sort")
      .eq("active", true)
      .order("sort"),
    db
      .from("draws")
      .select(
        "id,title,prize,starts_at,ends_at,max_tickets_per_user,status,winner_label,tickets_total,rng,drawn_at",
      )
      .order("starts_at", { ascending: false })
      .limit(30),
    db
      .from("spins")
      .select("id,label,kind,rng,created_at")
      .order("id", { ascending: false })
      .limit(20),
    getNow(),
  ]);
  if (prizes.error || draws.error || spins.error) throw new Error("spin_admin_unavailable");
  const local = (iso: string) => iso.slice(0, 16);
  const date = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="max-w-prose text-sm text-text-soft">{t("intro")}</p>
        <p className="text-sm">
          {t("flags", {
            spins: flags.spins?.enabled ? t("on") : t("off"),
            draws: flags.draws?.enabled ? t("on") : t("off"),
          })}{" "}
          <Link href="/admin/settings" className="underline">
            {t("flagLink")}
          </Link>
        </p>
      </header>

      <section className="space-y-3 rounded-xl border border-hairline p-4">
        <h2 className="font-semibold">{t("prizesTitle")}</h2>
        <PrizesForm
          prizes={prizes.data.map((p) => ({
            label: p.label,
            kind: p.kind,
            value: p.value,
            percent: String(p.odds_ppm / 10_000),
            cap: p.daily_cap ? String(p.daily_cap) : "",
          }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("drawsTitle")}</h2>
        <div className="rounded-xl border border-hairline p-4">
          <h3 className="mb-3 font-semibold">{t("newDraw")}</h3>
          <DrawForm />
        </div>
        <ul className="space-y-3">
          {draws.data.map((d) => (
            <li key={d.id} className="space-y-3 rounded-xl border border-hairline p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{d.title}</h3>
                <span className="text-sm text-muted-foreground">
                  {date.format(new Date(d.starts_at))} – {date.format(new Date(d.ends_at))} ·{" "}
                  {d.status}
                </span>
              </div>
              <p className="text-sm text-text-soft">{d.prize}</p>
              {d.status === "drawn" ? (
                <p className="text-sm">
                  {t("result", {
                    winner: d.winner_label ?? t("noEntries"),
                    tickets: d.tickets_total ?? 0,
                  })}
                  {d.rng ? (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      rng {d.rng}
                    </span>
                  ) : null}
                </p>
              ) : d.status === "scheduled" ? (
                Date.parse(d.ends_at) <= now.getTime() ? (
                  <RunDraw id={d.id} />
                ) : (
                  <details>
                    <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm underline">
                      {t("edit")}
                    </summary>
                    <DrawForm
                      draw={{
                        id: d.id,
                        title: d.title,
                        prize: d.prize,
                        starts: local(d.starts_at),
                        ends: local(d.ends_at),
                        max: d.max_tickets_per_user,
                      }}
                    />
                  </details>
                )
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("auditTitle")}</h2>
        {spins.data.length ? (
          <ul className="divide-y divide-hairline border-y border-hairline text-sm">
            {spins.data.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {date.format(new Date(s.created_at))} · {s.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground">rng {s.rng}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noSpins")}</p>
        )}
      </section>
    </div>
  );
}
