import { timingSafeEqual, createHash } from "node:crypto";
import { env } from "@/lib/env";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { drainEmailOutbox } from "@/lib/notifications/outbox";
import { alertOwner } from "@/lib/telegram/bot";
import { runOpsAlerts } from "@/lib/ops/alerts";
import { flushAnalytics } from "@/lib/analytics/server";
import { runCalendarDigests } from "@/lib/calendar/digest-job";
import { pullUpdates } from "@/lib/telegram/updates";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/http/rate-limit";

const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  if (
    !secret ||
    !timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest("Bearer " + secret))
  ) {
    return new Response(null, { status: 401 });
  }
  if (!(await rateLimit("outboxJob", "timer"))) return new Response(null, { status: 429 });
  const db = createAdminClient();
  const run = await db.from("job_runs").insert({ name: "drain_outbox" }).select("id").single();
  if (!run.data) return new Response(null, { status: 503 });

  // Email first, then copy new inbox notifications to Telegram and push. One failing step does
  // not stop the other; both are reported in job_runs and to the owner's Telegram.
  let code: string | null = null;
  try {
    if ((await drainEmailOutbox()).failed) code = "delivery_failed";
  } catch {
    code = "worker_failed";
  }
  try {
    await dispatchNotifications();
  } catch {
    code = code ?? "dispatch_failed";
  }
  // Weekly journal review reminders at 18:00 local on each member's review day (idempotent).
  try {
    const reminders = await db.rpc("queue_journal_review_reminders");
    if (reminders.error) throw new Error(reminders.error.code);
  } catch {
    code = code ?? "reminders_failed";
  }
  // Daily economic calendar digests at each member's chosen hour (at most once a day).
  try {
    if ((await runCalendarDigests()).failed) code = code ?? "digest_delivery_failed";
  } catch {
    code = code ?? "digest_failed";
  }
  // Owner alerts: liability, waiting claims, overdue redemptions, low voucher stock.
  try {
    await runOpsAlerts();
  } catch {
    code = code ?? "alerts_failed";
  }
  await flushAnalytics();
  // Answers bot commands when no webhook is registered (no-op once it is).
  await pullUpdates();
  // Alert on the change from healthy to failing (and back), not on every failing minute.
  const previous = await db
    .from("job_runs")
    .select("status")
    .eq("name", "drain_outbox")
    .neq("id", run.data.id)
    .not("finished_at", "is", null)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const wasFailing = previous.data?.status === "failed";
  if (code && !wasFailing)
    await alertOwner(`job drain_outbox failed (${code}). See System health.`);
  if (!code && wasFailing) await alertOwner("job drain_outbox recovered.");
  const { error } = await db
    .from("job_runs")
    .update({
      status: code ? "failed" : "success",
      error_code: code,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.data.id);
  return Response.json({ ok: !code && !error }, { status: code || error ? 503 : 200 });
}
