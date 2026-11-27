import "server-only";
import { track } from "@/lib/analytics/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Records a mission event (idempotent per member and period in the database) and reports each
 * mission it newly completes to analytics. The completion check compares the member's progress
 * rows before and after, because the database function itself returns nothing.
 */
export async function recordMissionEvent(userId: string, event: string) {
  const db = createAdminClient();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { error } = await db.rpc("record_mission_event", { p_user: userId, p_event: event });
  if (error) throw new Error("mission_unavailable");
  const { data } = await db
    .from("mission_progress")
    .select("mission")
    .eq("user_id", userId)
    .gte("completed_at", since);
  for (const row of data ?? [])
    await track("mission_completed", userId, {
      consent: "request",
      props: { mission: row.mission },
    });
}
