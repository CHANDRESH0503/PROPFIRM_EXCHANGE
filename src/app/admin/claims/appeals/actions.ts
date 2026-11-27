"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromDbError, type ActionResult } from "@/lib/admin/result";
import { requireReviewer } from "@/lib/auth/reviewer";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
export async function decideAppeal(
  id: string,
  _previous: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const user = await requireReviewer();
  if (!(await rateLimit("adminWrite", user.id))) return { ok: false, key: "limited" };
  const fields = z
    .object({ decision: z.enum(["uphold", "overturn"]), note: z.string().trim().min(3).max(1000) })
    .safeParse(Object.fromEntries(form));
  if (!z.uuid().safeParse(id).success || !fields.success) return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("decide_appeal", {
    p_actor: user.id,
    p_appeal: id,
    p_overturn: fields.data.decision === "overturn",
    p_note: fields.data.note,
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return fromDbError(error);
  revalidatePath("/admin/claims/appeals");
  revalidatePath("/admin/claims");
  revalidatePath("/claims");
  revalidatePath("/notifications");
  return { ok: true };
}
