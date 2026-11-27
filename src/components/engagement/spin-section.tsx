import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth/session";
import { getFlags } from "@/lib/flags";
import { requestMeta } from "@/lib/http/request";
import { createClient } from "@/lib/supabase/server";
import { DailySpin } from "./spin";

/**
 * Renders nothing unless the spins flag is on and neither the member's country nor the
 * request's country is excluded. The database enforces the same rule on every spin.
 */
export async function SpinSection() {
  const [flags, profile, meta, t] = await Promise.all([
    getFlags(),
    getProfile(),
    requestMeta(),
    getTranslations("spin"),
  ]);
  const allowed = (key: "spins" | "draws") => {
    const f = flags[key];
    return (
      Boolean(f?.enabled) &&
      ![meta.ipCountry, profile?.country_code].some((c) => c && f!.excluded_countries.includes(c))
    );
  };
  if (!profile?.timezone || !allowed("spins")) return null;
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: profile.timezone }).format(new Date());
  const db = await createClient();
  const [prizes, today] = await Promise.all([
    db.from("spin_prizes").select("label,odds_ppm,sort").order("sort"),
    db.from("spins").select("label").eq("local_day", day).maybeSingle(),
  ]);
  if (prizes.error || today.error) throw new Error("spin_unavailable");
  const pct = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  return (
    <div className="space-y-2">
      <DailySpin
        spunToday={Boolean(today.data)}
        lastPrize={today.data?.label ?? null}
        odds={prizes.data.map((p) => ({
          label: p.label,
          percent: `${pct.format(p.odds_ppm / 10_000)}%`,
        }))}
      />
      {allowed("draws") ? (
        <Link href="/draws" className="inline-flex min-h-11 items-center text-sm underline">
          {t("draws")}
        </Link>
      ) : null}
    </div>
  );
}
