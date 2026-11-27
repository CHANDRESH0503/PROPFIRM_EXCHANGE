import { createHash, timingSafeEqual } from "node:crypto";
import { processDueDeletions } from "@/lib/data-rights/erase";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/http/rate-limit";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertOwner } from "@/lib/telegram/bot";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Daily housekeeping (host timer, 03:15 UTC): Coin expiry and its 30- and 7-day warnings, and
 * account deletions whose 14-day grace period has ended. Each step runs even if another fails.
 */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  if (
    !secret ||
    !timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest("Bearer " + secret))
  ) {
    return new Response(null, { status: 401 });
  }
  if (!(await rateLimit("dailyJob", "timer"))) return new Response(null, { status: 429 });
  const db = createAdminClient();
  const run = await db.from("job_runs").insert({ name: "daily" }).select("id").single();
  if (!run.data) return new Response(null, { status: 503 });

  const failures: string[] = [];
  const summary: Record<string, number> = {};
  const expiry = await db.rpc("process_coin_expiry", {}).single();
  if (expiry.error || !expiry.data) failures.push("coin_expiry");
  else Object.assign(summary, expiry.data);
  try {
    Object.assign(summary, await processDueDeletions());
  } catch {
    failures.push("deletions");
  }
  const code = failures.join(",") || null;
  log(code ? "error" : "info", "job.daily", { code: code ?? "ok", ...summary });
  await db
    .from("job_runs")
    .update({
      status: code ? "failed" : "success",
      error_code: code,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.data.id);
  if (code) await alertOwner(`daily job failed (${code}). See System health.`);
  return Response.json({ ok: !code, ...summary }, { status: code ? 503 : 200 });
}
