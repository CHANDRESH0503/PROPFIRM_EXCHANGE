import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Activity, Eye, ListChecks, ShieldCheck, Target, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoinAmount } from "@/components/ui/coin-amount";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { StreakFlame } from "@/components/ui/streak-flame";
import { brand } from "@/config/brand";
import { requireOnboarded } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Today" };

/** XP needed for Silver (05-economy.md). Comes from the `levels` table once it exists (Phase 1.6). */
const SILVER_XP = 1_000;

/*
 * Today (06-engagement.md), in the spec's order. Phase 0 has no ledger, missions or tracker
 * yet, so every section is its designed empty state with real zeros, never sample numbers.
 */
export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  await requireOnboarded("/today");
  const t = await getTranslations("today");
  const xp = 0;

  return (
    <div className="space-y-10">
      <h1 className="sr-only">{t("greeting")}</h1>

      {/* Check-in, Coins and level: the three numbers a returning user looks for */}
      <section aria-label={t("greeting")} className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-4 bg-surface p-5">
          <StreakFlame lit={false} className="size-9" />
          <div className="min-w-0 flex-1 basis-48">
            <h2 className="font-heading text-base font-semibold">{t("checkIn.title")}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t("checkIn.body")}</p>
          </div>
          <Button variant="secondary" disabled aria-describedby="checkin-soon" className="w-full sm:w-auto md:w-full lg:w-auto">
            {t("checkIn.button")}
          </Button>
          <span id="checkin-soon" className="sr-only">
            {t("checkIn.soon")}
          </span>
        </div>

        <div className="bg-surface p-5">
          <h2 className="sr-only">{t("wallet.title")}</h2>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <CoinAmount value={0} size="lg" />
            <CoinAmount value={0} status="pending" size="sm" />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("wallet.emptyBody", { brand: brand.name })}</p>
        </div>

        <div className="flex items-center gap-4 bg-surface p-5">
          {/* The level ring the spec asks for (06-engagement.md); the figure lives in the line beside it. */}
          <ProgressRing value={xp} max={SILVER_XP} size={56} stroke={6} label={t("level.ring")} />
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">{t("level.title")}</h2>
            <p className="font-heading text-lg font-semibold text-gold">{t("level.name")}</p>
            <p className="font-mono text-xs text-text-soft tabular">
              {t("level.progress", { xp: xp.toLocaleString("en-US"), target: SILVER_XP.toLocaleString("en-US") })}
            </p>
          </div>
        </div>
      </section>

      {/* Everything below opens with later releases: one ruled list, not a stack of empty boxes. */}
      <section aria-labelledby="soon" className="space-y-3">
        <h2 id="soon" className="text-lg font-semibold">
          {t("soonList.title")}
        </h2>
        <ul className="divide-y divide-hairline border-y border-hairline">
          <SoonItem icon={Target} title={t("goal.title")} body={t("goal.emptyBody")} />
          <SoonItem icon={ListChecks} title={t("missions.title")} body={t("missions.emptyBody")} />
          <SoonItem icon={ShieldCheck} title={t("accounts.title")} body={t("accounts.emptyBody")} />
          <SoonItem icon={Eye} title={t("deals.title")} body={t("deals.emptyBody")} />
        </ul>
      </section>

      <Section title={t("activity.title")}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="size-4" aria-hidden="true" />
          {t("activity.emptyBody")}
        </p>
      </Section>
    </div>
  );
}

function SoonItem({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <li className="flex gap-4 py-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-heading text-[0.9375rem] font-semibold text-foreground">{title}</p>
        <p className="measure text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TodaySkeleton() {
  return (
    <div className="space-y-10" aria-hidden="true">
      <Skeleton className="h-[7.5rem] w-full rounded-xl md:h-28" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}
