"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromDbError, type ActionResult } from "@/lib/admin/result";
import { requireOnboarded } from "@/lib/auth/session";
import { rateLimit } from "@/lib/http/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function appealClaim(
  claim: string,
  _previous: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireOnboarded("/claims");
  if (!(await rateLimit("memberSupport", user.id))) return { ok: false, key: "limited" };
  const evidence = z.string().trim().min(20).max(4000).safeParse(form.get("evidence"));
  if (!z.uuid().safeParse(claim).success || !evidence.success) return { ok: false, key: "invalid" };
  const { error } = await createAdminClient().rpc("appeal_claim", {
    p_user: user.id,
    p_claim: claim,
    p_evidence: evidence.data,
  });
  if (error) return fromDbError(error);
  revalidatePath("/claims");
  revalidatePath("/admin/claims/appeals");
  return { ok: true };
}
