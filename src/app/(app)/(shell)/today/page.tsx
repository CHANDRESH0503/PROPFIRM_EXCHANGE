import Link from "next/link";
import { requestMeta } from "@/lib/http/request";
import { nullableArg } from "@/lib/supabase/args";
import { walletBalance } from "@/lib/economy/wallet";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Calculator,
  Check,
  ChevronRight,
  Gift,
  Target,
  Eye,
  GitCompareArrows,
  NotebookPen,
  ShieldCheck,
  Swords,
  Tag,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { CoinCounter, LevelBadge, XpBar } from "@/components/game/progress";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ToolDirectory } from "@/components/tools/tool-directory";
import { CheckIn } from "@/components/engagement/check-in";
import { WeeklyReviewCard } from "@/components/journal/weekly-review-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui/skeleton";
import { StreakFlame } from "@/components/ui/streak-flame";
import { requireOnboarded } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  const { user } = await requireOnboarded("/today");
  const db = await createClient();
  const geo = await requestMeta();
  const [goalResult, balance, t, progress, missions, activity, wt] = await Promise.all([
    createAdminClient()
      .rpc("member_rewards", { p_user: user.id, p_ip_country: nullableArg(geo.ipCountry) })
      .eq("is_goal", true)
      .maybeSingle(),
    walletBalance(user.id),
    getTranslations("today"),
    createAdminClient().rpc("trader_progress", { p_user: user.id }).single(),
    db.from("missions").select("key,title,xp").eq("period", "daily").order("key"),
    db
      .from("xp_events")
      .select("id,source,amount,created_at")
      .order("id", { ascending: false })
      .limit(5),
    getTranslations("wallet"),
  ]);
  const goal = goalResult.data;
  if (goalResult.error || !progress.data || missions.error || activity.error)
    throw new Error("today_unavailable");
  const {
    xp,
    next_xp: target,
    level_name: level,
    local_day: day,
    streak,
    checked_in: checked,
  } = progress.data;
  const month = day.slice(0, 7);
  const first = new Date(month + "-01T00:00:00Z");
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const [visits, done] = await Promise.all([
    db
      .from("checkins")
      .select("local_day")
      .eq("user_id", user.id)
      .gte("local_day", month + "-01")
      .lte("local_day", day),
    db.from("mission_progress").select("mission").eq("user_id", user.id).eq("period_key", day),
  ]);
  if (visits.error || done.error) throw new Error("today_progress_unavailable");
  const visited = new Set(visits.data.map((v) => Number(v.local_day.slice(-2))));
  const complete = new Set(done.data.map((v) => v.mission));
  const paths = { compare: "/firms", deals: "/deals", calculator: "/tools" } as const;
  const remaining = goal ? Math.max(0, goal.cost_coins - balance.available) : 0;
  return (
    <div className="space-y-10">
      <h1 className="sr-only">{t("greeting")}</h1>

      {/* Player card: level, XP, Coins and the daily check-in. */}
      <section
        aria-label={t("greeting")}
        className="relative overflow-hidden rounded-3xl frame-brand"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -left-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(139_92_255/0.45),transparent_65%)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-24 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_201_74/0.22),transparent_65%)]"
        />
        <div className="relative grid md:grid-cols-[1.4fr_1fr]">
          <div className="flex items-center gap-4 p-5 sm:p-6">
            <LevelBadge tier={progress.data.tier} name={level} className="size-16 text-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="text-xl text-gold">{level}</h2>
                <p className="font-mono tabular text-xs text-text-soft">
                  {target
                    ? t("level.progress", {
                        xp: xp.toLocaleString("en-US"),
                        target: target.toLocaleString("en-US"),
                      })
                    : t("level.top", { xp })}
                </p>
              </div>
              <XpBar
                value={xp}
                max={target ?? Math.max(xp, 1)}
                label={t("level.ring")}
                animateKey="fb:today-xp"
                className="h-3.5"
              />
            </div>
          </div>
          <Link
            href="/wallet"
            className="group m-3 flex flex-col justify-center gap-1 rounded-2xl border border-gold/40 bg-[linear-gradient(135deg,rgb(255_201_74/0.16),rgb(255_157_46/0.06))] p-4 transition-colors hover:border-gold/70 md:ml-0"
            aria-label={t("wallet.title")}
          >
            <span className="text-xs font-black tracking-[0.12em] text-gold uppercase">
              {t("wallet.title")}
            </span>
            <CoinCounter
              value={balance.available}
              label={t("wallet.available")}
              countKey="fb:today-coins"
              className="text-3xl"
            />
            <span className="font-mono tabular text-xs text-muted-foreground">
              {t("wallet.pendingLine", { n: balance.pending.toLocaleString("en-US") })}
            </span>
          </Link>
        </div>
        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-hairline/80 bg-ink-deep/35 p-5 sm:px-6">
          <StreakFlame lit={checked} className="size-10" />
          <div className="min-w-0 flex-1 basis-48">
            <h2 className="text-base">{t("checkIn.title")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {streak ? t("checkIn.streak", { days: streak }) : t("checkIn.body")}
            </p>
          </div>
          <CheckIn checked={checked} />
        </div>
      </section>

      <Suspense fallback={null}>
        <WeeklyReviewCard userId={user.id} />
      </Suspense>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <section aria-labelledby="quests" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="quests" className="text-xl">
              {t("missions.title")}
            </h2>
            <p className="font-mono tabular text-sm text-text-soft">
              {t("missions.count", {
                done: missions.data.filter((m) => complete.has(m.key)).length,
                total: missions.data.length,
              })}
            </p>
          </div>
          <ul className="space-y-2.5">
            {missions.data.map((m, i) => {
              const done = complete.has(m.key);
              const href = m.key in paths ? paths[m.key as keyof typeof paths] : null;
              return (
                <li
                  key={m.key}
                  style={
                    {
                      "--h": done ? "var(--positive)" : QUEST_HUES[i % QUEST_HUES.length],
                    } as React.CSSProperties
                  }
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-2xl border px-3.5 py-3 transition-[border-color,transform] duration-200 ease-(--ease-out-expo)",
                    done
                      ? "border-positive/30 bg-positive/[0.06]"
                      : "panel hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--h)_60%,transparent)]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--h)_50%,transparent)] bg-[color-mix(in_oklab,var(--h)_18%,var(--ink))] text-(--h) shadow-[0_6px_16px_-8px_var(--h)]"
                  >
                    {done ? <Check className="size-4" /> : <MissionIcon mission={m.key} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {href && !done ? (
                      <Link
                        className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
                        href={href}
                      >
                        {m.title}
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          "font-semibold",
                          done && "text-muted-foreground line-through decoration-hairline",
                        )}
                      >
                        {m.title}
                      </span>
                    )}
                  </span>
                  {done ? (
                    <span className="-rotate-6 rounded-md border-2 border-positive/80 bg-positive/10 px-2 py-0.5 text-[0.625rem] font-black tracking-[0.14em] text-positive uppercase">
                      {t("missions.done")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-xp-beam px-2.5 py-1 font-mono tabular text-xs font-black text-ink shadow-[0_4px_12px_-4px_rgb(47_214_255/0.7)]">
                      +{m.xp} XP
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="goal" className="space-y-3 rounded-3xl p-5 frame-gold sm:p-6">
          <h2 id="goal" className="flex items-center gap-2 text-xl">
            <Target className="size-5 text-gold" aria-hidden="true" />
            {t("goal.title")}
          </h2>
          {goal ? (
            <>
              <p className="font-semibold">{goal.name}</p>
              <XpBar
                value={Math.min(balance.available, goal.cost_coins)}
                max={goal.cost_coins}
                label={t("goal.title")}
                tone="gold"
                className="h-3.5"
              />
              <p className="font-mono tabular text-sm">{t("goal.remaining", { n: remaining })}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("goal.emptyBody")}</p>
          )}
          <Link className={buttonVariants({ variant: "gold", block: true })} href="/rewards">
            <Gift className="size-4" aria-hidden="true" />
            {t("goal.browse")}
          </Link>
        </section>
      </div>

      <details className="group max-w-md rounded-2xl px-4 panel">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-transform group-open:rotate-90"
          />
          {t("checkIn.calendar", {
            month: first.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }),
          })}
        </summary>
        <ol className="grid grid-cols-7 gap-1 pb-4" aria-label={t("checkIn.title")}>
          {Array.from({ length: days }, (_, i) => i + 1).map((n) => (
            <li
              key={n}
              style={n === 1 ? { gridColumnStart: ((first.getUTCDay() + 6) % 7) + 1 } : undefined}
              className={cn(
                "flex h-9 items-center justify-center gap-0.5 rounded-lg font-mono tabular text-sm",
                visited.has(n)
                  ? "bg-[linear-gradient(135deg,rgb(62_240_176/0.28),rgb(47_214_255/0.16))] font-bold text-positive ring-1 ring-positive/40"
                  : "bg-ink-deep/40 text-muted-foreground",
              )}
            >
              {visited.has(n) && <Check aria-hidden className="size-3" />}
              {n}
              {visited.has(n) && <span className="sr-only">{t("checkIn.done")}</span>}
            </li>
          ))}
        </ol>
      </details>

      <section aria-labelledby="today-tools" className="space-y-3">
        <h2 id="today-tools" className="text-xl">
          {t("tools.title")}
        </h2>
        <ToolDirectory variant="compact" journal />
      </section>

      <section aria-labelledby="soon" className="space-y-3">
        <h2 id="soon" className="text-xl">
          {t("soonList.title")}
        </h2>
        <ul className="divide-y divide-hairline rounded-2xl px-4 panel">
          <SoonItem icon={ShieldCheck} title={t("accounts.title")} body={t("accounts.emptyBody")} />
          <SoonItem icon={Eye} title={t("deals.title")} body={t("deals.emptyBody")} />
        </ul>
      </section>

      <Section title={t("activity.title")}>
        {activity.data.length ? (
          <ul className="divide-y divide-hairline rounded-2xl px-4 panel">
            {activity.data.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-3">
                <span>{wt(`sources.${e.source}` as Parameters<typeof wt>[0])}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 font-mono tabular text-xs font-bold",
                    e.amount > 0 ? "bg-xp-beam text-ink" : "bg-danger/15 text-danger",
                  )}
                >
                  {e.amount > 0 ? "+" : ""}
                  {e.amount} XP
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("activity.emptyBody")}</p>
        )}
      </Section>
    </div>
  );
}

/** Open quests cycle through these hues; a cleared quest turns mint. */
const QUEST_HUES = ["var(--cyan)", "var(--pink)", "var(--violet)", "var(--lime)"];

const MISSION_ICONS: Record<string, LucideIcon> = {
  calculator: Calculator,
  compare: GitCompareArrows,
  deals: Tag,
  profile: UserRound,
  journal_first: NotebookPen,
};

function MissionIcon({ mission }: { mission: string }) {
  const Icon = MISSION_ICONS[mission] ?? Swords;
  return <Icon className="size-4" />;
}

function SoonItem({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <li className="flex gap-4 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan/40 bg-cyan/10 text-cyan">
        <Icon className="size-5" aria-hidden="true" />
      </span>
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
      <h2 className="text-xl">{title}</h2>
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
