import { connection } from "next/server";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Readiness, for uptime monitors and the deploy script: one cheap database read.
 * Returns only {ok}; details stay in logs.
 */
export async function GET() {
  await connection();
  const started = Date.now();
  const { error } = await createAdminClient().from("feature_flags").select("key", { head: true, count: "exact" }).limit(1);
  if (error) {
    log("error", "status.db_unreachable", { code: error.code });
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  log("debug", "status.ok", { ms: Date.now() - started });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
