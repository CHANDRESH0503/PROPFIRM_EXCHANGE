"use server";

import { updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth/session";
import { FLAGS_TAG } from "@/lib/flags";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { flagUpdateSchema } from "@/lib/validation/schemas";

export type FlagActionState =
  { status: "idle" } | { status: "saved"; key: string } | { status: "error"; message: string };

/** Owner only. The database function re-checks the role and writes the audit row. */
export async function setFeatureFlag(
  _prev: FlagActionState,
  formData: FormData,
): Promise<FlagActionState> {
  const { user } = await requireStaff("owner");
  const parsed = flagUpdateSchema.safeParse({
    key: formData.get("key"),
    enabled: formData.get("enabled") === "true",
    reason: formData.get("reason"),
  });
  if (!parsed.success)
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (!(await rateLimit("adminWrite", user.id)))
    return { status: "error", message: "Too many changes. Wait a minute." };

  const { requestId } = await requestMeta();
  const { error } = await createAdminClient().rpc("admin_set_feature_flag", {
    p_actor: user.id,
    p_key: parsed.data.key,
    p_enabled: parsed.data.enabled,
    p_reason: parsed.data.reason,
    p_request_id: requestId,
  });
  if (error) {
    log("error", "admin.flag_update_failed", { requestId, code: error.code });
    return { status: "error", message: "Could not save. Nothing was changed." };
  }
  updateTag(FLAGS_TAG);
  return { status: "saved", key: parsed.data.key };
}
