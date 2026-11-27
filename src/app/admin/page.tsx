import { Suspense } from "react";
import Link from "next/link";
import type { Route } from "next";
import { getNow, getTranslations } from "next-intl/server";
import { z } from "zod";
import { AlertTriangle, BellRing, CircleCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditTable } from "@/components/admin/audit-table";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { openOpsAlerts } from "@/lib/ops/alerts";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
      <Dashboard />
    </Suspense>
  );
}

const fmt = new Intl.NumberFormat("en-US");

function n(result: { count: number | null; error: { code: string } | null }, what: string): number {
  if (result.error) throw new Error(`count ${what}: ${result.error.code}`);
  return result.count ?? 0;
}

const alertDetail = z
  .object({
    ratio: z.coerce.number().optional(),
    count: z.coerce.number().optional(),
    name: z.string().optional(),
    remaining: z.coerce.number().optional(),
    threshold: z.coerce.number().optional(),
  })
  .catch({});

type Stat = {
  label: string;
  value: string;
  sub: string;
  href: Route;
  /** A figure that needs attention is drawn in the caution or danger state colour. */
  state?: "caution" | "danger";
};

/**
 * Today at a glance (09-admin.md §2): every queue with its age, Coin liability, failed jobs and
 * the open operational alerts, each linking to where it is handled.
 */
async function Dashboard() {
  await requireStaff();
  const [t, nav, now] = await Promise.all([
    getTranslations("admin.dashboard"),
    getTranslations("admin.nav"),
    getNow(),
  ]);
  const db = createAdminClient();
  const head = { count: "exact", head: true } as const;
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const [
    waitlist,
    confirmed,
    users,
    onboarded,
    claims,
    oldestClaim,
    redemptions,
    overdue,
    totals,
    failedJobs,
    alerts,
    audit,
  ] = await Promise.all([
    db.from("waitlist_signups").select("id", head),
    db.from("waitlist_signups").select("id", head).eq("status", "confirmed"),
    db.from("profiles").select("id", head),
    db.from("profiles").select("id", head).not("onboarded_at", "is", null),
    db
      .from("purchase_claims")
      .select("id", head)
      .in("status", ["submitted", "needs_info", "flagged"]),
    db
      .from("purchase_claims")
      .select("created_at")
      .in("status", ["submitted", "needs_info", "flagged"])
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    db.from("redemptions").select("id", head).eq("status", "pending"),
    db
      .from("redemptions")
      .select("id", head)
      .eq("status", "pending")
      .lt("target_at", now.toISOString()),
    db.from("finance_totals").select("pending,available,liability_ratio").single(),
    db.from("job_runs").select("id", head).eq("status", "failed").gte("started_at", dayAgo),
    openOpsAlerts(),
    db
      .from("audit_log")
      .select("id, actor_id, action, entity_type, entity_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  if (oldestClaim.error || totals.error) throw new Error("dashboard_unavailable");

  const waitingHours = oldestClaim.data
    ? Math.floor((now.getTime() - new Date(oldestClaim.data.created_at).getTime()) / 3_600_000)
    : null;
  const claimCount = n(claims, "claims");
  const overdueCount = n(overdue, "overdue");
  const failed = n(failedJobs, "jobs");
  const ratio = totals.data.liability_ratio === null ? null : Number(totals.data.liability_ratio);

  const stats: Stat[] = [
    {
      label: t("claims"),
      value: fmt.format(claimCount),
      sub: waitingHours === null ? t("claimsNone") : t("claimsOldest", { hours: waitingHours }),
      href: "/admin/claims",
      state: waitingHours !== null && waitingHours >= 24 ? "caution" : undefined,
    },
    {
      label: t("redemptions"),
      value: fmt.format(n(redemptions, "redemptions")),
      sub: overdueCount
        ? t("redemptionsOverdue", { n: fmt.format(overdueCount) })
        : t("redemptionsOnTime"),
      href: "/admin/rewards",
      state: overdueCount ? "danger" : undefined,
    },
    {
      label: t("coins"),
      value: fmt.format((totals.data.pending ?? 0) + (totals.data.available ?? 0)),
      sub: t("coinsSub", {
        pending: fmt.format(totals.data.pending ?? 0),
        available: fmt.format(totals.data.available ?? 0),
      }),
      href: "/admin/finance",
    },
    {
      label: t("ratio"),
      value: ratio === null ? "—" : ratio.toFixed(3),
      sub: t("ratioSub"),
      href: "/admin/finance",
      state: ratio !== null && ratio > 1 ? "danger" : undefined,
    },
    {
      label: t("failedJobs"),
      value: fmt.format(failed),
      sub: t("failedJobsSub"),
      href: "/admin/health",
      state: failed ? "danger" : undefined,
    },
    {
      label: t("users"),
      value: fmt.format(n(users, "profiles")),
      sub: `${fmt.format(n(onboarded, "onboarded"))} ${t("onboarded").toLowerCase()}`,
      href: "/admin/users",
    },
    {
      label: t("waitlistTotal"),
      value: fmt.format(n(waitlist, "waitlist")),
      sub: `${fmt.format(n(confirmed, "confirmed"))} ${t("waitlistConfirmed").toLowerCase()}`,
      href: "/admin/waitlist",
    },
  ];

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">{nav("dashboard")}</h1>

      <section aria-labelledby="alerts" className="space-y-3">
        <h2 id="alerts" className="flex items-center gap-2 text-lg font-semibold">
          <BellRing className="size-5 text-caution" aria-hidden="true" />
          {t("alerts")}
        </h2>
        {alerts.length ? (
          <ul className="space-y-2">
            {alerts.map((a) => {
              const d = alertDetail.parse(a.detail);
              const kind = a.kind as
                "liability" | "claims_waiting" | "redemption_overdue" | "low_stock";
              return (
                <li
                  key={a.key}
                  className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4"
                >
                  <AlertTriangle
                    className="mt-0.5 size-5 shrink-0 text-danger"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-foreground">
                      {t(`alert.${kind}`, {
                        ratio: d.ratio?.toFixed(3) ?? "—",
                        count: d.count ?? 0,
                        name: d.name ?? "—",
                        remaining: d.remaining ?? 0,
                        threshold: d.threshold ?? 0,
                      })}
                    </p>
                    <p className="text-sm text-text-soft">
                      {t("alertSince", {
                        date:
                          new Date(a.opened_at).toISOString().slice(0, 16).replace("T", " ") +
                          " UTC",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-text-soft">
            <CircleCheck className="size-4 text-positive" aria-hidden="true" />
            {t("alertsNone")}
          </p>
        )}
      </section>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <li key={s.label} className="grid">
            <Link
              href={s.href}
              className={cn(
                "rounded-2xl p-5 panel transition-colors hover:border-brand/60",
                s.state === "danger" && "border-danger/60",
                s.state === "caution" && "border-caution/60",
              )}
            >
              <span className="block text-sm text-text-soft">{s.label}</span>
              <span
                className={cn(
                  "mt-1 block font-mono tabular text-3xl font-semibold",
                  s.state === "danger" && "text-danger",
                  s.state === "caution" && "text-caution",
                )}
              >
                {s.value}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{s.sub}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("recentAudit")}</h2>
        {audit.data?.length ? (
          <AuditTable rows={audit.data} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("noAudit")}</p>
        )}
      </section>
    </div>
  );
}
