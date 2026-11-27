import { Suspense } from "react";
import { getNow, getTranslations } from "next-intl/server";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "System health" };

export default function HealthPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
      <RunHistory />
    </Suspense>
  );
}

const timestamp = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});

async function RunHistory() {
  await requireStaff();
  const t = await getTranslations("admin.health");
  const db = createAdminClient();
  const [recent, latest] = await Promise.all([
    db
      .from("job_runs")
      .select("id,name,status,started_at,finished_at,error_code")
      .order("started_at", { ascending: false })
      .limit(30),
    db
      .from("job_runs")
      .select("finished_at")
      .eq("name", "drain_outbox")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (recent.error || latest.error) throw new Error("job_history_unavailable");
  const last = latest.data?.finished_at;
  const now = await getNow();
  const stale = !last || now.getTime() - Date.parse(last) > 120000;
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("delivery")}</h2>
        <p className={stale ? "text-caution" : "text-positive"}>
          {t(!last ? "waiting" : stale ? "late" : "healthy")}
        </p>
        {last && (
          <p className="text-sm text-muted-foreground">
            {t("last")}{" "}
            <time className="font-mono tabular" dateTime={last}>
              {timestamp.format(new Date(last))} UTC
            </time>
          </p>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("history")}</h2>
        {recent.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-hairline border-y border-hairline">
            {recent.data.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <div>
                  <p className="font-medium">
                    {run.name === "drain_outbox" ? t("delivery") : run.name}
                  </p>
                  <time
                    className="font-mono tabular text-xs text-muted-foreground"
                    dateTime={run.started_at}
                  >
                    {timestamp.format(new Date(run.started_at))} UTC
                  </time>
                </div>
                <p className="text-sm">
                  {t(
                    run.status === "success"
                      ? "success"
                      : run.status === "failed"
                        ? "failed"
                        : "running",
                  )}
                  {run.error_code && (
                    <span className="block font-mono text-xs text-muted-foreground">
                      {run.error_code}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
