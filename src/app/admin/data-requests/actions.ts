"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/admin/result";
import { requireStaff } from "@/lib/auth/session";
import { processDueDeletions } from "@/lib/data-rights/erase";
import { rateLimit } from "@/lib/http/rate-limit";

/** Owner runs due deletions now instead of waiting for the daily job. */
export async function runDueDeletions(): Promise<ActionResult> {
  const { user } = await requireStaff("owner");
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  try {
    await processDueDeletions();
  } catch {
    return { ok: false, key: "unavailable" };
  }
  revalidatePath("/admin/data-requests");
  return { ok: true };
}
