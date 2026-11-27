import "server-only";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { nullableArg } from "@/lib/supabase/args";

/**
 * Completes a confirmed deletion: personal fields are erased in the database (ledger and claim
 * rows stay), private files are removed, then the auth user is deleted, which cascades the
 * profile, journal and every member-owned row.
 */
export async function eraseMember(userId: string, actor: string | null) {
  const db = createAdminClient();
  const { data: files, error } = await db.rpc("erase_member", {
    p_user: userId,
    p_actor: nullableArg(actor),
  });
  if (error) throw new Error("erase_failed");
  for (const bucket of ["journal", "receipts"] as const) {
    const paths = files.filter((f) => f.bucket === bucket).map((f) => f.path);
    for (let i = 0; i < paths.length; i += 100) {
      const removed = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
      // Rows are already detached; an orphaned file is logged for the weekly cleanup.
      if (removed.error) log("warn", "erase.files_orphaned", { bucket, count: paths.length });
    }
  }
  const deleted = await db.auth.admin.deleteUser(userId);
  if (deleted.error) throw new Error("erase_auth_failed");
}

/** Runs every deletion whose 14-day grace period has ended. */
export async function processDueDeletions() {
  const { data, error } = await createAdminClient().rpc("due_deletions", { p_limit: 25 });
  if (error) throw new Error("due_deletions_failed");
  let done = 0;
  for (const row of data) {
    try {
      await eraseMember(row.user_id, null);
      done += 1;
    } catch (e) {
      log("error", "erase.failed", { reason: e instanceof Error ? e.message : "unknown" });
    }
  }
  return { due: data.length, done };
}
