import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditTable } from "@/components/admin/audit-table";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function Dashboard() {
  await requireStaff();
  const [t, nav] = await Promise.all([getTranslations("admin.dashboard"), getTranslations("admin.nav")]);
  const db = createAdminClient();
  const head = { count: "exact", head: true } as const;
  const [waitlist, confirmed, users, onboarded, audit] = await Promise.all([
    db.from("waitlist_signups").select("id", head),
    db.from("waitlist_signups").select("id", head).eq("status", "confirmed"),
    db.from("profiles").select("id", head),
    db.from("profiles").select("id", head).not("onboarded_at", "is", null),
    db
      .from("audit_log")
      .select("id, actor_id, action, entity_type, entity_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const stats = [
    { label: t("waitlistTotal"), value: n(waitlist, "waitlist"), sub: `${fmt.format(n(confirmed, "confirmed"))} ${t("waitlistConfirmed").toLowerCase()}` },
    { label: t("users"), value: n(users, "profiles"), sub: `${fmt.format(n(onboarded, "onboarded"))} ${t("onboarded").toLowerCase()}` },
  ];

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">{nav("dashboard")}</h1>
      <dl className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface p-5">
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-mono text-3xl font-semibold tabular">{fmt.format(s.value)}</dd>
            <dd className="mt-1 text-sm text-muted-foreground">{s.sub}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("recentAudit")}</h2>
        {audit.data?.length ? <AuditTable rows={audit.data} /> : <p className="text-sm text-muted-foreground">{t("noAudit")}</p>}
      </section>
    </div>
  );
}
