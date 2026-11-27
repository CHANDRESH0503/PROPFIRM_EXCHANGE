"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireReviewer } from "@/lib/auth/reviewer";
import { rateLimit } from "@/lib/http/rate-limit";
import { requestMeta } from "@/lib/http/request";
import { createAdminClient } from "@/lib/supabase/admin";
const input = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected", "needs_info", "flagged"]),
  reason: z.string().trim().min(3).max(1000),
});
export async function reviewClaim(_prev: string, form: FormData) {
  const user = await requireReviewer();
  if (!(await rateLimit("adminWrite", user.id))) return "limited";
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return "invalid";
  const { id, decision, reason } = parsed.data;
  const { error } = await createAdminClient().rpc("review_claim", {
    p_actor: user.id,
    p_id: id,
    p_status: decision,
    p_reason: reason,
    p_request_id: (await requestMeta()).requestId,
  });
  if (error) return error.code === "40001" ? "stale" : "unavailable";
  revalidatePath("/admin/claims");
  return "saved";
}
